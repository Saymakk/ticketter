"use client";

import { FormEvent, useEffect, useState } from "react";

type EventItem = {
  id: string;
  title: string;
  city: string;
  event_date: string;
  is_active: boolean;
};

type UserItem = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "super_admin" | "admin" | "scanner";
  region: string | null;
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

export default function SuperAdminEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [eventDate, setEventDate] = useState("");

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const [eventsRes, usersRes] = await Promise.all([
        fetch("/api/super-admin/events", { cache: "no-store" }),
        fetch("/api/super-admin/users", { cache: "no-store" }),
      ]);

      const eventsJson =
        (await safeReadJson<{ events?: EventItem[] } & ApiError>(eventsRes)) ?? {};
      const usersJson =
        (await safeReadJson<{ users?: UserItem[] } & ApiError>(usersRes)) ?? {};

      if (eventsRes.ok) {
        setEvents(eventsJson.events ?? []);
      } else {
        setEvents([]);
        setResult(
          `Ошибка загрузки мероприятий: ${eventsJson.error ?? `HTTP ${eventsRes.status}`}`
        );
      }

      if (usersRes.ok) {
        setUsers(usersJson.users ?? []);
      } else {
        setUsers([]);
        setResult(
          `Ошибка загрузки пользователей: ${usersJson.error ?? `HTTP ${usersRes.status}`}`
        );
      }
    } catch {
      setResult("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function onCreateEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult("Создаем мероприятие...");

    try {
      const res = await fetch("/api/super-admin/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, city, eventDate }),
      });

      const json = (await safeReadJson<ApiError>(res)) ?? {};

      if (!res.ok) {
        setResult(`Ошибка: ${json.error ?? `HTTP ${res.status}`}`);
        return;
      }

      setResult("Мероприятие создано");
      setTitle("");
      setCity("");
      setEventDate("");
      await loadData();
    } catch {
      setResult("Сетевая ошибка при создании мероприятия");
    }
  }

  async function onAssign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult("Назначаем доступ...");

    try {
      const res = await fetch("/api/super-admin/events/assign-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          eventId: selectedEventId,
        }),
      });

      const json = (await safeReadJson<ApiError>(res)) ?? {};

      if (!res.ok) {
        setResult(`Ошибка: ${json.error ?? `HTTP ${res.status}`}`);
        return;
      }

      setResult("Доступ назначен");
    } catch {
      setResult("Сетевая ошибка при назначении доступа");
    }
  }

  function startEditEvent(ev: EventItem) {
    setEditEventId(ev.id);
    setEditTitle(ev.title);
    setEditCity(ev.city);
    setEditDate(ev.event_date);
    setEditIsActive(ev.is_active);
  }

  function cancelEditEvent() {
    setEditEventId(null);
    setEditTitle("");
    setEditCity("");
    setEditDate("");
    setEditIsActive(true);
  }

  async function saveEditEvent() {
    if (!editEventId) return;
    setResult("Сохраняем изменения мероприятия...");

    const res = await fetch(`/api/super-admin/events/${editEventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        city: editCity,
        eventDate: editDate,
        isActive: editIsActive,
      }),
    });

    const json = (await safeReadJson<ApiError>(res)) ?? {};
    if (!res.ok) {
      setResult(`Ошибка: ${json.error ?? `HTTP ${res.status}`}`);
      return;
    }

    setResult("Мероприятие обновлено");
    cancelEditEvent();
    await loadData();
  }

  async function deleteEvent(eventId: string) {
    const ok = window.confirm("Удалить мероприятие? Это удалит связанные данные (если FK с cascade).");
    if (!ok) return;

    setResult("Удаляем мероприятие...");
    const res = await fetch(`/api/super-admin/events/${eventId}`, {
      method: "DELETE",
    });

    const json = (await safeReadJson<ApiError>(res)) ?? {};
    if (!res.ok) {
      setResult(`Ошибка: ${json.error ?? `HTTP ${res.status}`}`);
      return;
    }

    setResult("Мероприятие удалено");
    await loadData();
  }

  return (
    <main style={{ maxWidth: 820, margin: "24px auto", padding: 16 }}>
      <h1>Super Admin / Мероприятия</h1>

      <section style={{ marginTop: 16 }}>
        <h2>Создать мероприятие</h2>
        <form onSubmit={onCreateEvent} style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="Название (например Inspire Astana 30 May)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <input
            placeholder="Город (например Астана)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            Создать
          </button>
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Назначить пользователя на мероприятие</h2>
        <form onSubmit={onAssign} style={{ display: "grid", gap: 10 }}>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            required
          >
            <option value="">Выбери мероприятие</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} / {ev.city} / {ev.event_date}
              </option>
            ))}
          </select>

          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
          >
            <option value="">Выбери пользователя</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name ?? "Без имени"} ({u.role}) {u.phone ? ` / ${u.phone}` : ""}
              </option>
            ))}
          </select>

          <button type="submit" disabled={loading}>
            Назначить доступ
          </button>
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Список мероприятий</h2>
        {events.length === 0 ? (
          <p>Пока нет мероприятий</p>
        ) : (
            <ul style={{ display: "grid", gap: 10, paddingLeft: 18 }}>
              {events.map((ev) => (
                  <li key={ev.id}>
                    {editEventId === ev.id ? (
                        <div style={{ display: "grid", gap: 6, maxWidth: 420 }}>
                          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                          <input value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                          <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                          <label>
                            <input
                                type="checkbox"
                                checked={editIsActive}
                                onChange={(e) => setEditIsActive(e.target.checked)}
                            />{" "}
                            Активно
                          </label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" onClick={saveEditEvent}>Сохранить</button>
                            <button type="button" onClick={cancelEditEvent}>Отмена</button>
                          </div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span>
            {ev.title} | {ev.city} | {ev.event_date} | {ev.is_active ? "active" : "inactive"}
          </span>
                          <button type="button" onClick={() => startEditEvent(ev)}>Редактировать</button>
                          <button type="button" onClick={() => deleteEvent(ev.id)}>Удалить</button>
                        </div>
                    )}
                  </li>
              ))}
            </ul>
        )}
      </section>

      {result && <p style={{ marginTop: 16 }}>{result}</p>}
    </main>
  );
}