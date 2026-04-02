"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AppCard,
  AppShell,
  BackNav,
  linkClass,
} from "@/components/ui/app-shell";

type EventItem = {
  id: string;
  title: string;
  city: string;
  event_date: string;
  is_active: boolean;
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
      const res = await fetch("/api/admin/events", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Ошибка");
        return;
      }
      setEvents(json.events ?? []);
    }
    run();
  }, []);

  return (
    <AppShell>
      <BackNav href="/admin">К панели</BackNav>
      <AppCard
        title="Мои мероприятия"
        subtitle="События, к которым у вас есть доступ."
      >
        {error && (
          <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        {events.length === 0 ? (
          <p className="text-sm text-slate-600">Нет назначенных мероприятий</p>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{ev.title}</p>
                  <p className="text-sm text-slate-600">
                    {ev.city} · {ev.event_date}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/events/${ev.id}/tickets`}
                    className={`${linkClass} rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm no-underline shadow-sm`}
                  >
                    Билеты
                  </Link>
                  <Link
                    href={`/admin/events/${ev.id}/tickets/new`}
                    className={`${linkClass} rounded-lg bg-teal-600 px-3 py-1.5 text-sm text-white no-underline shadow-sm hover:bg-teal-700`}
                  >
                    Новый билет
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AppCard>
    </AppShell>
  );
}
