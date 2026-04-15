"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import { TicketDetailInner, type TicketDetailModel } from "@/components/admin/ticket-detail-inner";
import { ListLoading, btnSecondary } from "@/components/ui/app-shell";

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

type Props = {
  eventId: string;
  uuid: string;
  onClose: () => void;
};

export function AdminTicketDetailModal({ eventId, uuid, onClose }: Props) {
  const { t } = useLocaleContext();
  const [mounted, setMounted] = useState(false);
  const [ticket, setTicket] = useState<TicketDetailModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

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
    let cancelled = false;
    setTicket(null);
    setError("");
    setToast("");

    async function load() {
      setLoading(true);
      const res = await trackedFetch(`/api/tickets/${uuid}`, { cache: "no-store" });
      const json =
        (await safeReadJson<{ ticket?: TicketDetailModel } & ApiError>(res)) ?? {};

      if (cancelled) return;

      if (!res.ok || !json.ticket) {
        setTicket(null);
        setError(json.error ?? t("admin.ticketCard.loadTicketError"));
        setLoading(false);
        return;
      }

      if (json.ticket && String(json.ticket.uuid) !== uuid) {
        setTicket(null);
        setError(t("admin.ticketCard.loadTicketError"));
        setLoading(false);
        return;
      }

      setTicket(json.ticket);
      setLoading(false);
    }

    if (eventId && uuid) void load();
    else {
      setLoading(false);
      setError(t("common.error"));
    }

    return () => {
      cancelled = true;
    };
  }, [eventId, uuid, t]);

  if (!mounted || typeof document === "undefined") return null;

  const title = loading
    ? t("admin.ticketCard.loading")
    : error
      ? t("common.error")
      : t("admin.ticketCard.title");

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-ticket-modal-title"
        className="my-auto max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 pb-3">
          <h2 id="admin-ticket-modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          {!loading && ticket ? (
            <div className="mt-2 space-y-2">
              {ticket.company_name || ticket.company_image_url ? (
                <div className="flex items-center gap-2">
                  {ticket.company_image_url ? (
                    <img
                      src={ticket.company_image_url}
                      alt={ticket.company_name ?? "Company"}
                      className="h-8 w-8 rounded-md border border-slate-200 bg-white object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      {t("admin.ticketCard.rowCompany")}
                    </p>
                    <p className="truncate text-sm text-slate-900">{ticket.company_name ?? "—"}</p>
                  </div>
                </div>
              ) : null}
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  {t("admin.ticketCard.rowCode")}
                </p>
                <p className="font-mono text-xs text-slate-500 break-all">{ticket.uuid}</p>
              </div>
            </div>
          ) : null}
          {toast ? (
            <p className="mt-2 text-sm text-slate-700">{toast}</p>
          ) : null}
        </div>

        <div className="mt-4">
          {!eventId || !uuid ? (
            <p className="text-sm text-slate-600">{t("common.error")}</p>
          ) : loading ? (
            <ListLoading label={t("admin.ticketCard.loading")} className="py-8" />
          ) : error ? (
            <p className="text-sm text-red-800">{error}</p>
          ) : ticket ? (
            <TicketDetailInner
              ticket={ticket}
              sendToast={(msg) => {
                setToast(msg);
              }}
            />
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className={`${btnSecondary} mt-6 min-h-12 w-full text-base font-semibold sm:min-h-10 sm:w-auto sm:text-sm`}
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
