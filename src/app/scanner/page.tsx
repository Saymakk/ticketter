"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import type { Result } from "@zxing/library";
import AccountSettingsButton from "@/components/account-settings-button";
import LanguageSwitcher from "@/components/language-switcher";
import { useLocaleContext } from "@/components/locale-provider";
import {
  AppCard,
  AppShell,
  BackNav,
  btnPrimary,
  btnSecondary,
  ListLoading,
  selectClass,
} from "@/components/ui/app-shell";
import {
  isScannerFromPanelParam,
  scannerConfirmHref,
  SCANNER_FROM_PANEL_PARAM,
} from "@/lib/scanner/from-panel";

type EventItem = {
  id: string;
  title: string;
  city: string;
  event_date: string;
};

type CheckedInItem = {
  uuid: string;
  buyer_name: string | null;
  checked_in_at: string | null;
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

function ScannerPageContent() {
  const { t } = useLocaleContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPanel = isScannerFromPanelParam(searchParams.get(SCANNER_FROM_PANEL_PARAM));

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [message, setMessage] = useState("");

  const [loadingEvents, setLoadingEvents] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [checkedInTickets, setCheckedInTickets] = useState<CheckedInItem[]>([]);
  const [loadingCheckedIn, setLoadingCheckedIn] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const lastUuidRef = useRef("");
  const lastScanAtRef = useRef(0);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  useEffect(() => {
    loadEvents();
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function goToConfirm(uuid: string) {
    if (!selectedEventId) return;
    stopScanner();
    router.push(scannerConfirmHref(selectedEventId, uuid, fromPanel));
  }

  async function loadEvents() {
    setLoadingEvents(true);
    setMessage("");

    try {
      const res = await fetch("/api/scanner/events", { cache: "no-store" });
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
        setSelectedEventId(list[0].id);
      }
    } catch {
      setMessage(t("scanner.errLoadEventsNet"));
    } finally {
      setLoadingEvents(false);
    }
  }

  async function loadCheckedInTickets(eventId: string) {
    setLoadingCheckedIn(true);
    try {
      const res = await fetch(`/api/scanner/events/${eventId}/checked-in`, {
        cache: "no-store",
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

      setCheckedInTickets(json.tickets ?? []);
    } catch {
      setMessage(t("scanner.errLoadCheckedNet"));
    } finally {
      setLoadingCheckedIn(false);
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
      <div className="mx-auto -mt-5 mb-1 flex max-w-2xl items-center justify-end gap-3 px-4 sm:-mt-6 sm:px-6">
        <LanguageSwitcher />
        <AccountSettingsButton />
      </div>
      {fromPanel ? <BackNav href="/admin">{t("scanner.backPanel")}</BackNav> : null}
      <AppCard title={t("scanner.title")} subtitle={t("scanner.subtitle")}>
        <div className="space-y-8">
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
                    {ev.title} / {ev.city} / {ev.event_date}
                  </option>
                ))}
              </select>
            )}
            {selectedEvent && (
              <p className="mt-3 rounded-lg bg-teal-50/80 px-3 py-2 text-sm text-slate-700">
                <span className="font-medium text-slate-900">{selectedEvent.title}</span>
                <span className="text-slate-600">
                  {" "}
                  · {selectedEvent.city} · {selectedEvent.event_date}
                </span>
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-teal-800/90">
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

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-black shadow-inner">
              <video
                ref={videoRef}
                className={isScannerOpen ? "block w-full max-h-[320px] object-cover" : "hidden"}
                playsInline
              />
              {!isScannerOpen && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  {t("scanner.cameraOff")}
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-teal-800/90">
              {t("scanner.checkedIn")}
            </h3>
            {loadingCheckedIn ? (
              <ListLoading label={t("scanner.loadingEvents")} className="py-6" />
            ) : checkedInTickets.length === 0 ? (
              <p className="text-sm text-slate-600">{t("scanner.checkedEmpty")}</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                {checkedInTickets.map((row) => (
                  <li key={row.uuid}>
                    <button
                      type="button"
                      onClick={() => goToConfirm(row.uuid)}
                      className="w-full text-left underline decoration-teal-700/30 hover:text-teal-900"
                    >
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {row.buyer_name?.trim() || "—"}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-xs text-teal-700">
                        {row.uuid}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {message && (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {message}
          </p>
        )}
      </AppCard>
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
