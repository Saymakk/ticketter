"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AppCard,
  AppShell,
  BackNav,
  btnPrimary,
  btnSecondary,
} from "@/components/ui/app-shell";

type Ticket = {
  id: number;
  uuid: string;
  event_id: string;
  buyer_name: string | null;
  phone: string | null;
  ticket_type: string | null;
  region: string | null;
  status: "new" | "checked_in";
  created_at: string;
  custom_data: Record<string, unknown>;
};

type ApiError = { error?: string };

async function safeReadJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function row(label: string, value: string) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-sm text-slate-900">{value}</span>
    </div>
  );
}

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const eventId = searchParams.get("eventId") ?? "";
  const uuid = searchParams.get("uuid") ?? "";

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!eventId || !uuid) {
      setMessage("Не указаны eventId или uuid");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");

      const res = await fetch(
        `/api/scanner/tickets/by-uuid?uuid=${encodeURIComponent(uuid)}&eventId=${encodeURIComponent(eventId)}`,
        { cache: "no-store" }
      );

      const json = (await safeReadJson<{ ticket?: Ticket } & ApiError>(res)) ?? {};

      if (cancelled) return;

      if (!res.ok || !json.ticket) {
        setTicket(null);
        setMessage(json.error ?? "Билет не найден");
        setLoading(false);
        return;
      }

      setTicket(json.ticket);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [eventId, uuid]);

  async function onCheckIn(e: FormEvent) {
    e.preventDefault();
    if (!ticket || !eventId) return;

    setCheckingIn(true);
    setMessage("");

    try {
      const res = await fetch("/api/scanner/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid: ticket.uuid, eventId }),
      });

      const json =
        (await safeReadJson<{ success?: boolean; message?: string } & ApiError>(res)) ?? {};

      if (!res.ok) {
        setMessage(json.error ?? "Ошибка пробивки");
        return;
      }

      setMessage(json.message ?? "");

      if (json.success) {
        router.replace("/scanner");
      }
    } catch {
      setMessage("Сетевая ошибка при пробивке");
    } finally {
      setCheckingIn(false);
    }
  }

  if (!eventId || !uuid) {
    return (
      <AppShell maxWidth="max-w-md">
        <BackNav href="/scanner">К сканеру</BackNav>
        <AppCard title="Ошибка">
          <p className="text-sm text-slate-600">Некорректная ссылка.</p>
          <button type="button" onClick={() => router.replace("/scanner")} className={`${btnPrimary} mt-4`}>
            На сканер
          </button>
        </AppCard>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell maxWidth="max-w-md">
        <BackNav href="/scanner">К сканеру</BackNav>
        <AppCard title="Загрузка">
          <p className="text-sm text-slate-600">Загрузка билета…</p>
        </AppCard>
      </AppShell>
    );
  }

  if (!ticket) {
    return (
      <AppShell maxWidth="max-w-md">
        <BackNav href="/scanner">К сканеру</BackNav>
        <AppCard title="Билет не найден">
          <p className="text-sm text-red-800">{message || "Билет не найден"}</p>
          <button type="button" onClick={() => router.replace("/scanner")} className={`${btnSecondary} mt-4`}>
            Назад к сканеру
          </button>
        </AppCard>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth="max-w-lg">
      <BackNav href="/scanner">К сканеру</BackNav>
      <AppCard
        title={ticket.status === "checked_in" ? "Билет уже пробит" : "Подтверждение"}
        subtitle="Проверьте данные перед пробивкой."
      >
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3">
          {row("UUID", ticket.uuid)}
          {row("ФИО", ticket.buyer_name ?? "—")}
          {row("Телефон", ticket.phone ?? "—")}
          {row("Тип", ticket.ticket_type ?? "—")}
          {row("Регион", ticket.region ?? "—")}
          {row("Статус", ticket.status)}
          {row("Дата", new Date(ticket.created_at).toLocaleString())}
        </div>

        <form onSubmit={onCheckIn} className="mt-6 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={checkingIn || ticket.status === "checked_in"}
            className={btnPrimary}
          >
            {checkingIn ? "Пробиваем…" : "Пробить билет"}
          </button>
          <button
            type="button"
            onClick={() => router.replace("/scanner")}
            className={btnSecondary}
          >
            Отмена
          </button>
        </form>

        {message && (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
            {message}
          </p>
        )}
      </AppCard>
    </AppShell>
  );
}

export default function ScannerConfirmPage() {
  return (
    <Suspense
      fallback={
        <AppShell maxWidth="max-w-md">
          <p className="text-center text-sm text-slate-600">Загрузка…</p>
        </AppShell>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
