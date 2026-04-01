"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

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
    const params = useParams<{ eventId: string }>();
    const eventId = params.eventId;

    const [tickets, setTickets] = useState<TicketItem[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [error, setError] = useState("");
    const [loadingZip, setLoadingZip] = useState(false);

    const [editTicketId, setEditTicketId] = useState<number | null>(null);
    const [editBuyerName, setEditBuyerName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editType, setEditType] = useState<"vip" | "standard" | "vip+">("standard");
    const [editRegion, setEditRegion] = useState("");

    useEffect(() => {
        if (eventId) loadTickets();
    }, [eventId]);

    async function loadTickets() {
        setError("");
        const res = await fetch(`/api/admin/events/${eventId}/tickets`, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) {
            setError(json.error ?? "Ошибка загрузки билетов");
            return;
        }

        setTickets(json.tickets ?? []);
    }

    function startEditTicket(t: TicketItem) {
        setEditTicketId(t.id);
        setEditBuyerName(t.buyer_name ?? "");
        setEditPhone(t.phone ?? "");
        setEditType((t.ticket_type as "vip" | "standard" | "vip+") ?? "standard");
        setEditRegion(t.region ?? "");
    }

    function cancelEditTicket() {
        setEditTicketId(null);
        setEditBuyerName("");
        setEditPhone("");
        setEditType("standard");
        setEditRegion("");
    }

    async function saveEditTicket() {
        if (!editTicketId) return;

        const res = await fetch(`/api/admin/events/${eventId}/tickets/${editTicketId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                buyerName: editBuyerName || null,
                phone: editPhone || null,
                ticketType: editType,
                region: editRegion || null,
            }),
        });

        const json = await res.json();
        if (!res.ok) {
            setError(json.error ?? "Ошибка обновления билета");
            return;
        }

        cancelEditTicket();
        await loadTickets();
    }

    async function deleteTicket(ticketId: number) {
        const ok = window.confirm("Удалить билет?");
        if (!ok) return;

        const res = await fetch(`/api/admin/events/${eventId}/tickets/${ticketId}`, {
            method: "DELETE",
        });

        const json = await res.json();
        if (!res.ok) {
            setError(json.error ?? "Ошибка удаления билета");
            return;
        }

        await loadTickets();
    }

    function toggleSelected(uuid: string) {
        setSelected((prev) =>
            prev.includes(uuid) ? prev.filter((x) => x !== uuid) : [...prev, uuid]
        );
    }

    async function downloadSelectedQrZip() {
        if (selected.length === 0) {
            setError("Выбери хотя бы один билет");
            return;
        }

        setLoadingZip(true);
        setError("");

        try {
            const res = await fetch("/api/tickets/qr-bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uuids: selected }),
            });

            if (!res.ok) {
                const json = await res.json();
                setError(json.error ?? "Ошибка скачивания архива");
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
            setError("Сетевая ошибка при скачивании архива");
        } finally {
            setLoadingZip(false);
        }
    }

    return (
        <main style={{ padding: 16 }}>
            <h1>Билеты мероприятия</h1>

            <div style={{ marginBottom: 12 }}>
                <button onClick={downloadSelectedQrZip} disabled={loadingZip || selected.length === 0}>
                    {loadingZip ? "Скачиваем..." : "Скачать выбранные QR (zip)"}
                </button>
                <span style={{ marginLeft: 10 }}>Выбрано: {selected.length}</span>
            </div>

            {error && <p style={{ color: "crimson" }}>{error}</p>}

            {tickets.length === 0 ? (
                <p>Пока билетов нет</p>
            ) : (
                <ul style={{ display: "grid", gap: 8, paddingLeft: 18 }}>
                    {tickets.map((t) => (
                        <li key={t.id}>
                            {editTicketId === t.id ? (
                                <div style={{ display: "grid", gap: 6, maxWidth: 460 }}>
                                    <input value={editBuyerName} onChange={(e) => setEditBuyerName(e.target.value)} placeholder="ФИО" />
                                    <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Телефон" />
                                    <select value={editType} onChange={(e) => setEditType(e.target.value as "vip" | "standard" | "vip+")}>
                                        <option value="standard">standard</option>
                                        <option value="vip">vip</option>
                                        <option value="vip+">vip+</option>
                                    </select>
                                    <input value={editRegion} onChange={(e) => setEditRegion(e.target.value)} placeholder="Регион" />
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button type="button" onClick={saveEditTicket}>Сохранить</button>
                                        <button type="button" onClick={cancelEditTicket}>Отмена</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <label style={{ marginRight: 8 }}>
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(t.uuid)}
                                            onChange={() => toggleSelected(t.uuid)}
                                        />
                                    </label>

                                    {t.uuid} | {t.buyer_name ?? "-"} | {t.phone ?? "-"} | {t.ticket_type ?? "-"} | {t.status}{" "}
                                    <Link href={`/admin/events/${eventId}/tickets/${t.uuid}`}>Открыть карточку</Link>{" "}
                                    <button type="button" onClick={() => startEditTicket(t)}>Редактировать</button>{" "}
                                    <button type="button" onClick={() => deleteTicket(t.id)}>Удалить</button>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}