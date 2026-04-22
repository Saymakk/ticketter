"use client";

import { Fragment, type ReactNode, useCallback, useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import {
  extractEmailFromCustomData,
  normalizePhoneForWhatsAppLink,
} from "@/lib/ticket-contact";
import { ticketStatusLabel } from "@/lib/ticket-status-label";
import { TicketSendQrButtons } from "@/components/admin/ticket-send-qr-buttons";
import { btnPrimary, btnSecondary } from "@/components/ui/app-shell";
import { TicketReceiptPreview } from "@/components/ticket-receipt-preview";
import { DownloadActionIcon, QrActionIcon } from "@/components/ui/action-icons";

export type TicketDetailModel = {
  uuid: string;
  company_name?: string | null;
  company_image_url?: string | null;
  buyer_name: string | null;
  phone: string | null;
  ticket_type: string | null;
  region: string | null;
  status: string;
  created_at: string;
  ticket_valid_until?: string | null;
  receipt_image_url?: string | null;
  custom_data: Record<string, unknown>;
};

function row(label: string, value: ReactNode) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0 sm:flex-row sm:gap-4">
      <span className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-sm text-slate-900">{value}</span>
    </div>
  );
}

type Props = {
  ticket: TicketDetailModel;
  /** Карточка в модалке — подсказки отправки через onToast в шапку модалки */
  sendToast?: (message: string) => void;
};

export function TicketDetailInner({ ticket, sendToast }: Props) {
  const { t } = useLocaleContext();
  const [qrPanelOpen, setQrPanelOpen] = useState(false);
  const [qrEntered, setQrEntered] = useState(false);

  const closeQrPanel = useCallback(() => {
    setQrEntered(false);
    window.setTimeout(() => setQrPanelOpen(false), 300);
  }, []);

  useEffect(() => {
    if (!qrPanelOpen) {
      const id = window.setTimeout(() => setQrEntered(false), 0);
      return () => window.clearTimeout(id);
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

  const customEntries =
    ticket.custom_data && typeof ticket.custom_data === "object" && ticket.custom_data !== null
      ? Object.entries(ticket.custom_data as Record<string, unknown>)
      : [];

  const ticketEmail = extractEmailFromCustomData(ticket.custom_data);
  const ticketWaPhone = normalizePhoneForWhatsAppLink(ticket.phone);
  const canEmail = Boolean(ticketEmail);
  const canWhatsApp = Boolean(ticketWaPhone);

  const qrSrc = `/api/tickets/${ticket.uuid}/qr?inline=1`;

  return (
    <>
      <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3">
        {row(t("admin.ticketCard.rowFio"), ticket.buyer_name ?? "—")}
        {row(t("admin.ticketCard.rowPhone"), ticket.phone ?? "—")}
        {row(t("admin.ticketCard.rowRegion"), ticket.region ?? "—")}
        {row(
          "Чек",
          <TicketReceiptPreview src={ticket.receipt_image_url} alt={`Чек ${ticket.uuid}`} />
        )}
        {row(
          t("admin.ticketCard.rowStatus"),
          <span className="font-bold uppercase tracking-wide">
            {ticketStatusLabel(ticket.status, t)}
          </span>
        )}
        {ticket.ticket_valid_until
          ? row("Билет действителен до", ticket.ticket_valid_until.slice(0, 10))
          : null}
        {row(t("admin.ticketCard.rowCreated"), new Date(ticket.created_at).toLocaleString())}
        {customEntries.map(([k, v]) => (
          <Fragment key={k}>{row(k, String(v ?? "—"))}</Fragment>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/tickets/${ticket.uuid}/qr`}
            download
            className={`${btnPrimary} inline-flex min-h-10 min-w-10 items-center justify-center p-0 no-underline`}
            title="Скачать билет"
            aria-label="Скачать билет"
          >
            <DownloadActionIcon className="h-5 w-5" />
          </a>
          <button
            type="button"
            onClick={() => setQrPanelOpen(true)}
            className={`${btnSecondary} inline-flex min-h-10 min-w-10 items-center justify-center p-0`}
            title={t("admin.ticketCard.showQr")}
            aria-label={t("admin.ticketCard.showQr")}
          >
            <QrActionIcon className="h-5 w-5" />
          </button>
          <TicketSendQrButtons
            ticketUuid={ticket.uuid}
            canEmail={canEmail}
            canWhatsApp={canWhatsApp}
            variant="compact"
            onToast={sendToast}
          />
        </div>
      </div>

      {qrPanelOpen ? (
        <>
          <button
            type="button"
            aria-label={t("admin.ticketCard.closeQrBackdrop")}
            className={`fixed inset-0 z-[210] bg-slate-900/45 transition-opacity duration-300 ease-out ${
              qrEntered ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeQrPanel}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("admin.ticketCard.qrDialogAria")}
            className={`fixed inset-x-0 bottom-0 z-[220] max-h-[min(520px,85vh)] overflow-y-auto rounded-t-2xl border border-slate-200/90 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_40px_rgba(15,23,42,0.12)] transition-transform duration-300 ease-out sm:mx-auto sm:max-w-lg ${
              qrEntered ? "translate-y-0" : "translate-y-full"
            }`}
            style={{ scrollbarGutter: "stable" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-slate-200" aria-hidden />
            <div className="mb-3 flex items-center justify-between gap-3 pr-2">
              <p className="text-sm font-medium text-slate-900">{t("admin.ticketCard.qrSheetTitle")}</p>
              <button
                type="button"
                onClick={closeQrPanel}
                className={`${btnSecondary} inline-flex min-h-10 min-w-10 items-center justify-center p-0`}
                aria-label="Закрыть"
                title="Закрыть"
              >
                <span aria-hidden className="text-lg leading-none">×</span>
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
    </>
  );
}
