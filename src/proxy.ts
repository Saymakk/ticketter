import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const IDLE_MS = 30 * 60 * 1000;

function isPublicPath(pathname: string) {
  return (
      pathname === "/login" ||
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

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    if (pathname.startsWith("/super-admin") && role !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    // scanner доступен admin + super_admin
    if (pathname.startsWith("/scanner") && role !== "admin" && role !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/admin") && role !== "admin" && role !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};