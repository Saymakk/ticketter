"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import {
  isScannerFromPanelParam,
  scannerListHref,
  SCANNER_FROM_PANEL_PARAM,
} from "@/lib/scanner/from-panel";
import { ticketStatusLabel } from "@/lib/ticket-status-label";
import {
  AppCard,
  AppShell,
  PageHeaderWithBack,
  btnPrimary,
  btnSecondary,
  ListLoading,
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
  const { t } = useLocaleContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  const eventId = searchParams.get("eventId") ?? "";
  const uuid = searchParams.get("uuid") ?? "";
  const fromPanel = isScannerFromPanelParam(searchParams.get(SCANNER_FROM_PANEL_PARAM));
  const scannerListPath = scannerListHref(fromPanel);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [eventPast, setEventPast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!eventId || !uuid) {
      setMessage(t("scanner.confirm.missingParams"));
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");

      const res = await trackedFetch(
        `/api/scanner/tickets/by-uuid?uuid=${encodeURIComponent(uuid)}&eventId=${encodeURIComponent(eventId)}`,
        { cache: "no-store" }
      );

      const json =
        (await safeReadJson<{ ticket?: Ticket; eventPast?: boolean } & ApiError>(res)) ?? {};

      if (cancelled) return;

      if (!res.ok || !json.ticket) {
        setTicket(null);
        setEventPast(false);
        setMessage(json.error ?? t("scanner.confirm.notFound"));
        setLoading(false);
        return;
      }

      setTicket(json.ticket);
      setEventPast(!!json.eventPast);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [eventId, uuid]);

  async function onCheckIn(e: FormEvent) {
    e.preventDefault();
    if (!ticket || !eventId || eventPast) return;

    setCheckingIn(true);
    setMessage("");

    try {
      const res = await trackedFetch("/api/scanner/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid: ticket.uuid, eventId }),
      });

      const json =
        (await safeReadJson<{ success?: boolean; message?: string } & ApiError>(res)) ?? {};

      if (!res.ok) {
        setMessage(json.error ?? t("scanner.confirm.checkInError"));
        return;
      }

      setMessage(json.message ?? "");

      if (json.success) {
        router.replace(scannerListPath);
      }
    } catch {
      setMessage(t("scanner.confirm.checkInNet"));
    } finally {
      setCheckingIn(false);
    }
  }

  if (!eventId || !uuid) {
    return (
      <AppShell maxWidth="max-w-md">
        <PageHeaderWithBack
          backHref={scannerListPath}
          backLabel={t("scanner.confirm.back")}
          title={t("scanner.confirm.errorTitle")}
        />
        <AppCard>
          <p className="text-sm text-slate-600">{t("scanner.confirm.errorLink")}</p>
          <button type="button" onClick={() => router.replace(scannerListPath)} className={`${btnPrimary} mt-4`}>
            {t("scanner.confirm.toScanner")}
          </button>
        </AppCard>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell maxWidth="max-w-md">
        <PageHeaderWithBack
          backHref={scannerListPath}
          backLabel={t("scanner.confirm.back")}
          title={t("scanner.confirm.loadTitle")}
        />
        <AppCard>
          <ListLoading label={t("scanner.confirm.loading")} />
        </AppCard>
      </AppShell>
    );
  }

  if (!ticket) {
    return (
      <AppShell maxWidth="max-w-md">
        <PageHeaderWithBack
          backHref={scannerListPath}
          backLabel={t("scanner.confirm.back")}
          title={t("scanner.confirm.notFound")}
        />
        <AppCard>
          <p className="text-sm text-red-800">{message || t("scanner.confirm.notFound")}</p>
          <button type="button" onClick={() => router.replace(scannerListPath)} className={`${btnSecondary} mt-4`}>
            {t("scanner.confirm.backScanner")}
          </button>
        </AppCard>
      </AppShell>
    );
  }

  const ticketRows = (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3">
      {row(t("scanner.confirm.rowUuid"), ticket.uuid)}
      {row(t("admin.ticketCard.rowFio"), ticket.buyer_name ?? "—")}
      {row(t("admin.ticketCard.rowPhone"), ticket.phone ?? "—")}
      {ticket.ticket_type ? row(t("admin.ticketCard.rowType"), ticket.ticket_type) : null}
      {row(t("admin.ticketCard.rowRegion"), ticket.region ?? "—")}
      {row(t("admin.ticketCard.rowStatus"), ticketStatusLabel(ticket.status, t))}
      {row(t("scanner.confirm.rowDate"), new Date(ticket.created_at).toLocaleString())}
    </div>
  );

  return (
    <AppShell maxWidth="max-w-lg">
      <PageHeaderWithBack
        backHref={scannerListPath}
        backLabel={t("scanner.confirm.back")}
        title={
          eventPast
            ? t("scanner.confirm.titleEventEnded")
            : ticket.status === "checked_in"
              ? t("scanner.confirm.titleChecked")
              : t("scanner.confirm.titlePending")
        }
        description={
          eventPast ? t("scanner.confirm.subtitleEventEnded") : t("scanner.confirm.subtitle")
        }
      />
      <AppCard>
        {eventPast ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {t("scanner.confirm.ticketNotValid")}
          </p>
        ) : null}
        {ticketRows}

        {eventPast ? (
          <button
            type="button"
            onClick={() => router.replace(scannerListPath)}
            className={`${btnSecondary} mt-6`}
          >
            {t("scanner.confirm.cancel")}
          </button>
        ) : (
          <form onSubmit={onCheckIn} className="mt-6 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={checkingIn || ticket.status === "checked_in"}
              className={btnPrimary}
            >
              {checkingIn ? t("scanner.confirm.checkingIn") : t("scanner.confirm.checkIn")}
            </button>
            <button
              type="button"
              onClick={() => router.replace(scannerListPath)}
              className={btnSecondary}
            >
              {t("scanner.confirm.cancel")}
            </button>
          </form>
        )}

        {message && (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
            {message}
          </p>
        )}
      </AppCard>
    </AppShell>
  );
}

function ConfirmSuspenseFallback() {
  const { t } = useLocaleContext();
  return (
    <AppShell maxWidth="max-w-md">
      <ListLoading label={t("common.loading")} />
    </AppShell>
  );
}

export default function ScannerConfirmPage() {
  return (
    <Suspense fallback={<ConfirmSuspenseFallback />}>
      <ConfirmContent />
    </Suspense>
  );
}
