import Link from "next/link";
import {
  AppCard,
  AppShell,
  linkClass,
} from "@/components/ui/app-shell";

export default function AdminPage() {
  return (
    <AppShell>
      <AppCard
        title="Панель администратора"
        subtitle="Работа с назначенными мероприятиями и билетами."
      >
        <ul className="space-y-3 text-sm">
          <li>
            <Link href="/admin/events" className={linkClass}>
              Мои мероприятия →
            </Link>
          </li>
          <li>
            <Link href="/scanner" className={linkClass}>
              Сканер билетов →
            </Link>
          </li>
        </ul>
      </AppCard>
    </AppShell>
  );
}
