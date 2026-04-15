import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicTicketPageModel } from "@/lib/tickets/load-public-ticket-page";

type Props = { params: Promise<{ token: string }> };

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  try {
    return JSON.stringify(v);
  } catch {
    return "—";
  }
}

function statusRu(status: string): string {
  if (status === "new") return "Новый";
  if (status === "checked_in") return "Пробит";
  return status;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await loadPublicTicketPageModel(token);
  if (!data) return { title: "Билет" };
  return {
    title: `Билет · ${data.event.title}`,
    description: "QR-код и данные билета",
    robots: { index: false, follow: false },
  };
}

export default async function PublicTicketQrPage({ params }: Props) {
  const { token } = await params;
  const data = await loadPublicTicketPageModel(token);
  if (!data) notFound();

  const { ticket, event, eventLine } = data;
  const qrSrc = `/api/public/ticket-qr/${token}`;

  const customEntries =
    ticket.custom_data && typeof ticket.custom_data === "object" && ticket.custom_data !== null
      ? Object.entries(ticket.custom_data as Record<string, unknown>)
      : [];

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-8 pb-12">
      <div className="mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-br from-teal-600 to-teal-700 px-5 py-4 text-white">
            <h1 className="text-lg font-semibold leading-snug">{event.title}</h1>
            {event.city ? (
              <p className="mt-1 text-sm text-teal-100">{event.city}</p>
            ) : null}
            {eventLine ? <p className="mt-2 text-sm text-teal-50/95">{eventLine}</p> : null}
          </div>

          <div className="flex flex-col items-center px-5 pt-6">
            <div className="w-full max-w-[280px] rounded-xl border border-slate-200 bg-white p-3 shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element -- динамический PNG из /api */}
              <img
                src={qrSrc}
                alt="QR-код билета"
                width={512}
                height={512}
                className="h-auto w-full object-contain"
              />
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              Покажите этот QR-код на входе
            </p>
          </div>

          <div className="mt-6 space-y-0 border-t border-slate-100 px-5 py-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Данные билета
            </h2>
            {event.company_name || event.company_image_url ? (
              <div className="mb-2 flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
                {event.company_image_url ? (
                  <img
                    src={event.company_image_url}
                    alt={event.company_name ?? "Компания"}
                    className="h-8 w-8 rounded-md border border-slate-200 bg-white object-cover"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Название компании
                  </p>
                  <p className="truncate text-sm text-slate-900">{event.company_name ?? "—"}</p>
                </div>
              </div>
            ) : null}
            <InfoRow label="Код билета" value={ticket.uuid} mono />
            <InfoRow label="ФИО" value={ticket.buyer_name ?? "—"} />
            <InfoRow label="Телефон" value={ticket.phone ?? "—"} />
            <InfoRow label="Тип" value={ticket.ticket_type ?? "—"} />
            <InfoRow label="Регион" value={ticket.region ?? "—"} />
            <InfoRow label="Статус" value={statusRu(ticket.status)} />
            {ticket.checked_in_at ? (
              <InfoRow label="Пробит" value={formatDateTimeRu(ticket.checked_in_at)} />
            ) : null}
            {customEntries.map(([k, v]) => (
              <InfoRow key={k} label={k} value={formatValue(v)} />
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Ссылка действительна до окончания дня после даты мероприятия (UTC).
        </p>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-50 py-2.5 last:border-0 sm:flex-row sm:items-start sm:gap-3">
      <span className="shrink-0 text-xs font-medium text-slate-500 sm:w-36">{label}</span>
      <span
        className={`min-w-0 break-words text-sm text-slate-900 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function formatDateTimeRu(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
