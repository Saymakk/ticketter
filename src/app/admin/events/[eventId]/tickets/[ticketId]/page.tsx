"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import {
  TicketDetailInner,
  type TicketDetailModel,
} from "@/components/admin/ticket-detail-inner";
import {
  AppCard,
  AppShell,
  PageHeaderWithBack,
  ListLoading,
} from "@/components/ui/app-shell";
import CompanyLogo from "@/components/company-logo";

export default function TicketCardPage() {
  const { t } = useLocaleContext();
  const params = useParams<{ eventId: string; ticketId: string }>();
  const eventId = params.eventId;
  const ticketUuid = params.ticketId;
  const [ticket, setTicket] = useState<TicketDetailModel | null>(null);
  const [error, setError] = useState("");

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
  }, [ticketUuid, t]);

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

  return (
    <AppShell maxWidth="max-w-lg">
      <PageHeaderWithBack
        backHref={`/admin/events/${eventId}/tickets`}
        backLabel={t("admin.ticketCard.back")}
        title={t("admin.ticketCard.title")}
        description={
          <div className="space-y-1">
            {ticket.company_name || ticket.company_image_url ? (
              <div className="flex items-center gap-2">
                {ticket.company_image_url ? (
                  <CompanyLogo src={ticket.company_image_url} alt={ticket.company_name ?? "Company"} size="lg" maxAspectRatio={1.75} />
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
        }
      />
      <AppCard>
        <TicketDetailInner ticket={ticket} />
      </AppCard>
    </AppShell>
  );
}






