"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { scannerListHref } from "@/lib/scanner/from-panel";
import {
  AppCard,
  AppShell,
  linkClass,
  panelNavTileClass,
} from "@/components/ui/app-shell";

function HomeNavTile({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <li>
      <Link href={href} className={`${linkClass} ${panelNavTileClass}`}>
        <span className="font-semibold text-slate-900">{title}</span>
        <span className="mt-1 block text-xs font-normal text-slate-600">{description}</span>
      </Link>
    </li>
  );
}

export default function AdminPage() {
  const { t } = useLocaleContext();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/auth/role", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setRole(j.role ?? null))
      .catch(() => setRole(null));
  }, []);

  const isManager = role === "admin" || role === "super_admin";

  return (
    <AppShell>
      <AppCard
        title={t("admin.home.title")}
        subtitle={
          role === null
            ? t("admin.home.subtitleLoading")
            : role === "user"
              ? t("admin.home.subtitleUser")
              : t("admin.home.subtitleManager")
        }
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          <HomeNavTile
            href="/admin/events"
            title={t("admin.home.tileTicketsTitle")}
            description={t("admin.home.tileTicketsDesc")}
          />
          <HomeNavTile
            href={scannerListHref(true)}
            title={t("admin.home.tileScannerTitle")}
            description={t("admin.home.tileScannerDesc")}
          />
          {isManager && (
            <>
              <HomeNavTile
                href="/admin/manage/events"
                title={t("admin.home.tileManageTitle")}
                description={t("admin.home.tileManageDesc")}
              />
              <HomeNavTile
                href="/admin/users"
                title={t("admin.home.tileUsersTitle")}
                description={t("admin.home.tileUsersDesc")}
              />
            </>
          )}
          {role === "super_admin" && (
            <>
              <HomeNavTile
                href="/super-admin/admins"
                title={t("admin.home.tileAdminsTitle")}
                description={t("admin.home.tileAdminsDesc")}
              />
              <HomeNavTile
                href="/super-admin/audit-logs"
                title={t("admin.home.tileAuditTitle")}
                description={t("admin.home.tileAuditDesc")}
              />
            </>
          )}
        </ul>
      </AppCard>
    </AppShell>
  );
}
