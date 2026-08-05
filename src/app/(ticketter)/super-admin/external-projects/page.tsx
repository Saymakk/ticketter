"use client";

import Link from "next/link";
import { useLocaleContext } from "@/components/locale-provider";
import {
  AppCard,
  AppShell,
  PageHeaderWithBack,
  linkClass,
  panelNavTileClass,
} from "@/components/ui/app-shell";

function ProjectNavTile({
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

export default function ExternalProjectsPage() {
  const { t } = useLocaleContext();

  return (
    <AppShell maxWidth="max-w-2xl">
      <PageHeaderWithBack
        backHref="/admin"
        backLabel={t("common.toPanel")}
        title={t("super.externalProjects.title")}
      />
      <AppCard subtitle={t("super.externalProjects.subtitle")}>
        <ul className="grid gap-3 sm:grid-cols-2">
          <ProjectNavTile
            href="/super-admin/healthy-life/users"
            title={t("super.externalProjects.healthyLifeTitle")}
            description={t("super.externalProjects.healthyLifeDesc")}
          />
        </ul>
      </AppCard>
    </AppShell>
  );
}
