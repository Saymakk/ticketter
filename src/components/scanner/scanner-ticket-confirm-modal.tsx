"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import { ticketStatusLabel } from "@/lib/ticket-status-label";
import { btnPrimary, btnSecondary, ListLoading } from "@/components/ui/app-shell";

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
  checked_in_at: string | null;
  custom_data: Record<string, unknown>;
  company_name?: string | null;
  company_image_url?: string | null;
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

function row(rowKey: string, label: string, value: string) {
  return (
    <div
      key={rowKey}
      className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0 sm:flex-row sm:items-baseline sm:gap-4"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-sm text-slate-900">{value}</span>
    </div>
  );
}

function ticketDetailRows(
  ticket: Ticket,
  t: (key: string) => string
): ReactNode[] {
  const fmt = (iso: string) => new Date(iso).toLocaleString();
  const out: ReactNode[] = [
    ...(ticket.company_name || ticket.company_image_url
      ? [
          <div key="company" className="flex items-center gap-3 border-b border-slate-100 py-2">
            {ticket.company_image_url ? (
              <img
                src={ticket.company_image_url}
                alt={ticket.company_name ?? "Company"}
                className="h-12 w-12 rounded-md border border-slate-200 bg-white object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t("admin.ticketCard.rowCompany")}
              </p>
              <p className="truncate text-sm text-slate-900">{ticket.company_name ?? "—"}</p>
            </div>
          </div>,
        ]
      : []),
    row("uuid", t("scanner.confirm.rowUuid"), ticket.uuid),
  ];
  if (ticket.buyer_name?.trim()) {
    out.push(row("fio", t("admin.ticketCard.rowFio"), ticket.buyer_name.trim()));
  }
  if (ticket.phone?.trim()) {
    out.push(row("phone", t("admin.ticketCard.rowPhone"), ticket.phone.trim()));
  }
  if (ticket.ticket_type?.trim()) {
    out.push(
      row("type", t("admin.ticketCard.rowType"), ticket.ticket_type.trim())
    );
  }
  if (ticket.region?.trim()) {
    out.push(
      row("region", t("admin.ticketCard.rowRegion"), ticket.region.trim())
    );
  }
  out.push(
    row("status", t("admin.ticketCard.rowStatus"), ticketStatusLabel(ticket.status, t))
  );
  out.push(row("createdAt", t("scanner.confirm.rowCreatedAt"), fmt(ticket.created_at)));
  if (ticket.status === "checked_in" && ticket.checked_in_at) {
    out.push(
      row(
        "checkedInAt",
        t("scanner.confirm.rowCheckedInAt"),
        fmt(ticket.checked_in_at)
      )
    );
  }
  const cd = ticket.custom_data;
  if (cd && typeof cd === "object" && !Array.isArray(cd)) {
    for (const [k, v] of Object.entries(cd)) {
      if (v === null || v === undefined) continue;
      const s = typeof v === "string" ? v.trim() : String(v);
      if (!s) continue;
      out.push(row(`custom:${k}`, k, s));
    }
  }
  return out;
}

type Props = {
  eventId: string;
  uuid: string;
  onClose: () => void;
  onCheckInSuccess?: () => void;
};

export function ScannerTicketConfirmModal({
  eventId,
  uuid,
  onClose,
  onCheckInSuccess,
}: Props) {
  const { t } = useLocaleContext();
  const [mounted, setMounted] = useState(false);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [eventPast, setEventPast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!eventId || !uuid) {
      setMessage(t("scanner.confirm.missingParams"));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setTicket(null);
    setEventPast(false);

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
  }, [eventId, uuid, t]);

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
        onCheckInSuccess?.();
        onClose();
      }
    } catch {
      setMessage(t("scanner.confirm.checkInNet"));
    } finally {
      setCheckingIn(false);
    }
  }

  if (!mounted || typeof document === "undefined") return null;

  const title = loading
    ? t("scanner.confirm.loadTitle")
    : !eventId || !uuid
      ? t("scanner.confirm.errorTitle")
      : !ticket
        ? t("scanner.confirm.notFound")
        : eventPast
          ? t("scanner.confirm.titleEventEnded")
          : ticket.status === "checked_in"
            ? t("scanner.confirm.titleChecked")
            : t("scanner.confirm.titlePending");

  const description = ticket
    ? eventPast
      ? t("scanner.confirm.subtitleEventEnded")
      : t("scanner.confirm.subtitle")
    : "";

  const ticketRows = ticket ? (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3">
      {ticketDetailRows(ticket, t)}
    </div>
  ) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-ticket-modal-title"
        className="my-auto w-full max-w-lg max-h-[min(90vh,720px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 pb-4">
          <h2 id="scanner-ticket-modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          {!loading && ticket && description ? (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          ) : null}
        </div>

        <div className="mt-4">
          {!eventId || !uuid ? (
            <p className="text-sm text-slate-600">{t("scanner.confirm.errorLink")}</p>
          ) : loading ? (
            <ListLoading label={t("scanner.confirm.loading")} className="py-8" />
          ) : !ticket ? (
            <>
              <p className="text-sm text-red-800">{message || t("scanner.confirm.notFound")}</p>
              <button
                type="button"
                onClick={onClose}
                className={`${btnSecondary} mt-4 min-h-12 w-full text-base font-semibold sm:min-h-10 sm:w-auto sm:text-sm`}
              >
                {t("scanner.confirm.backScanner")}
              </button>
            </>
          ) : (
            <>
              {eventPast ? (
                <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {t("scanner.confirm.ticketNotValid")}
                </p>
              ) : null}
              {ticketRows}

              {eventPast ? (
                <button
                  type="button"
                  onClick={onClose}
                  className={`${btnSecondary} mt-6 min-h-12 w-full text-base font-semibold sm:min-h-10 sm:w-auto sm:text-sm`}
                >
                  {t("scanner.confirm.cancel")}
                </button>
              ) : (
                <form onSubmit={onCheckIn} className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={checkingIn || ticket.status === "checked_in"}
                    className={`${btnPrimary} min-h-12 flex-1 text-base font-semibold shadow-md sm:min-h-10 sm:flex-none sm:text-sm`}
                  >
                    {checkingIn ? t("scanner.confirm.checkingIn") : t("scanner.confirm.checkIn")}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className={`${btnSecondary} min-h-12 flex-1 text-base font-semibold sm:min-h-10 sm:flex-none sm:text-sm`}
                  >
                    {t("scanner.confirm.cancel")}
                  </button>
                </form>
              )}

              {message ? (
                <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  {message}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
