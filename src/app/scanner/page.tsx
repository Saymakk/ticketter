"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import type { Result } from "@zxing/library";
import AccountSettingsButton from "@/components/account-settings-button";
import LanguageSwitcher from "@/components/language-switcher";
import UserIdentityBar from "@/components/user-identity-bar";
import PwaInstallPrompt from "@/components/pwa-install-prompt";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import {
  AppCard,
  AppShell,
  PageHeaderWithBack,
  btnPrimary,
  btnSecondary,
  ListLoading,
  selectClass,
} from "@/components/ui/app-shell";
import { ScannerTicketConfirmModal } from "@/components/scanner/scanner-ticket-confirm-modal";
import {
  isScannerFromPanelParam,
  scannerConfirmHref,
  SCANNER_FROM_PANEL_PARAM,
} from "@/lib/scanner/from-panel";
import { formatEventDateTimeLine } from "@/lib/event-date";

type EventItem = {
  id: string;
  title: string;
  city: string;
  event_date: string;
  event_time?: string | null;
  tickets_total?: number;
  tickets_checked_in?: number;
};

type CheckedInItem = {
  uuid: string;
  buyer_name: string | null;
  phone: string | null;
  region: string | null;
  ticket_type: string | null;
  custom_data: Record<string, unknown> | null;
  checked_in_at: string | null;
};

type ApiError = { error?: string };

function checkedInContactLines(
  row: CheckedInItem,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  const out: ReactNode[] = [];
  const phone = row.phone?.trim();
  if (phone) {
    out.push(
      <span key="phone" className="block text-sm text-slate-700">
        <span className="text-slate-500">{t("admin.ticketCard.rowPhone")}: </span>
        {phone}
      </span>
    );
  }
  const region = row.region?.trim();
  if (region) {
    out.push(
      <span key="region" className="block text-sm text-slate-700">
        <span className="text-slate-500">{t("admin.ticketCard.rowRegion")}: </span>
        {region}
      </span>
    );
  }
  const ttype = row.ticket_type?.trim();
  if (ttype) {
    out.push(
      <span key="type" className="block text-sm text-slate-700">
        <span className="text-slate-500">{t("admin.ticketCard.rowType")}: </span>
        {ttype}
      </span>
    );
  }
  const cd = row.custom_data;
  if (cd && typeof cd === "object" && !Array.isArray(cd)) {
    for (const [k, v] of Object.entries(cd)) {
      if (v === null || v === undefined) continue;
      const s = typeof v === "string" ? v.trim() : String(v);
      if (!s) continue;
      out.push(
        <span key={`c-${k}`} className="block text-sm text-slate-700">
          <span className="text-slate-500">{k}: </span>
          {s}
        </span>
      );
    }
  }
  return out;
}

async function safeReadJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function ScannerPageContent() {
  const { t } = useLocaleContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPanel = isScannerFromPanelParam(searchParams.get(SCANNER_FROM_PANEL_PARAM));

  const modalEventId = searchParams.get("eventId");
  const modalUuid = searchParams.get("uuid");
  const isTicketModalOpen = Boolean(modalEventId && modalUuid);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [message, setMessage] = useState("");

  const [loadingEvents, setLoadingEvents] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [checkedInTickets, setCheckedInTickets] = useState<CheckedInItem[]>([]);
  const [loadingCheckedIn, setLoadingCheckedIn] = useState(false);
  /** Обновление по кнопке — без глобального спиннера, только анимация иконки */
  const [refreshCheckedInOnly, setRefreshCheckedInOnly] = useState(false);

  type ScannerTab = "event" | "scan" | "checked";
  const [tab, setTab] = useState<ScannerTab>("event");
  const tabRef = useRef<ScannerTab>(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const lastUuidRef = useRef("");
  const lastScanAtRef = useRef(0);
  /** После закрытия модалки снова запустить камеру (вкладка «Сканер» была с активной камерой). */
  const scannerResumeAfterModalRef = useRef(false);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  useEffect(() => {
    void loadEvents();
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const eid = searchParams.get("eventId");
    const uid = searchParams.get("uuid");
    if (eid && uid) {
      setSelectedEventId(eid);
    }
  }, [searchParams]);

  useEffect(() => {
    stopScanner();
    setMessage("");
    lastUuidRef.current = "";
    lastScanAtRef.current = 0;

    if (selectedEventId) {
      void loadCheckedInTickets(selectedEventId);
    } else {
      setCheckedInTickets([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  useEffect(() => {
    if (tab !== "scan") {
      stopScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function closeTicketModal() {
    const q = new URLSearchParams(searchParams.toString());
    q.delete("eventId");
    q.delete("uuid");
    const qs = q.toString();
    router.replace(`/scanner${qs ? `?${qs}` : ""}`, { scroll: false });
    lastUuidRef.current = "";
    lastScanAtRef.current = 0;
    const resume = scannerResumeAfterModalRef.current;
    scannerResumeAfterModalRef.current = false;
    if (resume) {
      setTimeout(() => {
        if (tabRef.current === "scan") void startScanner();
      }, 0);
    }
  }

  function goToConfirm(uuid: string) {
    if (!selectedEventId) return;
    scannerResumeAfterModalRef.current = tab === "scan" && isScannerOpen;
    stopScanner();
    router.replace(scannerConfirmHref(selectedEventId, uuid, fromPanel));
  }

  async function loadEvents() {
    setLoadingEvents(true);
    setMessage("");

    try {
      const res = await trackedFetch("/api/scanner/events", { cache: "no-store" });
      const json = (await safeReadJson<{ events?: EventItem[] } & ApiError>(res)) ?? {};

      if (!res.ok) {
        setEvents([]);
        setMessage(
          json.error ??
            t("scanner.errLoadEvents", { detail: `HTTP ${res.status}` })
        );
        return;
      }

      const list = json.events ?? [];
      setEvents(list);

      if (list.length === 1) {
        setSelectedEventId((prev) => prev || list[0].id);
      }
    } catch {
      setMessage(t("scanner.errLoadEventsNet"));
    } finally {
      setLoadingEvents(false);
    }
  }

  async function loadCheckedInTickets(eventId: string, opts?: { refresh?: boolean }) {
    const isRefresh = opts?.refresh === true;
    setRefreshCheckedInOnly(isRefresh);
    setLoadingCheckedIn(true);
    try {
      const res = await fetch(`/api/scanner/events/${eventId}/checked-in`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = (await safeReadJson<{ tickets?: CheckedInItem[] } & ApiError>(res)) ?? {};

      if (!res.ok) {
        setCheckedInTickets([]);
        setMessage(
          json.error ??
            t("scanner.errLoadChecked", { detail: `HTTP ${res.status}` })
        );
        return;
      }

      const list = json.tickets ?? [];
      setCheckedInTickets(list);
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, tickets_checked_in: list.length } : e
        )
      );
    } catch {
      setMessage(t("scanner.errLoadCheckedNet"));
    } finally {
      setLoadingCheckedIn(false);
      setRefreshCheckedInOnly(false);
    }
  }

  async function startScanner() {
    if (!selectedEventId) {
      setMessage(t("scanner.pickEventFirst"));
      return;
    }
    if (!videoRef.current) {
      setMessage(t("scanner.videoUnavailable"));
      return;
    }
    if (isScannerOpen) return;

    setMessage("");
    setIsScannerOpen(true);

    try {
      const isLocalhost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      const isSecure =
        typeof window !== "undefined" && (window.isSecureContext || isLocalhost);

      if (!isSecure) {
        setMessage(t("scanner.needHttps"));
        setIsScannerOpen(false);
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage(t("scanner.noCameraApi"));
        setIsScannerOpen(false);
        return;
      }

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      try {
        const pre = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        pre.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }

      let controls: IScannerControls;

      const onDecode = async (result?: Result) => {
        if (!result) return;

        const now = Date.now();
        if (now - lastScanAtRef.current < 700) return;
        lastScanAtRef.current = now;

        const uuid = result.getText().trim();
        if (!uuid) return;
        /** Пока модалка закрыта — игнорируем повтор того же кадра; после закрытия модалки lastUuid сбрасывается — тот же QR можно сканировать снова. */
        if (uuid === lastUuidRef.current) return;

        lastUuidRef.current = uuid;
        goToConfirm(uuid);
      };

      try {
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          onDecode
        );
      } catch {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const deviceId = devices[0]?.deviceId;
        if (!deviceId) {
          setMessage(t("scanner.cameraError"));
          setIsScannerOpen(false);
          return;
        }

        controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          onDecode
        );
      }

      controlsRef.current = controls;
    } catch {
      setMessage(t("scanner.scannerError"));
      setIsScannerOpen(false);
    }
  }

  function stopScanner() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    readerRef.current = null;
    setIsScannerOpen(false);
  }

  return (
    <AppShell maxWidth="max-w-2xl">
      <div className="mx-auto -mt-5 mb-1 flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 sm:-mt-6 sm:px-6">
        <UserIdentityBar className="min-w-0 flex-1 basis-full sm:basis-0 sm:text-right" />
        <div className="flex shrink-0 items-center gap-3 sm:ml-auto">
          <LanguageSwitcher />
          <AccountSettingsButton />
        </div>
      </div>
      {fromPanel ? (
        <PageHeaderWithBack
          backHref="/admin"
          backLabel={t("scanner.backPanel")}
          title={t("scanner.title")}
        />
      ) : null}
      <AppCard>
        <div
          className="mb-6 grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1.5 shadow-inner"
          role="tablist"
          aria-label={t("scanner.tabsAria")}
        >
          {(
            [
              { id: "event" as const, label: t("scanner.tabEvent") },
              { id: "scan" as const, label: t("scanner.tabScan") },
              { id: "checked" as const, label: t("scanner.tabChecked") },
            ] as const
          ).map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                id={`scanner-tab-${item.id}`}
                onClick={() => setTab(item.id)}
                className={`min-h-[3rem] rounded-xl px-1.5 py-2.5 text-center text-[0.8125rem] font-semibold leading-snug tracking-tight transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 sm:px-3 sm:text-sm ${
                  active
                    ? "bg-teal-600 text-white shadow-md ring-1 ring-teal-700/20"
                    : "text-slate-600 hover:bg-white/90 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-[12rem]">
          {tab === "event" ? (
            <div
              role="tabpanel"
              aria-labelledby="scanner-tab-event"
              className="space-y-6"
            >
              <PwaInstallPrompt />
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-teal-800/90">
                  {t("scanner.stepEvent")}
                </h3>
                {loadingEvents ? (
                  <ListLoading label={t("scanner.loadingEvents")} className="py-6" />
                ) : events.length === 0 ? (
                  <p className="text-sm text-slate-600">{t("scanner.noEvents")}</p>
                ) : (
                  <select
                    className={selectClass}
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                  >
                    <option value="">{t("scanner.pickEvent")}</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} / {ev.city} /{" "}
                        {formatEventDateTimeLine(ev.event_date, ev.event_time)}
                      </option>
                    ))}
                  </select>
                )}
                {selectedEvent && (
                  <div className="mt-3 space-y-2">
                    <p className="rounded-xl border border-teal-100/90 bg-teal-50/90 px-3.5 py-3 text-sm text-slate-700 shadow-sm">
                      <span className="font-medium text-slate-900">{selectedEvent.title}</span>
                      <span className="text-slate-600">
                        {" "}
                        · {selectedEvent.city} ·{" "}
                        {formatEventDateTimeLine(selectedEvent.event_date, selectedEvent.event_time)}
                      </span>
                    </p>
                    <p className="text-sm text-slate-600">
                      {t("scanner.eventTicketsTotal", {
                        total: selectedEvent.tickets_total ?? 0,
                      })}
                      {" · "}
                      {t("scanner.eventTicketsPunched", {
                        count: selectedEvent.tickets_checked_in ?? 0,
                      })}
                    </p>
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {tab === "scan" ? (
            <div
              role="tabpanel"
              aria-labelledby="scanner-tab-scan"
              className="space-y-4"
            >
              {!selectedEventId ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50/90 px-4 py-5 text-sm text-amber-950">
                  <p className="leading-relaxed">{t("scanner.selectEventForScanTab")}</p>
                  <button
                    type="button"
                    onClick={() => setTab("event")}
                    className={`${btnPrimary} mt-4`}
                  >
                    {t("scanner.tabEvent")}
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-800/90">
                    {t("scanner.stepCamera")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={startScanner}
                      disabled={!selectedEventId || isScannerOpen}
                      className={btnPrimary}
                    >
                      {isScannerOpen ? t("scanner.scanning") : t("scanner.scan")}
                    </button>
                    <button
                      type="button"
                      onClick={stopScanner}
                      disabled={!isScannerOpen}
                      className={btnSecondary}
                    >
                      {t("scanner.stop")}
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-black shadow-inner ring-1 ring-slate-900/20">
                    <video
                      ref={videoRef}
                      className={isScannerOpen ? "block w-full max-h-[min(50vh,22rem)] object-cover" : "hidden"}
                      playsInline
                    />
                    {!isScannerOpen && (
                      <p className="px-4 py-10 text-center text-sm text-slate-400">
                        {t("scanner.cameraOff")}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {tab === "checked" ? (
            <div
              role="tabpanel"
              aria-labelledby="scanner-tab-checked"
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-800/90">
                  {t("scanner.checkedIn")}
                </h3>
                {selectedEventId ? (
                  <button
                    type="button"
                    onClick={() => void loadCheckedInTickets(selectedEventId, { refresh: true })}
                    disabled={loadingCheckedIn}
                    className={`${btnSecondary} inline-flex items-center justify-center p-2`}
                    aria-label={t("scanner.refreshList")}
                    aria-busy={refreshCheckedInOnly}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`h-5 w-5 ${refreshCheckedInOnly ? "animate-spin" : ""}`}
                      aria-hidden
                    >
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 21h5v-5" />
                    </svg>
                  </button>
                ) : null}
              </div>
              {!selectedEventId ? (
                <p className="rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-5 text-sm text-slate-600">
                  {t("scanner.selectEventForCheckedTab")}
                </p>
              ) : loadingCheckedIn ? (
                <ListLoading label={t("scanner.loadingCheckedIn")} className="py-8" />
              ) : checkedInTickets.length === 0 ? (
                <div className="flex min-h-[min(14rem,40vh)] items-center justify-center rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-8">
                  <p className="text-center text-sm text-slate-600">
                    {t("scanner.checkedEmpty")}
                  </p>
                </div>
              ) : (
                <ul className="max-h-[min(55vh,24rem)] space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/90 p-3 shadow-inner">
                  {checkedInTickets.map((row) => {
                    const contactLines = checkedInContactLines(row, t);
                    return (
                      <li key={row.uuid}>
                        <button
                          type="button"
                          onClick={() => goToConfirm(row.uuid)}
                          className="w-full rounded-lg px-2 py-2 text-left transition hover:bg-white hover:shadow-sm"
                        >
                          <span className="block break-all font-mono text-xs text-teal-800">{row.uuid}</span>
                          <span className="mt-1.5 block text-sm font-medium text-slate-900">
                            {row.buyer_name?.trim() || "—"}
                          </span>
                          {contactLines.length > 0 ? (
                            <div className="mt-1.5 flex flex-col gap-0.5">{contactLines}</div>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        {message ? (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {message}
          </p>
        ) : null}
      </AppCard>

      {isTicketModalOpen && modalEventId && modalUuid ? (
        <ScannerTicketConfirmModal
          eventId={modalEventId}
          uuid={modalUuid}
          onClose={closeTicketModal}
          onCheckInSuccess={() => void loadCheckedInTickets(modalEventId)}
        />
      ) : null}
    </AppShell>
  );
}

function ScannerPageSuspenseFallback() {
  const { t } = useLocaleContext();
  return (
    <AppShell maxWidth="max-w-2xl">
      <ListLoading label={t("common.loading")} />
    </AppShell>
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<ScannerPageSuspenseFallback />}>
      <ScannerPageContent />
    </Suspense>
  );
}
