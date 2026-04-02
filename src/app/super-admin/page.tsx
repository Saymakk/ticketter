import Link from "next/link";
import {
  AppCard,
  AppShell,
  linkClass,
} from "@/components/ui/app-shell";

export default function SuperAdminPage() {
  return (
    <AppShell>
      <AppCard
        title="Суперадмин"
        subtitle="Пользователи, мероприятия и настройки."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/super-admin/users"
              className={`${linkClass} block rounded-lg border border-slate-100 bg-slate-50/80 p-4 no-underline transition hover:border-teal-200 hover:bg-teal-50/50`}
            >
              <span className="font-semibold text-slate-900">Пользователи</span>
              <span className="mt-1 block text-xs font-normal text-slate-600">
                Создание и роли
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/super-admin/events"
              className={`${linkClass} block rounded-lg border border-slate-100 bg-slate-50/80 p-4 no-underline transition hover:border-teal-200 hover:bg-teal-50/50`}
            >
              <span className="font-semibold text-slate-900">Мероприятия</span>
              <span className="mt-1 block text-xs font-normal text-slate-600">
                Создание, доступы, список
              </span>
            </Link>
          </li>
        </ul>
      </AppCard>
    </AppShell>
  );
}
