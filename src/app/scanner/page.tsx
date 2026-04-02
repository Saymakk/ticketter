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
    const [events, setEvents] = useState<EventItem[]>([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [message, setMessage] = useState("");

    const [loadingEvents, setLoadingEvents] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [checkingIn, setCheckingIn] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

    const [checkedInTickets, setCheckedInTickets] = useState<CheckedInItem[]>([]);
    const [loadingCheckedIn, setLoadingCheckedIn] = useState(false);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const controlsRef = useRef<IScannerControls | null>(null);
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);

    // Анти-спам сканов
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
        // При смене мероприятия:
        // - закрыть сканер
        // - очистить текущий найденный билет
        // - загрузить уже пробитые билеты
        stopScanner();
        setActiveTicket(null);
        setModalOpen(false);
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
        if (isScannerOpen) {
            return;
        }

        setMessage("");
        setIsScannerOpen(true);

        try {
            const reader = new BrowserMultiFormatReader();
            readerRef.current = reader;

            const devices = await BrowserMultiFormatReader.listVideoInputDevices();
            const deviceId = devices[0]?.deviceId;

            if (!deviceId) {
                setMessage("Камера не найдена");
                setIsScannerOpen(false);
                return;
            }

            const controls = await reader.decodeFromVideoDevice(
                deviceId,
                videoRef.current,
                async (result) => {
                    if (!result) return;

                    const now = Date.now();
                    if (now - lastScanAtRef.current < 700) return;
                    lastScanAtRef.current = now;

                    const uuid = result.getText().trim();
                    if (!uuid) return;
                    if (uuid === lastUuidRef.current) return;

                    lastUuidRef.current = uuid;

                    // Как только нашли билет — сразу закрываем камеру
                    stopScanner();

                    await openTicketModalByUuid(uuid);
                }
            );

            controlsRef.current = controls;
        } catch {
            setMessage("Не удалось запустить сканер. Проверь доступ к камере.");
            setIsScannerOpen(false);
        }
    }

    function stopScanner() {
        controlsRef.current?.stop();
        controlsRef.current = null;
        readerRef.current = null;
        setIsScannerOpen(false);
    }

    async function openTicketModalByUuid(uuid: string) {
        if (!selectedEventId) return;

        try {
            const res = await fetch(
                `/api/scanner/tickets/by-uuid?uuid=${encodeURIComponent(uuid)}&eventId=${encodeURIComponent(selectedEventId)}`,
                { cache: "no-store" }
            );

            const json = (await safeReadJson<{ ticket?: Ticket } & ApiError>(res)) ?? {};

            if (!res.ok || !json.ticket) {
                setActiveTicket(null);
                setMessage(json.error ?? "Билет не найден в выбранном мероприятии");
                return;
            }

            setActiveTicket(json.ticket);
            setModalOpen(true);
            setMessage(
                json.ticket.status === "checked_in"
                    ? "Билет уже пробит"
                    : "Билет найден, можно пробить"
            );
        } catch {
            setMessage("Сетевая ошибка при загрузке билета");
        }
    }

    async function handleCheckIn() {
        if (!activeTicket || !selectedEventId) return;

        setCheckingIn(true);
        setMessage("Пробиваем билет...");

        try {
            const res = await fetch("/api/scanner/check-in", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uuid: activeTicket.uuid, eventId: selectedEventId }),
            });

            const json =
                (await safeReadJson<{ success?: boolean; message?: string } & ApiError>(res)) ?? {};

            if (!res.ok) {
                setMessage(json.error ?? `Ошибка пробивки (HTTP ${res.status})`);
                return;
            }

            setMessage(json.message ?? "Операция выполнена");

            if (json.success) {
                const updated: Ticket = { ...activeTicket, status: "checked_in" };
                setActiveTicket(updated);
                await loadCheckedInTickets(selectedEventId);
            }
        } catch {
            setMessage("Сетевая ошибка при пробивке");
        } finally {
            setCheckingIn(false);
        }
    }

    return (
        <main style={{ maxWidth: 820, margin: "20px auto", padding: 16 }}>
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
                        onChange={(e) => setSelectedEventId(e.target.value)}
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

            {selectedEvent && (
                <p style={{ marginTop: 10 }}>
                    Выбрано: <b>{selectedEvent.title}</b> ({selectedEvent.city}, {selectedEvent.event_date})
                </p>
            )}

            <section style={{ marginTop: 16 }}>
                <h3>2) Сканирование QR</h3>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    <button
                        type="button"
                        onClick={startScanner}
                        disabled={!selectedEventId || isScannerOpen}
                    >
                        {isScannerOpen ? "Сканер открыт..." : "Сканировать"}
                    </button>

                    <button
                        type="button"
                        onClick={stopScanner}
                        disabled={!isScannerOpen}
                    >
                        Остановить камеру
                    </button>
                </div>

                <video
                    ref={videoRef}
                    style={{
                        display: isScannerOpen ? "block" : "none",
                        width: "100%",
                        maxWidth: 460,
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "#000",
                    }}
                />

                {!isScannerOpen && (
                    <p style={{ color: "#666" }}>
                        Камера выключена. Нажми кнопку «Сканировать», чтобы открыть ее.
                    </p>
                )}
            </section>

            <section style={{ marginTop: 18 }}>
                <h3>Уже пробитые билеты</h3>
                {loadingCheckedIn ? (
                    <p>Загрузка...</p>
                ) : checkedInTickets.length === 0 ? (
                    <p>Пока нет пробитых билетов</p>
                ) : (
                    <ul style={{ display: "grid", gap: 6, paddingLeft: 18 }}>
                        {checkedInTickets.map((t) => (
                            <li key={t.uuid}>
                                <button
                                    type="button"
                                    onClick={() => openTicketModalByUuid(t.uuid)}
                                    style={{
                                        border: "none",
                                        background: "transparent",
                                        color: "#0b57d0",
                                        textDecoration: "underline",
                                        cursor: "pointer",
                                        padding: 0,
                                    }}
                                >
                                    {t.uuid}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {message && <p style={{ marginTop: 12 }}>{message}</p>}

            {modalOpen && activeTicket && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.45)",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        paddingTop: "8vh",
                        zIndex: 1000,
                    }}
                >
                    <div
                        style={{
                            width: "min(560px, calc(100vw - 24px))",
                            background: "#fff",
                            borderRadius: 10,
                            padding: 16,
                            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                        }}
                    >
                        <h3 style={{ marginTop: 0 }}>
                            {activeTicket.status === "checked_in" ? "Билет уже пробит" : "Билет найден"}
                        </h3>

                        <p><b>UUID:</b> {activeTicket.uuid}</p>
                        <p><b>ФИО:</b> {activeTicket.buyer_name ?? "-"}</p>
                        <p><b>Телефон:</b> {activeTicket.phone ?? "-"}</p>
                        <p><b>Тип билета:</b> {activeTicket.ticket_type ?? "-"}</p>
                        <p><b>Город/регион:</b> {activeTicket.region ?? "-"}</p>
                        <p><b>Дата:</b> {new Date(activeTicket.created_at).toLocaleString()}</p>
                        <p><b>Статус:</b> {activeTicket.status}</p>

                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                            <button
                                type="button"
                                onClick={handleCheckIn}
                                disabled={checkingIn || activeTicket.status === "checked_in"}
                            >
                                {checkingIn ? "Пробиваем..." : "Пробить билет"}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setModalOpen(false);
                                    setActiveTicket(null);
                                }}
                            >
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}