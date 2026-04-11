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
          <span className="font-mono text-xs text-slate-500 break-all">{ticket.uuid}</span>
        }
      />
      <AppCard>
        <TicketDetailInner ticket={ticket} />
      </AppCard>
    </AppShell>
  );
}
