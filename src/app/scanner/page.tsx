"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import type { Result } from "@zxing/library";
import {
  AppCard,
  AppShell,
  BackNav,
  btnPrimary,
  btnSecondary,
  selectClass,
} from "@/components/ui/app-shell";

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

export default function ScannerPage() {
  const router = useRouter();

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
    router.push(
      `/scanner/confirm?eventId=${encodeURIComponent(selectedEventId)}&uuid=${encodeURIComponent(uuid)}`
    );
  }

  async function loadEvents() {
    setLoadingEvents(true);
    setMessage("");

    try {
      const res = await fetch("/api/scanner/events", { cache: "no-store" });
      const json = (await safeReadJson<{ events?: EventItem[] } & ApiError>(res)) ?? {};

      if (!res.ok) {
        setEvents([]);
        setMessage(json.error ?? `Ошибка загрузки мероприятий (HTTP ${res.status})`);
        return;
      }

      const list = json.events ?? [];
      setEvents(list);

      if (list.length === 1) {
        setSelectedEventId(list[0].id);
      }
    } catch {
      setMessage("Сетевая ошибка при загрузке мероприятий");
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
        setMessage(json.error ?? `Ошибка загрузки пробитых билетов (HTTP ${res.status})`);
        return;
      }

      setCheckedInTickets(json.tickets ?? []);
    } catch {
      setMessage("Сетевая ошибка при загрузке пробитых билетов");
    } finally {
      setLoadingCheckedIn(false);
    }
  }

  async function startScanner() {
    if (!selectedEventId) {
      setMessage("Сначала выбери мероприятие");
      return;
    }
    if (!videoRef.current) {
      setMessage("Видео-элемент недоступен");
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
        setMessage(
          "Открой сайт по HTTPS (Vercel или туннель). По http:// камера на телефоне часто блокируется."
        );
        setIsScannerOpen(false);
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("Браузер не поддерживает доступ к камере.");
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
          setMessage("Камера не найдена. Разреши доступ и открой сайт по HTTPS.");
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
      setMessage("Не удалось запустить сканер. Проверь HTTPS и разрешение на камеру.");
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
      <BackNav href="/admin">К панели</BackNav>
      <AppCard
        title="Сканер билетов"
        subtitle="Выберите мероприятие, затем нажмите «Сканировать»."
      >
        <div className="space-y-8">
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-teal-800/90">
              1. Мероприятие
            </h3>
            {loadingEvents ? (
              <p className="text-sm text-slate-600">Загрузка…</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-slate-600">Нет активных мероприятий для сканирования</p>
            ) : (
              <select
                className={selectClass}
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
              >
                <option value="">Выберите мероприятие</option>
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
              2. Камера
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startScanner}
                disabled={!selectedEventId || isScannerOpen}
                className={btnPrimary}
              >
                {isScannerOpen ? "Сканирование…" : "Сканировать"}
              </button>
              <button
                type="button"
                onClick={stopScanner}
                disabled={!isScannerOpen}
                className={btnSecondary}
              >
                Остановить
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
                  Камера выключена. Нажмите «Сканировать».
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-teal-800/90">
              Пробитые билеты
            </h3>
            {loadingCheckedIn ? (
              <p className="text-sm text-slate-600">Загрузка…</p>
            ) : checkedInTickets.length === 0 ? (
              <p className="text-sm text-slate-600">Пока нет</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                {checkedInTickets.map((t) => (
                  <li key={t.uuid}>
                    <button
                      type="button"
                      onClick={() => goToConfirm(t.uuid)}
                      className="w-full truncate text-left font-mono text-xs text-teal-700 underline decoration-teal-700/30 hover:text-teal-900"
                    >
                      {t.uuid}
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
