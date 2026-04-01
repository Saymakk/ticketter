"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Ticket = {
    uuid: string;
    buyer_name: string | null;
    phone: string | null;
    ticket_type: string | null;
    region: string | null;
    status: string;
    created_at: string;
    custom_data: Record<string, unknown>;
};

export default function TicketCardPage() {
    const params = useParams<{ ticketId: string }>();
    const ticketUuid = params.ticketId;
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            const res = await fetch(`/api/tickets/${ticketUuid}`, { cache: "no-store" });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error ?? "Ошибка");
                return;
            }
            setTicket(json.ticket);
        }
        if (ticketUuid) load();
    }, [ticketUuid]);

    if (error) return <main style={{ padding: 16 }}><p style={{ color: "crimson" }}>{error}</p></main>;
    if (!ticket) return <main style={{ padding: 16 }}><p>Загрузка...</p></main>;

    return (
        <main style={{ padding: 16 }}>
            <h1>Карточка билета</h1>
            <p>UUID: {ticket.uuid}</p>
            <p>ФИО: {ticket.buyer_name ?? "-"}</p>
            <p>Телефон: {ticket.phone ?? "-"}</p>
            <p>Тип: {ticket.ticket_type ?? "-"}</p>
            <p>Регион: {ticket.region ?? "-"}</p>
            <p>Статус: {ticket.status}</p>

            <a href={`/api/tickets/${ticket.uuid}/qr`} download>
                Скачать QR (PNG)
            </a>
        </main>
    );
}