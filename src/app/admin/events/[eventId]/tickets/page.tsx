"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLocaleContext } from "@/components/locale-provider";
import { formatEventDateTimeLine } from "@/lib/event-date";
import { ticketStatusLabel } from "@/lib/ticket-status-label";
import {
  AppCard,
  AppShell,
  BackNav,
  btnDanger,
  btnPrimary,
  btnSecondary,
  CircularProgress,
  inputClass,
  linkClass,
  ListLoading,
} from "@/components/ui/app-shell";

type EventHead = {
  title: string;
  city: string;
  event_date: string;
  event_time?: string | null;
  isPast: boolean;
};

type TicketStats = { total: number; checkedIn: number };

function filenameFromContentDisposition(cd: string | null): string | null {
  if (!cd) return null;
  const star = /filename\*=(?:UTF-8''|utf-8'')([^;\s]+)/i.exec(cd);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].replace(/^["']|["']$/g, ""));
    } catch {
      /* ignore */
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(cd);
  if (quoted?.[1]) return quoted[1];
  return null;
}

type TicketItem = {
  id: number;
  uuid: string;
  buyer_name: string | null;
  phone: string | null;
  ticket_type: string | null;
  region: string | null;
  status: string;
  created_at: string;
};

export default function TicketsPage() {
  const { t } = useLocaleContext();
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;

  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [loadingZip, setLoadingZip] = useState(false);
  const [dupCopies, setDupCopies] = useState(1);
  const [dupLoading, setDupLoading] = useState(false);
  const [deleteBulkLoading, setDeleteBulkLoading] = useState(false);
  const [exporting, setExporting] = useState<"" | "csv" | "xlsx">("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [eventHead, setEventHead] = useState<EventHead | null>(null);
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);

  const [editTicketId, setEditTicketId] = useState<number | null>(null);
  const [editBuyerName, setEditBuyerName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRegion, setEditRegion] = useState("");

  const eventPast = eventHead?.isPast === true;

  useEffect(() => {
    if (eventId) loadTickets();
  }, [eventId]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [exportMenuOpen]);

  async function loadTickets() {
    setListLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/events/${eventId}/tickets`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? t("admin.tickets.loadError"));
        setTickets([]);
        setEventHead(null);
        setTicketStats(null);
        return;
      }

      setEventHead(json.event ?? null);
      setTicketStats(json.stats ?? null);
      setTickets(json.tickets ?? []);
      if (json.event?.isPast) {
        setEditTicketId(null);
        setEditBuyerName("");
        setEditPhone("");
        setEditRegion("");
      }
    } finally {
      setListLoading(false);
    }
  }

  function startEditTicket(ticket: TicketItem) {
    if (eventPast) return;
    setEditTicketId(ticket.id);
    setEditBuyerName(ticket.buyer_name ?? "");
    setEditPhone(ticket.phone ?? "");
    setEditRegion(ticket.region ?? "");
  }

  function cancelEditTicket() {
    setEditTicketId(null);
    setEditBuyerName("");
    setEditPhone("");
    setEditRegion("");
  }

  async function saveEditTicket() {
    if (!editTicketId || eventPast) return;

    const res = await fetch(`/api/admin/events/${eventId}/tickets/${editTicketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerName: editBuyerName || null,
        phone: editPhone || null,
        region: editRegion || null,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? t("admin.tickets.updateError"));
      return;
    }

    cancelEditTicket();
    await loadTickets();
  }

  async function deleteTicket(ticketId: number) {
    if (eventPast) return;
    const ok = window.confirm(t("admin.tickets.deleteConfirm"));
    if (!ok) return;

    const res = await fetch(`/api/admin/events/${eventId}/tickets/${ticketId}`, {
      method: "DELETE",
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? t("admin.tickets.deleteError"));
      return;
    }

    await loadTickets();
  }

  function toggleSelected(uuid: string) {
    setSelected((prev) =>
      prev.includes(uuid) ? prev.filter((x) => x !== uuid) : [...prev, uuid]
    );
  }

  const allSelected =
    tickets.length > 0 && selected.length === tickets.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(tickets.map((t) => t.uuid));
    }
  }

  async function downloadSelectedQrZip() {
    if (selected.length === 0) {
      setError(t("admin.tickets.needOneTicket"));
      return;
    }

    setLoadingZip(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/tickets/qr-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuids: selected }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? t("admin.tickets.zipError"));
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "tickets-qr.zip";
      a.click();

      window.URL.revokeObjectURL(url);
    } catch {
      setError(t("admin.tickets.zipNetworkError"));
    } finally {
      setLoadingZip(false);
    }
  }

  async function duplicateSelected() {
    if (selected.length === 0) {
      setSuccessMsg("");
      setError(t("admin.tickets.needOneTicket"));
      return;
    }

    const copies = Math.min(30, Math.max(1, Math.floor(Number(dupCopies)) || 1));

    setDupLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/admin/events/${eventId}/tickets/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUuids: selected, copies }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(String(json.error ?? t("admin.tickets.duplicateError")));
        return;
      }

      setSelected([]);
      setSuccessMsg(t("admin.tickets.duplicateSuccess", { count: json.created ?? 0 }));
      await loadTickets();
    } catch {
      setError(t("admin.tickets.duplicateError"));
    } finally {
      setDupLoading(false);
    }
  }

  async function deleteSelectedTickets() {
    if (selected.length === 0) {
      setSuccessMsg("");
      setError(t("admin.tickets.needOneTicket"));
      return;
    }
    if (eventPast) return;

    const ok = window.confirm(
      t("admin.tickets.deleteSelectedConfirm", { count: selected.length })
    );
    if (!ok) return;

    const ids = tickets.filter((x) => selected.includes(x.uuid)).map((x) => x.id);
    if (ids.length !== selected.length) {
      setError(t("admin.tickets.deleteSelectedError"));
      return;
    }

    setDeleteBulkLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`/api/admin/events/${eventId}/tickets/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketIds: ids }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(String(json.error ?? t("admin.tickets.deleteSelectedError")));
        return;
      }

      setSelected([]);
      await loadTickets();
    } catch {
      setError(t("admin.tickets.deleteSelectedError"));
    } finally {
      setDeleteBulkLoading(false);
    }
  }

  async function downloadExport(format: "csv" | "xlsx") {
    setExporting(format);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/events/${eventId}/tickets/export?format=${format}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(String((j as { error?: string }).error ?? t("admin.tickets.exportError")));
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const filename = filenameFromContentDisposition(cd) ?? `tickets.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("admin.tickets.exportError"));
    } finally {
      setExporting("");
    }
  }

  return (
    <AppShell maxWidth="max-w-4xl">
      <BackNav href="/admin/events">{t("admin.tickets.backEvents")}</BackNav>
      <AppCard title={t("admin.tickets.title")} subtitle={t("admin.tickets.subtitle")}>
        {eventHead && !listLoading && !error ? (
          <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-slate-900">{eventHead.title}</span>
              <span className="text-sm text-slate-600">
                {eventHead.city} · {formatEventDateTimeLine(eventHead.event_date, eventHead.event_time)}
              </span>
              {eventPast ? (
                <span className="rounded-full bg-slate-200/90 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  {t("admin.events.eventPastBadge")}
                </span>
              ) : null}
            </div>
            {ticketStats ? (
              <p className="mt-2 text-sm text-slate-600">
                {t("admin.tickets.statsLine", {
                  total: ticketStats.total,
                  checkedIn: ticketStats.checkedIn,
                })}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={tickets.length === 0}
              className={btnSecondary}
            >
              {allSelected ? t("admin.tickets.deselectAll") : t("admin.tickets.selectAll")}
            </button>
            <button
              type="button"
              onClick={downloadSelectedQrZip}
              disabled={loadingZip || selected.length === 0}
              className={`${btnPrimary} inline-flex items-center gap-2`}
            >
              {loadingZip ? (
                <>
                  <CircularProgress size="sm" className="border-white/35 border-t-white" />
                  {t("admin.tickets.downloading")}
                </>
              ) : (
                t("admin.tickets.downloadZip")
              )}
            </button>
            <button
              type="button"
              onClick={() => void deleteSelectedTickets()}
              disabled={deleteBulkLoading || selected.length === 0 || eventPast}
              className={`${btnDanger} inline-flex items-center gap-2`}
            >
              {deleteBulkLoading ? (
                <>
                  <CircularProgress size="sm" className="border-white/35 border-t-white" />
                  {t("admin.tickets.deleteSelectedProgress")}
                </>
              ) : (
                t("admin.tickets.deleteSelected")
              )}
            </button>
            <div className="relative inline-block" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((o) => !o)}
                disabled={!!exporting}
                className={`${btnSecondary} inline-flex items-center gap-1.5`}
                aria-expanded={exportMenuOpen}
                aria-haspopup="menu"
              >
                {exporting ? (
                  <>
                    <CircularProgress size="sm" />
                    {t("admin.tickets.exporting")}
                  </>
                ) : (
                  <>
                    {t("admin.tickets.exportReport")}
                    <span className="text-slate-500" aria-hidden>
                      ▾
                    </span>
                  </>
                )}
              </button>
              {exportMenuOpen && !exporting ? (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-20 mt-1 min-w-[11rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => {
                      setExportMenuOpen(false);
                      void downloadExport("xlsx");
                    }}
                  >
                    {t("admin.tickets.exportXlsx")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                    onClick={() => {
                      setExportMenuOpen(false);
                      void downloadExport("csv");
                    }}
                  >
                    {t("admin.tickets.exportCsv")}
                  </button>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:border-l sm:border-slate-200 sm:pl-2">
              <span className="text-sm text-slate-600">{t("admin.tickets.duplicateCopiesShort")}</span>
              <input
                type="number"
                min={1}
                max={30}
                title={t("admin.tickets.duplicateCopiesShort")}
                className={`${inputClass} !mt-0 !w-16 !max-w-16 shrink-0 px-1 py-1.5 text-center text-sm tabular-nums`}
                value={dupCopies}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (Number.isNaN(n)) setDupCopies(1);
                  else setDupCopies(Math.min(30, Math.max(1, n)));
                }}
              />
              <button
                type="button"
                onClick={() => void duplicateSelected()}
                disabled={
                  dupLoading ||
                  selected.length === 0 ||
                  tickets.length === 0 ||
                  eventPast
                }
                className={`${btnSecondary} inline-flex items-center gap-1.5 px-3 py-1.5 text-sm`}
              >
                {dupLoading ? (
                  <>
                    <CircularProgress size="sm" />
                    <span className="hidden sm:inline">{t("admin.tickets.duplicating")}</span>
                  </>
                ) : (
                  t("admin.tickets.duplicateButton")
                )}
              </button>
            </div>
            <span className="text-sm text-slate-600">
              {t("admin.tickets.selected", { count: selected.length })}
            </span>
          </div>
          {eventPast ? (
            <span
              className={`${btnPrimary} inline-flex shrink-0 cursor-not-allowed select-none opacity-50`}
              title={t("admin.tickets.newTicketDisabledPast")}
            >
              {t("admin.tickets.newTicket")}
            </span>
          ) : (
            <Link
              href={`/admin/events/${eventId}/tickets/new`}
              className={`${btnPrimary} shrink-0 no-underline`}
            >
              {t("admin.tickets.newTicket")}
            </Link>
          )}
        </div>

        {successMsg ? (
          <p className="mb-4 rounded-lg border border-teal-100 bg-teal-50/90 px-3 py-2 text-sm text-teal-900">
            {successMsg}
          </p>
        ) : null}

        {error && (
          <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        {listLoading ? (
          <ListLoading label={t("common.loading")} />
        ) : error ? null : tickets.length === 0 ? (
          <p className="text-sm text-slate-600">{t("admin.tickets.listEmpty")}</p>
        ) : (
          <ul className="space-y-4">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm"
              >
                {editTicketId === ticket.id ? (
                  <div className="grid gap-3 sm:max-w-md">
                    <input
                      className={inputClass}
                      value={editBuyerName}
                      onChange={(e) => setEditBuyerName(e.target.value)}
                      placeholder={t("admin.tickets.placeholderName")}
                    />
                    <input
                      className={inputClass}
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder={t("admin.tickets.placeholderPhone")}
                    />
                    <input
                      className={inputClass}
                      value={editRegion}
                      onChange={(e) => setEditRegion(e.target.value)}
                      placeholder={t("admin.tickets.placeholderRegion")}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={saveEditTicket} className={btnPrimary}>
                        {t("common.save")}
                      </button>
                      <button type="button" onClick={cancelEditTicket} className={btnSecondary}>
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        checked={selected.includes(ticket.uuid)}
                        onChange={() => toggleSelected(ticket.uuid)}
                      />
                      <div>
                        <p className="font-mono text-xs text-slate-500">{ticket.uuid}</p>
                        <p className="font-medium text-slate-900">
                          {ticket.buyer_name ?? "—"} · {ticket.phone ?? "—"}
                        </p>
                        <p className="text-sm text-slate-600">
                          {ticket.ticket_type ? (
                            <>
                              {ticket.ticket_type}
                              {" · "}
                            </>
                          ) : null}
                          <span
                            className={
                              ticket.status === "checked_in" ? "text-teal-700" : "text-slate-500"
                            }
                          >
                            {ticketStatusLabel(ticket.status, t)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/events/${eventId}/tickets/${ticket.uuid}`}
                        className={`${linkClass} rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm no-underline`}
                      >
                        {t("admin.tickets.card")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => startEditTicket(ticket)}
                        disabled={eventPast}
                        title={eventPast ? t("admin.tickets.lockedActionsPast") : undefined}
                        className={`${btnSecondary} disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {t("admin.users.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTicket(ticket.id)}
                        disabled={eventPast}
                        title={eventPast ? t("admin.tickets.lockedActionsPast") : undefined}
                        className={`${btnDanger} disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {t("admin.tickets.deleteTicket")}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </AppCard>
    </AppShell>
  );
}
