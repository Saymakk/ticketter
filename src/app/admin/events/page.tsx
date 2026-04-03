"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { formatEventDateTimeLine, isEventPastByDateString } from "@/lib/event-date";
import {
  AppCard,
  AppShell,
  BackNav,
  linkClass,
  ListLoading,
} from "@/components/ui/app-shell";

type EventItem = {
  id: string;
  title: string;
  city: string;
  event_date: string;
  event_time?: string | null;
  is_active: boolean;
};

export default function AdminEventsPage() {
  const { t } = useLocaleContext();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState("");
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    async function run() {
      setListLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/events", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? t("common.error"));
          setEvents([]);
          return;
        }
        setEvents(json.events ?? []);
      } finally {
        setListLoading(false);
      }
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- загрузка при монтировании
  }, []);

  return (
    <AppShell>
      <BackNav href="/admin">{t("common.toPanel")}</BackNav>
      <AppCard title={t("admin.events.title")} subtitle={t("admin.events.subtitle")}>
        {error && (
          <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        {listLoading ? (
          <ListLoading label={t("common.loading")} />
        ) : error ? null : events.length === 0 ? (
          <p className="text-sm text-slate-600">{t("admin.events.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{ev.title}</p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                    <span>
                      {ev.city} · {formatEventDateTimeLine(ev.event_date, ev.event_time)}
                    </span>
                    {isEventPastByDateString(ev.event_date) ? (
                      <span className="rounded-full bg-slate-200/90 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {t("admin.events.eventPastBadge")}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/events/${ev.id}/tickets`}
                    className={`${linkClass} rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm no-underline shadow-sm`}
                  >
                    {t("admin.events.tickets")}
                  </Link>
                  {isEventPastByDateString(ev.event_date) ? (
                    <span
                      className={`${linkClass} inline-flex cursor-not-allowed select-none rounded-lg bg-teal-600 px-3 py-1.5 text-sm text-white opacity-50`}
                      title={t("admin.tickets.newTicketDisabledPast")}
                    >
                      {t("admin.events.newTicket")}
                    </span>
                  ) : (
                    <Link
                      href={`/admin/events/${ev.id}/tickets/new`}
                      className={`${linkClass} rounded-lg bg-teal-600 px-3 py-1.5 text-sm text-white no-underline shadow-sm hover:bg-teal-700`}
                    >
                      {t("admin.events.newTicket")}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AppCard>
    </AppShell>
  );
}
