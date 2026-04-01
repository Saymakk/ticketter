"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type EventItem = {
    id: string;
    title: string;
    city: string;
    event_date: string;
    is_active: boolean;
};

export default function AdminEventsPage() {
    const [events, setEvents] = useState<EventItem[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        async function run() {
            const res = await fetch("/api/admin/events", { cache: "no-store" });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error ?? "Ошибка");
                return;
            }
            setEvents(json.events ?? []);
        }
        run();
    }, []);

    return (
        <main style={{ padding: 16 }}>
            <h1>Мои мероприятия</h1>
            {error && <p style={{ color: "crimson" }}>{error}</p>}

            {events.length === 0 ? (
                <p>Нет назначенных мероприятий</p>
            ) : (
                <ul>
                    {events.map((ev) => (
                        <li key={ev.id}>
                            {ev.title} / {ev.city} / {ev.event_date}{" "}
                            <Link href={`/admin/events/${ev.id}/tickets`}>Билеты</Link>{" "}
                            <Link href={`/admin/events/${ev.id}/tickets/new`}>Создать билет</Link>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}