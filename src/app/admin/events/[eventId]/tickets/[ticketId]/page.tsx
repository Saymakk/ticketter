"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AppCard,
  AppShell,
  BackNav,
  btnPrimary,
} from "@/components/ui/app-shell";

type Ticket = {
  uuid: string;
  buyer_name: string | null;
  phone: string | null;
  ticket_type: string | null;
  region: string | null;
  status: string;
  created_at: string;
  custom_data: Record<string, unknown>;
};

function row(label: string, value: string) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0 sm:flex-row sm:gap-4">
      <span className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-sm text-slate-900">{value}</span>
    </div>
  );
}

export default function TicketCardPage() {
  const params = useParams<{ eventId: string; ticketId: string }>();
  const eventId = params.eventId;
  const ticketUuid = params.ticketId;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/tickets/${ticketUuid}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Ошибка");
        return;
      }
      setTicket(json.ticket);
    }
    if (ticketUuid) load();
  }, [ticketUuid]);

  if (error) {
    return (
      <AppShell maxWidth="max-w-lg">
        <BackNav href={eventId ? `/admin/events/${eventId}/tickets` : "/admin/events"}>
          К списку билетов
        </BackNav>
        <AppCard title="Ошибка">
          <p className="text-sm text-red-800">{error}</p>
        </AppCard>
      </AppShell>
    );
  }

  if (!ticket) {
    return (
      <AppShell maxWidth="max-w-lg">
        <BackNav href={eventId ? `/admin/events/${eventId}/tickets` : "/admin/events"}>
          К списку билетов
        </BackNav>
        <AppCard title="Загрузка">
          <p className="text-sm text-slate-600">Загрузка…</p>
        </AppCard>
      </AppShell>
    );
  }

  const customEntries =
    ticket.custom_data && typeof ticket.custom_data === "object" && ticket.custom_data !== null
      ? Object.entries(ticket.custom_data as Record<string, unknown>)
      : [];

  return (
    <AppShell maxWidth="max-w-lg">
      <BackNav href={`/admin/events/${eventId}/tickets`}>К списку билетов</BackNav>
      <AppCard title="Карточка билета" subtitle={ticket.uuid}>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3">
          {row("ФИО", ticket.buyer_name ?? "—")}
          {row("Телефон", ticket.phone ?? "—")}
          {row("Тип", ticket.ticket_type ?? "—")}
          {row("Регион", ticket.region ?? "—")}
          {row("Статус", ticket.status)}
          {row("Создан", new Date(ticket.created_at).toLocaleString())}
          {customEntries.map(([k, v]) => row(k, String(v ?? "—")))}
        </div>

        <a
          href={`/api/tickets/${ticket.uuid}/qr`}
          download
          className={`${btnPrimary} mt-6 inline-flex no-underline`}
        >
          Скачать QR (PNG)
        </a>
      </AppCard>
    </AppShell>
  );
}
