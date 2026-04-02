"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AppCard,
  AppShell,
  linkClass,
} from "@/components/ui/app-shell";

export default function AdminPage() {
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
        title="Панель"
        subtitle={
          role === "user"
            ? "Билеты и сканер по назначенным мероприятиям."
            : "Мероприятия, пользователи, билеты и сканер."
        }
      >
        <ul className="space-y-3 text-sm">
          <li>
            <Link href="/admin/events" className={linkClass}>
              Билеты для мероприятий →
            </Link>
          </li>
          <li>
            <Link href="/scanner" className={linkClass}>
              Сканер билетов →
            </Link>
          </li>
          {isManager && (
            <>
              <li>
                <Link href="/admin/manage/events" className={linkClass}>
                  Управление мероприятиями →
                </Link>
              </li>
              <li>
                <Link href="/admin/users" className={linkClass}>
                  Создание и редактирование пользователей →
                </Link>
              </li>
            </>
          )}
          {role === "super_admin" && (
            <li>
              <Link href="/super-admin" className={linkClass}>
                Суперадмин →
              </Link>
            </li>
          )}
        </ul>
      </AppCard>
    </AppShell>
  );
}
