import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isEventManagerRole, isStaffRole, isSuperAdminRole } from "@/lib/auth/roles";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";
import { WORKSPACE_OWNER_EMAIL } from "@/lib/workspace/access";
import { isWorkspaceHost } from "@/lib/workspace/hosts";
import { getRequestHost } from "@/lib/http/host";
import { isHealthyLifeHost } from "@/lib/healthy-life/hosts";
import { healthyLifeProxy } from "@/lib/healthy-life/proxy";

const IDLE_MS = 30 * 60 * 1000;

function isPublicPath(pathname: string) {
  return (
      pathname === "/login" ||
      pathname === "/workspace" ||
      pathname.startsWith("/workspace/") ||
      pathname.startsWith("/_next") ||
      pathname === "/favicon.ico"
  );
}

function parseLastActivity(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = getRequestHost(request);

  // healthy-life.myworkspace.su → rewrite to /healthy-life/*
  // Also accept direct /healthy-life/* (local path-based access on localhost).
  if (isHealthyLifeHost(host) || pathname === "/healthy-life" || pathname.startsWith("/healthy-life/")) {
    return healthyLifeProxy(request);
  }

  // myworkspace.su → Workspace portal; ticketter.myworkspace.su keeps Ticketter home
  if (isWorkspaceHost(host) && (pathname === "/" || pathname === "")) {
    const url = request.nextUrl.clone();
    url.pathname = "/workspace";
    return NextResponse.rewrite(url);
  }

  // Ticketter's own API routes guard themselves (api-guards); skip proxy overhead for them.
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

            response = NextResponse.next({
              request: { headers: request.headers },
            });

            cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
            );
          },
        },
      }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected =
      pathname.startsWith("/admin") ||
      pathname.startsWith("/super-admin") ||
      pathname.startsWith("/scanner");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Idle timeout check (30 минут бездействия)
  if (user && isProtected) {
    const lastActivityRaw = request.cookies.get("last_activity_at")?.value;
    const lastActivity = parseLastActivity(lastActivityRaw);

    if (!lastActivity || Date.now() - lastActivity > IDLE_MS) {
      // Чистим сессию на сервере (best effort)
      await supabase.auth.signOut();

      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "idle");
      url.searchParams.set("next", pathname);

      const redirect = NextResponse.redirect(url);

      // На всякий случай удаляем last_activity_at cookie
      redirect.cookies.set("last_activity_at", "", {
        path: "/",
        maxAge: 0,
      });

      return redirect;
    }
  }

  if (user && isProtected) {
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    const role = profile?.role;

    if (pathname.startsWith("/super-admin") && !isSuperAdminRole(role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    // сканер: пользователь, админ, суперадмин
    if (pathname.startsWith("/scanner") && !isStaffRole(role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/admin")) {
      if (!isStaffRole(role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
      }
      const needsManager =
        pathname.startsWith("/admin/manage") || pathname.startsWith("/admin/users");
      if (needsManager && !isEventManagerRole(role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }
      if (
        pathname.startsWith("/admin/workspace") &&
        !isSuperAdminRole(role) &&
        (user.email?.trim().toLowerCase() ?? "") !== WORKSPACE_OWNER_EMAIL
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  // "api" is intentionally included so healthy-life.myworkspace.su can rewrite its own
  // fetch("/api/...") calls to /healthy-life/api/...; Ticketter's own /api/* is passed
  // straight through above (each route guards itself via lib/auth/api-guards).
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};