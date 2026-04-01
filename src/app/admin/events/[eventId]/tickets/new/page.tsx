"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type EventField = {
    id: string;
    field_key: string;
    field_label: string;
    field_type: string;
    is_required: boolean;
};

export default function NewTicketPage() {
    const params = useParams<{ eventId: string }>();
    const router = useRouter();
    const eventId = params.eventId;

    const [fields, setFields] = useState<EventField[]>([]);
    const [ticketType, setTicketType] = useState<"vip" | "standard" | "vip+">("standard");
    const [buyerName, setBuyerName] = useState("");
    const [phone, setPhone] = useState("");
    const [region, setRegion] = useState("");
    const [customData, setCustomData] = useState<Record<string, any>>({});
    const [result, setResult] = useState("");

    useEffect(() => {
        async function loadFields() {
            const res = await fetch(`/api/admin/events/${eventId}/fields`, { cache: "no-store" });
            const json = await res.json();
            if (!res.ok) {
                setResult(`Ошибка: ${json.error ?? "Не удалось загрузить поля"}`);
                return;
            }
            setFields(json.fields ?? []);
        }
        if (eventId) loadFields();
    }, [eventId]);

    function updateCustomField(key: string, value: any) {
        setCustomData((prev) => ({ ...prev, [key]: value }));
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault();

        for (const f of fields) {
            if (f.is_required && (customData[f.field_key] === undefined || customData[f.field_key] === "")) {
                setResult(`Заполни обязательное поле: ${f.field_label}`);
                return;
            }
        }

        const res = await fetch(`/api/admin/events/${eventId}/tickets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                buyerName,
                phone,
                ticketType,
                region,
                customData,
            }),
        });

        const json = await res.json();
        if (!res.ok) {
            setResult(`Ошибка: ${json.error ?? "Не удалось создать билет"}`);
            return;
        }

        setResult(`Билет создан. UUID: ${json.ticket.uuid}`);
        router.push(`/admin/events/${eventId}/tickets`);
    }

    return (
        <main style={{ maxWidth: 700, margin: "24px auto", padding: 16 }}>
            <h1>Создание билета</h1>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
                <input placeholder="ФИО покупателя" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
                <input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />

                <select value={ticketType} onChange={(e) => setTicketType(e.target.value as any)}>
                    <option value="standard">standard</option>
                    <option value="vip">vip</option>
                    <option value="vip+">vip+</option>
                </select>

                <input placeholder="Регион (north/south/west/east)" value={region} onChange={(e) => setRegion(e.target.value)} />

                <h3>Поля мероприятия</h3>
                {fields.map((f) => (
                    <label key={f.id}>
                        {f.field_label} {f.is_required ? "*" : ""}
                        <input
                            onChange={(e) => updateCustomField(f.field_key, e.target.value)}
                            required={f.is_required}
                        />
                    </label>
                ))}

                <button type="submit">Создать билет</button>
            </form>

            {result && <p style={{ marginTop: 12 }}>{result}</p>}
        </main>
    );
}