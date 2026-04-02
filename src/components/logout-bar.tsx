"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutBar() {
  const pathname = usePathname();
  const router = useRouter();

  if (
    pathname === "/login" ||
    pathname === "/" ||
    pathname === "/scanner"
  ) {
    return null;
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-slate-800">
          Ticketter
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        >
          Выйти
        </button>
      </div>
    </header>
  );
}
