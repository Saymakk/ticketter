"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminTicketDetailModal } from "@/components/admin/admin-ticket-detail-modal";
import { WhatsAppSendIcon } from "@/components/admin/send-qr-icons";
import { CopyLinkActionIcon, DeleteActionIcon, DownloadActionIcon, EditActionIcon } from "@/components/ui/action-icons";
import { TicketSendQrButtons } from "@/components/admin/ticket-send-qr-buttons";
import { useLocaleContext } from "@/components/locale-provider";
import { formatEventDateTimeLine } from "@/lib/event-date";
import {
  normalizePhoneForWhatsAppLink,
} from "@/lib/ticket-contact";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import { ticketStatusLabel } from "@/lib/ticket-status-label";
import CompanyLogo from "@/components/company-logo";
import { TicketReceiptPreview } from "@/components/ticket-receipt-preview";
import {
  AppCard,
  AppShell,
  PageHeaderWithBack,
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
  company_name?: string | null;
  company_image_url?: string | null;
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
  custom_data: Record<string, unknown> | null;
  receipt_image_url: string | null;
};

function TicketsPageContent() {
  const { t } = useLocaleContext();
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ticketModalUuid = searchParams.get("ticket");

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
  const [canEditTickets, setCanEditTickets] = useState(true);
  const [bulkWaLoading, setBulkWaLoading] = useState(false);
  const [waBulkItems, setWaBulkItems] = useState<
    { uuid: string; url: string; label: string }[] | null
  >(null);

  const [editTicketId, setEditTicketId] = useState<number | null>(null);
  const [editBuyerName, setEditBuyerName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFieldKey, setFilterFieldKey] = useState("all");
  const [filterFieldValue, setFilterFieldValue] = useState("");

  const eventPast = eventHead?.isPast === true;
  const canMutateTickets = canEditTickets && !eventPast;

  function openTicketModal(uuid: string) {
    const q = new URLSearchParams(searchParams.toString());
    q.set("ticket", uuid);
    router.push(`${pathname}?${q.toString()}`);
  }

  function closeTicketModal() {
    const q = new URLSearchParams(searchParams.toString());
    q.delete("ticket");
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname);
  }

  useEffect(() => {
    if (eventId) loadTickets();
  }, [eventId]);

  useEffect(() => {
    void (async () => {
      const res = await trackedFetch("/api/auth/role", { cache: "no-store" });
      const j = await res.json();
      if (res.ok) setCanEditTickets(j.canEditTickets !== false);
    })();
  }, []);

  useEffect(() => {
    if (!canEditTickets) {
      setEditTicketId(null);
      setEditBuyerName("");
      setEditPhone("");
      setEditRegion("");
      setEditReceiptFile(null);
      setSelected([]);
    }
  }, [canEditTickets]);

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
      const res = await trackedFetch(`/api/admin/events/${eventId}/tickets`, { cache: "no-store" });
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
        setEditReceiptFile(null);
      }
    } finally {
      setListLoading(false);
    }
  }

  function startEditTicket(ticket: TicketItem) {
    if (!canMutateTickets) return;
    setEditTicketId(ticket.id);
    setEditBuyerName(ticket.buyer_name ?? "");
    setEditPhone(ticket.phone ?? "");
    setEditRegion(ticket.region ?? "");
    setEditReceiptFile(null);
  }

  function cancelEditTicket() {
    setEditTicketId(null);
    setEditBuyerName("");
    setEditPhone("");
    setEditRegion("");
    setEditReceiptFile(null);
  }

  async function uploadReceiptForEvent(file: File) {
    const fd = new FormData();
    fd.set("receipt", file);
    const uploadRes = await trackedFetch(`/api/admin/events/${eventId}/tickets/receipt-upload`, {
      method: "POST",
      body: fd,
    });
    const uploadJson = await uploadRes.json();
    if (!uploadRes.ok || typeof uploadJson.url !== "string") {
      throw new Error(String(uploadJson.error ?? "Не удалось загрузить чек"));
    }
    return uploadJson.url as string;
  }

  async function saveEditTicket() {
    if (!editTicketId || !canMutateTickets) return;

    let receiptImageUrl: string | undefined;
    if (editReceiptFile) {
      try {
        receiptImageUrl = await uploadReceiptForEvent(editReceiptFile);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("admin.tickets.updateError"));
        return;
      }
    }

    const res = await trackedFetch(`/api/admin/events/${eventId}/tickets/${editTicketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerName: editBuyerName || null,
        phone: editPhone || null,
        region: editRegion || null,
        ...(receiptImageUrl !== undefined ? { receiptImageUrl } : {}),
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
    if (!canMutateTickets) return;
    const ok = window.confirm(t("admin.tickets.deleteConfirm"));
    if (!ok) return;

    const res = await trackedFetch(`/api/admin/events/${eventId}/tickets/${ticketId}`, {
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

  const allSelected = tickets.length > 0 && selected.length === tickets.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(tickets.map((x) => x.uuid));
    }
  }

  async function downloadSelectedQrZip() {
    if (!canEditTickets) return;
    if (selected.length === 0) {
      setError(t("admin.tickets.needOneTicket"));
      return;
    }

    setLoadingZip(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await trackedFetch("/api/tickets/qr-bulk", {
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

  const customFieldKeys = Array.from(
    new Set(
      tickets.flatMap((ticket) =>
        ticket.custom_data && typeof ticket.custom_data === "object" && !Array.isArray(ticket.custom_data)
          ? Object.keys(ticket.custom_data)
          : []
      )
    )
  ).sort((a, b) => a.localeCompare(b));

  function toSearchableValues(ticket: TicketItem): string[] {
    const values: string[] = [
      ticket.uuid,
      ticket.buyer_name ?? "",
      ticket.phone ?? "",
      ticket.ticket_type ?? "",
      ticket.region ?? "",
      ticket.status ?? "",
    ];
    if (ticket.custom_data && typeof ticket.custom_data === "object" && !Array.isArray(ticket.custom_data)) {
      for (const [k, v] of Object.entries(ticket.custom_data)) {
        values.push(k);
        values.push(String(v ?? ""));
      }
    }
    return values;
  }

  const filteredTickets = tickets.filter((ticket) => {
    if (filterStatus !== "all" && ticket.status !== filterStatus) return false;
    if (filterFieldKey !== "all") {
      const value =
        ticket.custom_data &&
        typeof ticket.custom_data === "object" &&
        !Array.isArray(ticket.custom_data)
          ? (ticket.custom_data[filterFieldKey] ?? "")
          : "";
      if (!String(value ?? "").toLowerCase().includes(filterFieldValue.trim().toLowerCase())) {
        return false;
      }
    }
    const q = filterText.trim().toLowerCase();
    if (!q) return true;
    return toSearchableValues(ticket).some((v) => v.toLowerCase().includes(q));
  });

  async function bulkSendQr(channel: "whatsapp") {
    if (!canEditTickets) return;
    if (selected.length === 0) {
      setSuccessMsg("");
      setError(t("admin.tickets.needOneTicket"));
      return;
    }

    setError("");
    setSuccessMsg("");
    setWaBulkItems(null);
    setBulkWaLoading(true);

    try {
      const res = await trackedFetch("/api/tickets/send-qr-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuids: selected, channel }),
      });
      const json = (await res.json()) as {
        error?: string;
        successCount?: number;
        processed?: number;
        failedCount?: number;
        results?: {
          uuid: string;
          ok: boolean;
          error?: string;
          whatsappUrl?: string;
          whatsappSentViaApi?: boolean;
        }[];
      };

      if (!res.ok) {
        setError(String(json.error ?? t("admin.ticketCard.sendQrError")));
        return;
      }

      const success = json.successCount ?? 0;
      const total = json.processed ?? 0;

      const apiCount =
        json.results?.filter((r) => r.ok && r.whatsappSentViaApi).length ?? 0;
      const linkCount =
        json.results?.filter((r) => r.ok && r.whatsappUrl).length ?? 0;
      if (apiCount > 0 && linkCount === 0) {
        setSuccessMsg(t("admin.tickets.bulkSendWhatsAppApiOnly", { success, total }));
      } else if (apiCount > 0 && linkCount > 0) {
        setSuccessMsg(
          t("admin.tickets.bulkSendWhatsAppMixed", {
            api: apiCount,
            links: linkCount,
            total,
          })
        );
      } else {
        setSuccessMsg(t("admin.tickets.bulkSendWhatsAppResult", { success, total }));
      }
      const items =
        json.results
          ?.filter((r) => r.ok && r.whatsappUrl)
          .map((r) => ({
            uuid: r.uuid,
            url: r.whatsappUrl!,
            label: `${r.uuid.slice(0, 8)}…`,
          })) ?? [];
      if (items.length) setWaBulkItems(items);
      if ((json.failedCount ?? 0) > 0 && json.results) {
        const fails = json.results
          .filter((r) => !r.ok)
          .map((r) => `${r.uuid.slice(0, 8)}… ${r.error ?? ""}`)
          .join("; ");
        setError(t("admin.tickets.bulkSendEmailErrors", { detail: fails }));
      }
    } catch {
      setError(t("admin.ticketCard.sendQrError"));
    } finally {
      setBulkWaLoading(false);
    }
  }

  async function duplicateSelected() {
    if (!canEditTickets) return;
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
      const res = await trackedFetch(`/api/admin/events/${eventId}/tickets/duplicate`, {
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
    if (!canEditTickets) return;
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
      const res = await trackedFetch(`/api/admin/events/${eventId}/tickets/bulk-delete`, {
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
    if (!canEditTickets) return;
    setExporting(format);
    setError("");
    try {
      const res = await trackedFetch(
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

  async function copyTicketPublicLink(ticketUuid: string) {
    setError("");
    try {
      const res = await trackedFetch(`/api/tickets/${ticketUuid}/public-link`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || typeof json.url !== "string") {
        setError(String(json.error ?? t("admin.tickets.copyLinkError")));
        return;
      }
      await navigator.clipboard.writeText(json.url);
      setSuccessMsg(t("admin.tickets.copyLinkSuccess"));
    } catch {
      setError(t("admin.tickets.copyLinkError"));
    }
  }

  return (
    <AppShell maxWidth="max-w-4xl">
      <PageHeaderWithBack
        backHref="/admin/events"
        backLabel={t("admin.tickets.backEvents")}
        title={t("admin.tickets.title")}
      />
      <AppCard>
        {eventHead && !listLoading && !error ? (
          <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            {eventHead.company_image_url ? (
              <div className="mb-2 flex items-center gap-2">
                <CompanyLogo src={eventHead.company_image_url} alt={eventHead.company_name ?? eventHead.title} size="sm" maxAspectRatio={1.75} />
                {eventHead.company_name ? (
                  <span className="text-sm text-slate-600">{eventHead.company_name}</span>
                ) : null}
              </div>
            ) : null}
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

        {!canEditTickets ? (
          <p className="mb-4 rounded-lg border border-amber-100 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
            {t("admin.tickets.readOnlyBanner")}
          </p>
        ) : null}

        <div className="mb-6 flex flex-col gap-3">
          <div className="flex min-w-0 max-w-full flex-1 flex-col gap-3">
            {canEditTickets ? (
              <>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    className={`${btnSecondary} flex min-h-[2.75rem] min-w-[2.75rem] w-full items-center justify-center px-2 sm:min-h-0 sm:w-auto sm:px-3`}
                    aria-label="Фильтры"
                    title="Фильтры"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12m-8 7h4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    disabled={tickets.length === 0}
                    className={`${btnSecondary} flex min-h-[2.75rem] w-full items-center justify-center px-2 text-center text-sm sm:min-h-0 sm:w-auto sm:px-3.5`}
                  >
                    {allSelected ? t("admin.tickets.deselectAll") : t("admin.tickets.selectAll")}
                  </button>
                  <button
                    type="button"
                    onClick={downloadSelectedQrZip}
                    disabled={loadingZip || selected.length === 0}
                    className={`${btnPrimary} flex min-h-[2.75rem] min-w-[2.75rem] w-full items-center justify-center gap-2 px-2 text-center text-sm sm:min-h-0 sm:w-auto sm:px-3`}
                    title="Скачать билеты"
                    aria-label="Скачать билеты"
                  >
                    {loadingZip ? (
                      <>
                        <CircularProgress size="sm" className="border-white/35 border-t-white" />
                        <span className="leading-tight">{t("admin.tickets.downloading")}</span>
                      </>
                    ) : (
                      <DownloadActionIcon className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void bulkSendQr("whatsapp")}
                    disabled={bulkWaLoading || selected.length === 0}
                    className={`${btnSecondary} flex min-h-[2.75rem] min-w-[2.75rem] w-full items-center justify-center px-2 sm:min-h-0 sm:w-auto sm:px-3`}
                    title={t("admin.tickets.bulkSendWhatsApp")}
                    aria-label={t("admin.tickets.bulkSendWhatsApp")}
                  >
                    {bulkWaLoading ? (
                      <CircularProgress size="sm" />
                    ) : (
                      <WhatsAppSendIcon className="h-5 w-5 text-emerald-600" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteSelectedTickets()}
                    disabled={deleteBulkLoading || selected.length === 0 || eventPast}
                    className={`${btnDanger} flex min-h-[2.75rem] min-w-[2.75rem] w-full items-center justify-center gap-2 px-2 text-center text-sm sm:min-h-0 sm:w-auto sm:px-3`}
                    title={t("admin.tickets.deleteSelected")}
                    aria-label={t("admin.tickets.deleteSelected")}
                  >
                    {deleteBulkLoading ? (
                      <>
                        <CircularProgress size="sm" className="border-white/35 border-t-white" />
                        <span className="leading-tight">{t("admin.tickets.deleteSelectedProgress")}</span>
                      </>
                    ) : (
                      <DeleteActionIcon className="h-4 w-4" />
                    )}
                  </button>
                  <div className="relative w-full sm:ml-auto sm:w-auto" ref={exportMenuRef}>
                    <button
                      type="button"
                      onClick={() => setExportMenuOpen((o) => !o)}
                      disabled={!!exporting}
                      className={`${btnSecondary} flex min-h-[2.75rem] w-full items-center justify-center gap-1.5 px-3 text-sm sm:min-h-0 sm:w-auto sm:px-3.5`}
                      aria-expanded={exportMenuOpen}
                      aria-haspopup="menu"
                    >
                      {exporting ? (
                        <>
                          <CircularProgress size="sm" />
                          <span className="leading-tight">{t("admin.tickets.exporting")}</span>
                        </>
                      ) : (
                        <>
                          <span className="leading-tight">{t("admin.tickets.exportReport")}</span>
                          <span className="text-slate-500" aria-hidden>
                            ▾
                          </span>
                        </>
                      )}
                    </button>
                    {exportMenuOpen && !exporting ? (
                      <div
                        role="menu"
                        className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
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
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 sm:border-t-0 sm:border-l sm:border-slate-200 sm:pt-0 sm:pl-2">
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
                  <span className="text-sm text-slate-600">
                    {t("admin.tickets.selected", { count: selected.length })}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  *Например, дублировать 5 билетов = +5 билетов к тому, который уже имеется
                </p>
              </>
            ) : null}
          </div>
          {eventPast || !canEditTickets ? (
            <span
              className={`${btnPrimary} inline-flex w-fit shrink-0 cursor-not-allowed select-none opacity-50`}
              title={
                !canEditTickets
                  ? t("admin.tickets.readOnlyBanner")
                  : t("admin.tickets.newTicketDisabledPast")
              }
            >
              {t("admin.tickets.newTicket")}
            </span>
          ) : (
            <Link
              href={`/admin/events/${eventId}/tickets/new`}
              className={`${btnPrimary} w-fit shrink-0 no-underline`}
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
        {filtersOpen ? (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input
                className={`${inputClass} !mt-0`}
                placeholder="Поиск по билету"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
              <select
                className={`${inputClass} !mt-0`}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Все статусы</option>
                <option value="new">{ticketStatusLabel("new", t)}</option>
                <option value="checked_in">{ticketStatusLabel("checked_in", t)}</option>
              </select>
              <select
                className={`${inputClass} !mt-0`}
                value={filterFieldKey}
                onChange={(e) => setFilterFieldKey(e.target.value)}
              >
                <option value="all">Любое поле</option>
                {customFieldKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <input
                className={`${inputClass} !mt-0`}
                placeholder="Значение поля"
                value={filterFieldValue}
                onChange={(e) => setFilterFieldValue(e.target.value)}
                disabled={filterFieldKey === "all"}
              />
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setFilterText("");
                  setFilterStatus("all");
                  setFilterFieldKey("all");
                  setFilterFieldValue("");
                }}
                className={`${btnSecondary} px-3 py-1.5 text-sm`}
              >
                Сброс фильтров
              </button>
            </div>
          </div>
        ) : null}
        {!listLoading ? (
          <p className="mb-3 text-sm text-slate-600">
            Найдено: {filteredTickets.length} из {tickets.length}
          </p>
        ) : null}

        {listLoading ? (
          <ListLoading label={t("common.loading")} />
        ) : error ? null : filteredTickets.length === 0 ? (
          <p className="text-sm text-slate-600">{t("admin.tickets.listEmpty")}</p>
        ) : (
          <ul className="space-y-4">
            {filteredTickets.map((ticket) => {
              const rowWa = normalizePhoneForWhatsAppLink(ticket.phone);
              return (
                <li
                  key={ticket.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm"
                >
                  {editTicketId === ticket.id && canMutateTickets ? (
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
                      <label className="text-sm text-slate-700">
                        Чек
                        <input
                          type="file"
                          accept="image/*"
                          className={`${inputClass} !mt-1.5`}
                          onChange={(e) => setEditReceiptFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
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
                        {canEditTickets ? (
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            checked={selected.includes(ticket.uuid)}
                            onChange={() => toggleSelected(ticket.uuid)}
                          />
                        ) : null}
                        <div>
                          <p className="font-mono text-xs text-slate-500">{ticket.uuid}</p>
                          <p className="font-medium text-slate-900">
                            {ticket.buyer_name ?? "—"} · {ticket.phone ?? "—"}
                          </p>
                          <p className="text-sm text-slate-600">
                            <span
                              className={`font-bold uppercase tracking-wide ${
                                ticket.status === "checked_in" ? "text-teal-700" : "text-slate-500"
                              }`}
                            >
                              {ticketStatusLabel(ticket.status, t)}
                            </span>
                          </p>
                          <div className="mt-2">
                            <TicketReceiptPreview
                              src={ticket.receipt_image_url}
                              alt={`Чек ${ticket.uuid}`}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-stretch gap-2 sm:items-end">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openTicketModal(ticket.uuid)}
                            className={`${linkClass} rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm no-underline`}
                          >
                            {t("admin.tickets.card")}
                          </button>
                          <TicketSendQrButtons
                            ticketUuid={ticket.uuid}
                            canEmail={false}
                            canWhatsApp={Boolean(rowWa)}
                            variant="compact"
                            onToast={(msg) => {
                              setSuccessMsg(msg);
                              setError("");
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => void copyTicketPublicLink(ticket.uuid)}
                            title={t("admin.tickets.copyLink")}
                            aria-label={t("admin.tickets.copyLink")}
                            className={`${btnSecondary} inline-flex min-h-9 min-w-9 items-center justify-center p-1.5`}
                          >
                            <CopyLinkActionIcon className="h-5 w-5" />
                          </button>
                          {canMutateTickets ? (
                            <button
                              type="button"
                              onClick={() => startEditTicket(ticket)}
                              disabled={eventPast}
                              title={
                                eventPast
                                  ? t("admin.tickets.lockedActionsPast")
                                  : t("admin.users.edit")
                              }
                              aria-label={
                                eventPast
                                  ? t("admin.tickets.lockedActionsPast")
                                  : t("admin.users.edit")
                              }
                              className={`${btnSecondary} inline-flex min-h-9 min-w-9 items-center justify-center p-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              <EditActionIcon className="h-5 w-5" />
                            </button>
                          ) : null}
                          {canMutateTickets ? (
                            <button
                              type="button"
                              onClick={() => deleteTicket(ticket.id)}
                              disabled={eventPast}
                              title={
                                eventPast
                                  ? t("admin.tickets.lockedActionsPast")
                                  : t("admin.tickets.deleteTicket")
                              }
                              aria-label={
                                eventPast
                                  ? t("admin.tickets.lockedActionsPast")
                                  : t("admin.tickets.deleteTicket")
                              }
                              className={`${btnDanger} inline-flex min-h-9 min-w-9 items-center justify-center p-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              <DeleteActionIcon />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </AppCard>

      {ticketModalUuid && eventId ? (
        <AdminTicketDetailModal
          eventId={eventId}
          uuid={ticketModalUuid}
          onClose={closeTicketModal}
        />
      ) : null}

      {waBulkItems && waBulkItems.length > 0 ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setWaBulkItems(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-wa-title"
            className="max-h-[min(80vh,520px)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="bulk-wa-title" className="text-lg font-semibold text-slate-900">
              {t("admin.tickets.bulkWaModalTitle")}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{t("admin.tickets.bulkWaModalHint")}</p>
            <ul className="mt-4 space-y-2">
              {waBulkItems.map((x) => (
                <li key={x.uuid}>
                  <a
                    href={x.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${linkClass} inline-flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium no-underline`}
                  >
                    WhatsApp · {x.label}
                  </a>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`${btnSecondary} mt-6 w-full`}
              onClick={() => setWaBulkItems(null)}
            >
              {t("admin.tickets.bulkWaModalClose")}
            </button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

export default function TicketsPage() {
  const { t } = useLocaleContext();
  return (
    <Suspense fallback={<ListLoading label={t("common.loading")} className="py-16" />}>
      <TicketsPageContent />
    </Suspense>
  );
}





