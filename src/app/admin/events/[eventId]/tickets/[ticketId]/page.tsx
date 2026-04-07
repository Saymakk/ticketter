"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
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
  const { t } = useLocaleContext();
  const params = useParams<{ eventId: string; ticketId: string }>();
  const eventId = params.eventId;
  const ticketUuid = params.ticketId;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState("");
  const [qrPanelOpen, setQrPanelOpen] = useState(false);
  const [qrEntered, setQrEntered] = useState(false);

  const closeQrPanel = useCallback(() => {
    setQrEntered(false);
    window.setTimeout(() => setQrPanelOpen(false), 300);
  }, []);

  useEffect(() => {
    if (!qrPanelOpen) {
      setQrEntered(false);
      return;
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setQrEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [qrPanelOpen]);

  useEffect(() => {
    if (!qrPanelOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeQrPanel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qrPanelOpen, closeQrPanel]);

  useEffect(() => {
    if (!qrPanelOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [qrPanelOpen]);

  useEffect(() => {
    async function load() {
      const res = await trackedFetch(`/api/tickets/${ticketUuid}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("common.error"));
        return;
      }
      setTicket(json.ticket);
    }
    if (ticketUuid) load();
  }, [ticketUuid]);

  if (error) {
    return (
      <AppShell maxWidth="max-w-lg">
        <PageHeaderWithBack
          backHref={eventId ? `/admin/events/${eventId}/tickets` : "/admin/events"}
          backLabel={t("admin.ticketCard.back")}
          title={t("common.error")}
        />
        <AppCard>
          <p className="text-sm text-red-800">{error}</p>
        </AppCard>
      </AppShell>
    );
  }

  if (!ticket) {
    return (
      <AppShell maxWidth="max-w-lg">
        <PageHeaderWithBack
          backHref={eventId ? `/admin/events/${eventId}/tickets` : "/admin/events"}
          backLabel={t("admin.ticketCard.back")}
          title={t("admin.ticketCard.title")}
        />
        <AppCard>
          <ListLoading label={t("admin.ticketCard.loading")} />
        </AppCard>
      </AppShell>
    );
  }

  const customEntries =
    ticket.custom_data && typeof ticket.custom_data === "object" && ticket.custom_data !== null
      ? Object.entries(ticket.custom_data as Record<string, unknown>)
      : [];

  const qrSrc = `/api/tickets/${ticket.uuid}/qr?inline=1`;

  return (
    <AppShell maxWidth="max-w-lg">
      <PageHeaderWithBack
        backHref={`/admin/events/${eventId}/tickets`}
        backLabel={t("admin.ticketCard.back")}
        title={t("admin.ticketCard.title")}
        description={
          <span className="font-mono text-xs text-slate-500 break-all">{ticket.uuid}</span>
        }
      />
      <AppCard>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3">
          {row(t("admin.ticketCard.rowFio"), ticket.buyer_name ?? "—")}
          {row(t("admin.ticketCard.rowPhone"), ticket.phone ?? "—")}
          {ticket.ticket_type
            ? row(t("admin.ticketCard.rowType"), ticket.ticket_type)
            : null}
          {row(t("admin.ticketCard.rowRegion"), ticket.region ?? "—")}
          {row(t("admin.ticketCard.rowStatus"), ticketStatusLabel(ticket.status, t))}
          {row(t("admin.ticketCard.rowCreated"), new Date(ticket.created_at).toLocaleString())}
          {customEntries.map(([k, v]) => (
            <Fragment key={k}>{row(k, String(v ?? "—"))}</Fragment>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href={`/api/tickets/${ticket.uuid}/qr`}
            download
            className={`${btnPrimary} inline-flex no-underline`}
          >
            {t("admin.ticketCard.downloadQr")}
          </a>
          <button
            type="button"
            onClick={() => setQrPanelOpen(true)}
            className={btnSecondary}
          >
            {t("admin.ticketCard.showQr")}
          </button>
        </div>
      </AppCard>

      {qrPanelOpen ? (
        <>
          <button
            type="button"
            aria-label={t("admin.ticketCard.closeQrBackdrop")}
            className={`fixed inset-0 z-40 bg-slate-900/45 transition-opacity duration-300 ease-out ${
              qrEntered ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeQrPanel}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("admin.ticketCard.qrDialogAria")}
            className={`fixed inset-x-0 bottom-0 z-50 max-h-[min(520px,85vh)] rounded-t-2xl border border-slate-200/90 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_40px_rgba(15,23,42,0.12)] transition-transform duration-300 ease-out sm:mx-auto sm:max-w-lg ${
              qrEntered ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-slate-200" aria-hidden />
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-900">{t("admin.ticketCard.qrSheetTitle")}</p>
              <button type="button" onClick={closeQrPanel} className={btnSecondary}>
                {t("admin.ticketCard.closeQr")}
              </button>
            </div>
            <div className="flex justify-center pb-2">
              <img
                src={qrSrc}
                alt={t("admin.ticketCard.qrAlt")}
                className="h-auto w-full max-w-[min(280px,72vw)] rounded-xl border border-slate-100 bg-white p-2 shadow-inner"
                width={280}
                height={280}
              />
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
