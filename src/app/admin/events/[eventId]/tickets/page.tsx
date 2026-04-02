"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AppCard,
  AppShell,
  BackNav,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputClass,
  linkClass,
  selectClass,
} from "@/components/ui/app-shell";

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

  const allSelected =
    tickets.length > 0 && selected.length === tickets.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(tickets.map((t) => t.uuid));
    }
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
    <AppShell maxWidth="max-w-4xl">
      <BackNav href="/admin/events">К мероприятиям</BackNav>
      <AppCard
        title="Билеты мероприятия"
        subtitle="Редактирование, удаление, массовая выгрузка QR."
      >
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={tickets.length === 0}
              className={btnSecondary}
            >
              {allSelected ? "Снять выбор" : "Выбрать все"}
            </button>
            <button
              type="button"
              onClick={downloadSelectedQrZip}
              disabled={loadingZip || selected.length === 0}
              className={btnPrimary}
            >
              {loadingZip ? "Скачиваем…" : "Скачать QR (zip)"}
            </button>
            <span className="text-sm text-slate-600">Выбрано: {selected.length}</span>
          </div>
          <Link
            href={`/admin/events/${eventId}/tickets/new`}
            className="inline-flex justify-center rounded-lg bg-teal-600 px-4 py-2 text-center text-sm font-medium text-white shadow-sm hover:bg-teal-700"
          >
            Новый билет
          </Link>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        {tickets.length === 0 ? (
          <p className="text-sm text-slate-600">Пока билетов нет</p>
        ) : (
          <ul className="space-y-4">
            {tickets.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm"
              >
                {editTicketId === t.id ? (
                  <div className="grid gap-3 sm:max-w-md">
                    <input
                      className={inputClass}
                      value={editBuyerName}
                      onChange={(e) => setEditBuyerName(e.target.value)}
                      placeholder="ФИО"
                    />
                    <input
                      className={inputClass}
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Телефон"
                    />
                    <select
                      className={selectClass}
                      value={editType}
                      onChange={(e) =>
                        setEditType(e.target.value as "vip" | "standard" | "vip+")
                      }
                    >
                      <option value="standard">standard</option>
                      <option value="vip">vip</option>
                      <option value="vip+">vip+</option>
                    </select>
                    <input
                      className={inputClass}
                      value={editRegion}
                      onChange={(e) => setEditRegion(e.target.value)}
                      placeholder="Регион"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={saveEditTicket} className={btnPrimary}>
                        Сохранить
                      </button>
                      <button type="button" onClick={cancelEditTicket} className={btnSecondary}>
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        checked={selected.includes(t.uuid)}
                        onChange={() => toggleSelected(t.uuid)}
                      />
                      <div>
                        <p className="font-mono text-xs text-slate-500">{t.uuid}</p>
                        <p className="font-medium text-slate-900">
                          {t.buyer_name ?? "—"} · {t.phone ?? "—"}
                        </p>
                        <p className="text-sm text-slate-600">
                          {t.ticket_type ?? "—"} ·{" "}
                          <span
                            className={
                              t.status === "checked_in" ? "text-teal-700" : "text-slate-500"
                            }
                          >
                            {t.status}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/events/${eventId}/tickets/${t.uuid}`}
                        className={`${linkClass} rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm no-underline`}
                      >
                        Карточка
                      </Link>
                      <button
                        type="button"
                        onClick={() => startEditTicket(t)}
                        className={btnSecondary}
                      >
                        Изменить
                      </button>
                      <button type="button" onClick={() => deleteTicket(t.id)} className={btnDanger}>
                        Удалить
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </AppCard>
    </AppShell>
  );
}
