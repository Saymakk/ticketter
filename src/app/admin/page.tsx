"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import {
  readCachedClientRole,
  writeCachedClientRole,
} from "@/lib/auth/client-role-cache";
import { scannerListHref } from "@/lib/scanner/from-panel";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
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
  /** Не читаем sessionStorage в useState — иначе SSR «Загрузка…», клиент сразу с ролью → hydration mismatch. */
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const { companyId, loading: profileLoading } = useCurrentUserProfile(role === "admin");

  useEffect(() => {
    const cached = readCachedClientRole();
    if (cached !== undefined) {
      setRole(cached);
    }
    void trackedFetch("/api/auth/role", { cache: "no-store", trackGlobalLoading: false })
      .then((r) => r.json())
      .then((j) => {
        const nextRole = j.role ?? null;
        setRole(nextRole);
        writeCachedClientRole(nextRole);
      })
      .catch(() => setRole((prev) => (prev === undefined ? null : prev)));
  }, []);

  const isManager = role === "admin" || role === "super_admin";
  const canSeeCompanies =
    role === "super_admin" || (role === "admin" && !profileLoading && !companyId);

  return (
    <AppShell>
      <AppCard
        title={t("admin.home.title")}
        subtitle={
          role == null
            ? t("admin.home.subtitleLoading")
            : role === "user"
              ? t("admin.home.subtitleUser")
              : t("admin.home.subtitleManager")
        }
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {canSeeCompanies && (
            <HomeNavTile
              href="/admin/companies"
              title={t("admin.home.tileCompaniesTitle")}
              description={t("admin.home.tileCompaniesDesc")}
            />
          )}
          {isManager && (
            <HomeNavTile
              href="/admin/manage/events"
              title={t("admin.home.tileManageTitle")}
              description={t("admin.home.tileManageDesc")}
            />
          )}
          <HomeNavTile
            href="/admin/events"
            title={t("admin.home.tileTicketsTitle")}
            description={t("admin.home.tileTicketsDesc")}
          />
          {role === "super_admin" && (
            <HomeNavTile
              href="/super-admin/admins"
              title={t("admin.home.tileAdminsTitle")}
              description={t("admin.home.tileAdminsDesc")}
            />
          )}
          {isManager && (
            <HomeNavTile
              href="/admin/users"
              title={t("admin.home.tileUsersTitle")}
              description={t("admin.home.tileUsersDesc")}
            />
          )}
          {role === "super_admin" && (
            <HomeNavTile
              href="/super-admin/audit-logs"
              title={t("admin.home.tileAuditTitle")}
              description={t("admin.home.tileAuditDesc")}
            />
          )}
          <HomeNavTile
            href={scannerListHref(true)}
            title={t("admin.home.tileScannerTitle")}
            description={t("admin.home.tileScannerDesc")}
          />
        </ul>
      </AppCard>
    </AppShell>
  );
}
