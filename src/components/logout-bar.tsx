"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import brandMark from "@/app/apple-icon.png";
import AccountSettingsButton from "@/components/account-settings-button";
import LanguageSwitcher from "@/components/language-switcher";
import { useLocaleContext } from "@/components/locale-provider";

export default function LogoutBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocaleContext();

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
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-800">
          <Image
            src={brandMark}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 object-contain"
            priority
          />
          {t("logoutBar.brand")}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <LanguageSwitcher />
          <AccountSettingsButton />
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          >
            {t("logoutBar.logout")}
          </button>
        </div>
      </div>
    </header>
  );
}
