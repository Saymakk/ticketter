"use client";

import { useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { WhatsAppSendIcon } from "@/components/admin/send-qr-icons";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import { CircularProgress, btnSecondary } from "@/components/ui/app-shell";

type SendQrResponse = {
  email?: {
    to: string | null;
    sent: boolean;
    skippedReason: "no_email" | "not_configured" | "api_error" | null;
    errorDetail: string | null;
  };
  whatsapp?: { url: string | null; sentViaApi?: boolean; apiError?: string | null };
};

type Props = {
  ticketUuid: string;
  canEmail: boolean;
  canWhatsApp: boolean;
  /** Показывать подсказку под кнопками (карточка) или только вызывать onToast (список) */
  variant?: "inline" | "compact";
  onToast?: (message: string) => void;
};

export function TicketSendQrButtons({
  ticketUuid,
  canEmail,
  canWhatsApp,
  variant = "inline",
  onToast,
}: Props) {
  const { t } = useLocaleContext();
  void canEmail;
  const [waLoading, setWaLoading] = useState(false);
  const [hint, setHint] = useState("");

  async function send(channel: "whatsapp") {
    if (!canWhatsApp) return;

    setWaLoading(true);
    setHint("");

    const show = (msg: string) => {
      if (onToast) onToast(msg);
      else setHint(msg);
    };

    try {
      const res = await trackedFetch(`/api/tickets/${ticketUuid}/send-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const json = (await res.json()) as SendQrResponse & { error?: string };

      if (!res.ok) {
        show(json.error ?? t("admin.ticketCard.sendQrError"));
        return;
      }

      const wa = json.whatsapp;
      if (wa?.sentViaApi) {
        show(t("admin.ticketCard.sendQrWhatsAppApiDone"));
      } else if (wa?.url) {
        window.open(wa.url, "_blank", "noopener,noreferrer");
        if (wa.apiError) {
          show(t("admin.ticketCard.sendQrWhatsAppOpenedApiFallback"));
        } else {
          show(t("admin.ticketCard.sendQrWhatsAppOpened"));
        }
      } else {
        show(t("admin.ticketCard.sendQrError"));
      }
    } catch {
      show(t("admin.ticketCard.sendQrError"));
    } finally {
      setWaLoading(false);
    }
  }

  if (!canWhatsApp) return null;

  const iconWa = variant === "compact" ? "h-4 w-4 text-emerald-600" : "h-5 w-5 text-emerald-600";
  const btnClass =
    variant === "compact"
      ? `${btnSecondary} inline-flex min-h-9 min-w-9 items-center justify-center p-0`
      : `${btnSecondary} inline-flex min-h-10 min-w-10 items-center justify-center p-0`;

  return (
    <div className={variant === "compact" ? "inline-flex flex-wrap gap-1.5" : "flex flex-col gap-2"}>
      <div className="flex flex-wrap gap-2">
        {canWhatsApp ? (
          <button
            type="button"
            onClick={() => void send("whatsapp")}
            disabled={waLoading}
            className={btnClass}
            title={t("admin.ticketCard.sendQrWhatsAppTitle")}
            aria-label={t("admin.ticketCard.sendQrWhatsAppTitle")}
          >
            {waLoading ? (
              <CircularProgress size="sm" className="border-slate-200 border-t-teal-600" />
            ) : (
              <WhatsAppSendIcon className={iconWa} />
            )}
          </button>
        ) : null}
      </div>
      {variant === "inline" && hint ? <p className="text-sm text-slate-700">{hint}</p> : null}
    </div>
  );
}
