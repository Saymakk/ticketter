"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

type EventItem = {
    id: string;
    title: string;
    city: string;
    event_date: string;
};

type Ticket = {
    id: number;
    uuid: string;
    event_id: string;
    buyer_name: string | null;
    phone: string | null;
    ticket_type: string | null;
    region: string | null;
    status: "new" | "checked_in";
    created_at: string;
    custom_data: Record<string, unknown>;
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
    const [events, setEvents] = useState<EventItem[]>([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [message, setMessage] = useState("");
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [checkingIn, setCheckingIn] = useState(false);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const controlsRef = useRef<IScannerControls | null>(null);
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);

    // Anti-spam refs, чтобы не дергать API слишком часто
    const lastUuidRef = useRef("");
    const lastScanAtRef = useRef(0);

    const selectedEvent = useMemo(
        () => events.find((e) => e.id === selectedEventId) ?? null,
        [events, selectedEventId]
    );

    useEffect(() => {
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

        loadEvents();
    }, []);

    useEffect(() => {
        if (!selectedEventId || !videoRef.current) return;

        let isStopped = false;

        async function startScanner() {
            try {
                const reader = new BrowserMultiFormatReader();
                readerRef.current = reader;

                const devices = await BrowserMultiFormatReader.listVideoInputDevices();
                const deviceId = devices[0]?.deviceId;

                if (!deviceId) {
                    setMessage("Камера не найдена");
                    return;
                }

                const controls = await reader.decodeFromVideoDevice(
                    deviceId,
                    videoRef.current!,
                    async (result) => {
                        if (isStopped || !result) return;

                        const now = Date.now();
                        if (now - lastScanAtRef.current < 700) return;
                        lastScanAtRef.current = now;

                        const uuid = result.getText().trim();
                        if (!uuid) return;
                        if (uuid === lastUuidRef.current) return;

                        lastUuidRef.current = uuid;

                        const res = await fetch(
                            `/api/scanner/tickets/by-uuid?uuid=${encodeURIComponent(uuid)}&eventId=${encodeURIComponent(selectedEventId)}`,
                            { cache: "no-store" }
                        );

                        const json = (await safeReadJson<{ ticket?: Ticket } & ApiError>(res)) ?? {};

                        if (!res.ok || !json.ticket) {
                            setTicket(null);
                            setMessage(json.error ?? "Билет не найден в выбранном мероприятии");
                            return;
                        }

                        setTicket(json.ticket);
                        setMessage(
                            json.ticket.status === "checked_in"
                                ? "Билет уже пробит"
                                : "Билет найден, можно пробить"
                        );
                    }
                );

                controlsRef.current = controls;
            } catch {
                setMessage("Не удалось запустить сканер. Проверь доступ к камере.");
            }
        }

        startScanner();

        return () => {
            isStopped = true;
            controlsRef.current?.stop();
            controlsRef.current = null;
            readerRef.current = null;
            lastUuidRef.current = "";
            lastScanAtRef.current = 0;
        };
    }, [selectedEventId]);

    async function handleCheckIn() {
        if (!ticket || !selectedEventId) return;

        setCheckingIn(true);
        setMessage("Пробиваем билет...");

        try {
            const res = await fetch("/api/scanner/check-in", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uuid: ticket.uuid, eventId: selectedEventId }),
            });

            const json = (await safeReadJson<{ success?: boolean; message?: string } & ApiError>(res)) ?? {};

            if (!res.ok) {
                setMessage(json.error ?? `Ошибка пробивки (HTTP ${res.status})`);
                return;
            }

            setMessage(json.message ?? "Операция выполнена");

            if (json.success) {
                setTicket({ ...ticket, status: "checked_in" });
            }
        } catch {
            setMessage("Сетевая ошибка при пробивке");
        } finally {
            setCheckingIn(false);
        }
    }

    return (
        <main style={{ maxWidth: 760, margin: "20px auto", padding: 16 }}>
            <h1>Сканер билетов</h1>

            <section style={{ marginTop: 12 }}>
                <h3>1) Выбор мероприятия</h3>
                {loadingEvents ? (
                    <p>Загрузка мероприятий...</p>
                ) : events.length === 0 ? (
                    <p>Нет активных мероприятий, доступных для сканирования</p>
                ) : (
                    <select
                        value={selectedEventId}
                        onChange={(e) => {
                            setSelectedEventId(e.target.value);
                            setTicket(null);
                            setMessage("");
                            lastUuidRef.current = "";
                            lastScanAtRef.current = 0;
                        }}
                    >
                        <option value="">Выбери мероприятие</option>
                        {events.map((ev) => (
                            <option key={ev.id} value={ev.id}>
                                {ev.title} / {ev.city} / {ev.event_date}
                            </option>
                        ))}
                    </select>
                )}
            </section>

            <section style={{ marginTop: 16 }}>
                <h3>2) Сканирование QR</h3>
                <video
                    ref={videoRef}
                    style={{
                        width: "100%",
                        maxWidth: 440,
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "#000",
                    }}
                />
            </section>

            {selectedEvent && (
                <p style={{ marginTop: 10 }}>
                    Выбрано: <b>{selectedEvent.title}</b> ({selectedEvent.city}, {selectedEvent.event_date})
                </p>
            )}

            {ticket && (
                <section style={{ marginTop: 14, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
                    <h3>Информация о билете</h3>
                    <p>ID: {ticket.uuid}</p>
                    <p>Кто купил: {ticket.buyer_name ?? "-"}</p>
                    <p>Телефон: {ticket.phone ?? "-"}</p>
                    <p>Тип: {ticket.ticket_type ?? "-"}</p>
                    <p>Город/регион: {ticket.region ?? "-"}</p>
                    <p>Дата: {new Date(ticket.created_at).toLocaleString()}</p>
                    <p>Статус: {ticket.status}</p>

                    <button
                        type="button"
                        onClick={handleCheckIn}
                        disabled={checkingIn || ticket.status === "checked_in"}
                    >
                        {checkingIn ? "Пробиваем..." : "Пробить билет"}
                    </button>

                    {ticket.status === "checked_in" && <p>Билет уже пробит</p>}
                </section>
            )}

            {message && <p style={{ marginTop: 12 }}>{message}</p>}
        </main>
    );
}