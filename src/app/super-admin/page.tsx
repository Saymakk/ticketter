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
        subtitle="Создание администраторов и отчёты. Управление мероприятиями — в панели администратора."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/super-admin/admins"
              className={`${linkClass} block rounded-lg border border-slate-100 bg-slate-50/80 p-4 no-underline transition hover:border-teal-200 hover:bg-teal-50/50`}
            >
              <span className="font-semibold text-slate-900">Администраторы</span>
              <span className="mt-1 block text-xs font-normal text-slate-600">
                Создание учётных записей с ролью «администратор»
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/admin/manage/events"
              className={`${linkClass} block rounded-lg border border-slate-100 bg-slate-50/80 p-4 no-underline transition hover:border-teal-200 hover:bg-teal-50/50`}
            >
              <span className="font-semibold text-slate-900">Мероприятия</span>
              <span className="mt-1 block text-xs font-normal text-slate-600">
                То же, что у админа: создание, назначения, поля
              </span>
            </Link>
          </li>
        </ul>
        <p className="mt-6 text-sm text-slate-600">
          <Link href="/admin" className={linkClass}>
            ← К общей панели
          </Link>
        </p>
      </AppCard>
    </AppShell>
  );
}
