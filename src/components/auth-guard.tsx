"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/scanner")
  );
}

export default function AuthGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isProtectedPath(pathname)) return;
    const supabase = createClient();
    let cancelled = false;

    const redirectToLogin = () => {
      if (cancelled) return;
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) redirectToLogin();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED")) {
        redirectToLogin();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  return null;
}

