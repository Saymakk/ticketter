import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  getHealthyLifeSupabaseAnonKey,
  getHealthyLifeSupabaseUrl,
} from "@/lib/healthy-life/config";

/** All Healthy Life routes live under this internal segment; rewrite is transparent on the HL host. */
const PREFIX = "/healthy-life";

type ForwardedCookie = { name: string; value: string; options?: Record<string, unknown> };

function stripPrefix(pathname: string): string {
  if (pathname === PREFIX) return "/";
  if (pathname.startsWith(`${PREFIX}/`)) return pathname.slice(PREFIX.length) || "/";
  return pathname;
}

function isAuthPage(appPath: string): boolean {
  return (
    appPath.startsWith("/login") || appPath.startsWith("/register") || appPath.startsWith("/auth")
  );
}

function isCronPath(appPath: string): boolean {
  return appPath.startsWith("/api/cron/");
}

/**
 * Own auth check (separate Supabase project/users from Ticketter), plus hostname→segment rewrite.
 * Also supports path-based local access at `/healthy-life/*` (no rewrite needed).
 */
export async function healthyLifeProxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const alreadyPrefixed = pathname === PREFIX || pathname.startsWith(`${PREFIX}/`);
  const appPath = stripPrefix(pathname);

  let cookiesToForward: ForwardedCookie[] = [];

  const supabase = createServerClient(getHealthyLifeSupabaseUrl(), getHealthyLifeSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToForward = cookiesToSet as ForwardedCookie[];
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  function withForwardedCookies(res: NextResponse): NextResponse {
    cookiesToForward.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  }

  function appUrl(path: string): URL {
    const url = request.nextUrl.clone();
    // Keep redirects in the same "mode" (host rewrite vs /healthy-life prefix).
    url.pathname = alreadyPrefixed ? (path === "/" ? PREFIX : `${PREFIX}${path}`) : path;
    return url;
  }

  if (!user && !isAuthPage(appPath)) {
    if (isCronPath(appPath)) {
      // Cron authenticates via HEALTHY_LIFE_CRON_SECRET inside the route.
      if (alreadyPrefixed) {
        return withForwardedCookies(NextResponse.next({ request: { headers: request.headers } }));
      }
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = `${PREFIX}${appPath}`;
      return withForwardedCookies(
        NextResponse.rewrite(rewriteUrl, { request: { headers: request.headers } }),
      );
    }
    if (appPath.startsWith("/api/")) {
      return withForwardedCookies(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }
    const url = appUrl("/login");
    url.searchParams.set("next", appPath);
    return withForwardedCookies(NextResponse.redirect(url));
  }

  if (user && (appPath === "/login" || appPath === "/register")) {
    return withForwardedCookies(NextResponse.redirect(appUrl("/")));
  }

  if (alreadyPrefixed) {
    return withForwardedCookies(NextResponse.next({ request: { headers: request.headers } }));
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = appPath === "/" ? PREFIX : `${PREFIX}${appPath}`;
  const rewritten = NextResponse.rewrite(rewriteUrl, { request: { headers: request.headers } });
  return withForwardedCookies(rewritten);
}
