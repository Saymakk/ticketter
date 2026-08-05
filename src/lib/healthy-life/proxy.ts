import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  getHealthyLifeSupabaseAnonKey,
  getHealthyLifeSupabaseUrl,
} from "@/lib/healthy-life/config";

/** All Healthy Life routes live under this internal segment; rewrite is transparent to the browser. */
const PREFIX = "/healthy-life";

type ForwardedCookie = { name: string; value: string; options?: Record<string, unknown> };

function isAuthPage(pathname: string): boolean {
  return (
    pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/auth")
  );
}

/**
 * Own auth check (separate Supabase project/users from Ticketter), ported from
 * healthy_life_site's original middleware, plus the hostname→segment rewrite.
 */
export async function healthyLifeProxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

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

  if (!user && !isAuthPage(pathname)) {
    // API callers expect JSON, not an HTML login redirect.
    if (pathname.startsWith("/api/")) {
      return withForwardedCookies(
        NextResponse.json({ error: "Нужна авторизация" }, { status: 401 }),
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return withForwardedCookies(NextResponse.redirect(url));
  }

  if (user && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return withForwardedCookies(NextResponse.redirect(url));
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = pathname === "/" ? PREFIX : `${PREFIX}${pathname}`;
  const rewritten = NextResponse.rewrite(rewriteUrl, { request: { headers: request.headers } });
  return withForwardedCookies(rewritten);
}
