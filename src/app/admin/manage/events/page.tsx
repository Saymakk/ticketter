"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  AppCard,
  AppSection,
  AppShell,
  BackNav,
  btnDanger,
  btnPrimary,
  btnSecondary,
  FormStack,
  inputClass,
  selectClass,
} from "@/components/ui/app-shell";

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
  role: "user";
  region: string | null;
};

type ApiError = { error?: string };

type DraftField = {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: "text" | "textarea" | "select";
  isRequired: boolean;
  optionsText: string;
};

async function safeReadJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

type ManageTab = "create" | "assign" | "list";

export default function ManageEventsPage() {
  const [activeTab, setActiveTab] = useState<ManageTab>("create");
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

  const [draftFields, setDraftFields] = useState<DraftField[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const [eventsRes, usersRes] = await Promise.all([
        fetch("/api/super-admin/events", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
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

  useEffect(() => {
    if (activeTab === "assign" || activeTab === "list") {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- обновляем списки при входе на вкладку
  }, [activeTab]);

  function addDraftField() {
    setDraftFields((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        fieldKey: "",
        fieldLabel: "",
        fieldType: "text",
        isRequired: false,
        optionsText: "",
      },
    ]);
  }

  function updateDraftField(id: string, patch: Partial<DraftField>) {
    setDraftFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeDraftField(id: string) {
    setDraftFields((prev) => prev.filter((f) => f.id !== id));
  }

  async function onCreateEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult("Создаем мероприятие...");

    const fieldsPayload: {
      fieldKey: string;
      fieldLabel: string;
      fieldType: "text" | "textarea" | "select";
      isRequired: boolean;
      options?: string[];
    }[] = [];

    for (const f of draftFields) {
      const key = f.fieldKey.trim();
      const label = f.fieldLabel.trim();
      if (!key && !label) continue;
      if (!key || !label) {
        setResult("Для каждого поля заполните ключ и подпись или удалите строку.");
        return;
      }
      if (!/^[a-z0-9_]+$/.test(key)) {
        setResult(`Ключ поля «${key}»: только латиница, цифры и подчёркивание.`);
        return;
      }
      const opts =
        f.fieldType === "select"
          ? f.optionsText
              .split(/\n/)
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;
      if (f.fieldType === "select" && (!opts || opts.length === 0)) {
        setResult(`Для списка «${label}» укажите варианты (построчно).`);
        return;
      }
      fieldsPayload.push({
        fieldKey: key,
        fieldLabel: label,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
        ...(opts?.length ? { options: opts } : {}),
      });
    }

    try {
      const res = await fetch("/api/super-admin/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          city,
          eventDate,
          ...(fieldsPayload.length ? { fields: fieldsPayload } : {}),
        }),
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
      setDraftFields([]);
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
    const ok = window.confirm(
        "Удалить мероприятие? Связанные данные удалятся, если в БД настроен CASCADE."
    );
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

  const tabBtn = (id: ManageTab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={activeTab === id}
      onClick={() => setActiveTab(id)}
      className={`relative shrink-0 border-b-2 px-2 pb-2.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
        activeTab === id
          ? "border-teal-600 text-teal-800"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <AppShell maxWidth="max-w-4xl">
      <BackNav href="/admin">К панели</BackNav>
      <AppCard
        title="Мероприятия"
      >
        <div
          className="mb-5 flex gap-0.5 overflow-x-auto border-b border-slate-200"
          role="tablist"
          aria-label="Разделы управления мероприятиями"
        >
          {tabBtn("create", "Создание мероприятий")}
          {tabBtn("assign", "Назначение ответственных пользователей")}
          {tabBtn("list", "Список мероприятий")}
        </div>

        {activeTab === "create" && (
          <div className="space-y-8" role="tabpanel">
            <AppSection title="Новое мероприятие">
              <form onSubmit={onCreateEvent}>
                <FormStack>
                  <input
                    className={inputClass}
                    placeholder="Название"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                  <input
                    className={inputClass}
                    placeholder="Город"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                  <input
                    type="date"
                    className={inputClass}
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                  />
                  <button type="submit" disabled={loading} className={btnPrimary}>
                    Создать мероприятие
                  </button>
                </FormStack>
              </form>
            </AppSection>

            <AppSection title="Поля билета при создании (необязательно)">
              <div className="max-w-md space-y-4">
              <p className="text-xs text-slate-600">
                Ключ — латиница (например <span className="font-mono">company_name</span>). Для
                «Список» варианты — с новой строки. Позже поля можно менять в карточке мероприятия
                («Поля»).
              </p>
              {draftFields.map((f) => (
                <div
                  key={f.id}
                  className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <input
                    className={inputClass}
                    placeholder="Ключ (латиница)"
                    value={f.fieldKey}
                    onChange={(e) => updateDraftField(f.id, { fieldKey: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="Подпись в форме"
                    value={f.fieldLabel}
                    onChange={(e) => updateDraftField(f.id, { fieldLabel: e.target.value })}
                  />
                  <select
                    className={selectClass}
                    value={f.fieldType}
                    onChange={(e) =>
                      updateDraftField(f.id, {
                        fieldType: e.target.value as DraftField["fieldType"],
                      })
                    }
                  >
                    <option value="text">Текст</option>
                    <option value="textarea">Многострочный</option>
                    <option value="select">Список</option>
                  </select>
                  {f.fieldType === "select" && (
                    <textarea
                      className={inputClass}
                      rows={3}
                      placeholder="Варианты списка (каждый с новой строки)"
                      value={f.optionsText}
                      onChange={(e) => updateDraftField(f.id, { optionsText: e.target.value })}
                    />
                  )}
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={f.isRequired}
                      onChange={(e) => updateDraftField(f.id, { isRequired: e.target.checked })}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    Обязательное
                  </label>
                  <button type="button" onClick={() => removeDraftField(f.id)} className={btnDanger}>
                    Удалить поле
                  </button>
                </div>
              ))}
              <button type="button" onClick={addDraftField} className={btnSecondary}>
                + Добавить поле
              </button>
              </div>
            </AppSection>
          </div>
        )}

        {activeTab === "assign" && (
          <div role="tabpanel">
            <AppSection title="Назначить пользователя на мероприятие">
              <p className="mb-4 text-xs text-slate-600">
                В списке только пользователи с ролью «пользователь». Они увидят мероприятие в своей
                панели и смогут вести билеты и сканер.
              </p>
              <form onSubmit={onAssign}>
                <FormStack>
                  <select
                    className={selectClass}
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    required
                  >
                    <option value="">Мероприятие</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} / {ev.city} / {ev.event_date}
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectClass}
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    required
                  >
                    <option value="">Пользователь</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name ?? "Без имени"}
                        {u.phone ? ` / ${u.phone}` : ""}
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={loading} className={btnPrimary}>
                    Назначить доступ
                  </button>
                </FormStack>
              </form>
            </AppSection>
          </div>
        )}

        {activeTab === "list" && (
          <div
            className="max-h-[min(70vh,calc(100vh-16rem))] overflow-y-auto pr-1"
            role="tabpanel"
          >
            <AppSection title="Все мероприятия">
              {events.length === 0 ? (
                <p className="text-sm text-slate-600">Пока нет мероприятий</p>
              ) : (
                <ul className="space-y-4">
                  {events.map((ev) => (
                    <li
                      key={ev.id}
                      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
                    >
                      {editEventId === ev.id ? (
                        <div className="max-w-md space-y-3">
                          <input
                            className={inputClass}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                          />
                          <input
                            className={inputClass}
                            value={editCity}
                            onChange={(e) => setEditCity(e.target.value)}
                          />
                          <input
                            type="date"
                            className={inputClass}
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                          />
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={editIsActive}
                              onChange={(e) => setEditIsActive(e.target.checked)}
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            Активно
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={saveEditEvent} className={btnPrimary}>
                              Сохранить
                            </button>
                            <button type="button" onClick={cancelEditEvent} className={btnSecondary}>
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{ev.title}</p>
                            <p className="text-sm text-slate-600">
                              {ev.city} · {ev.event_date} ·{" "}
                              <span
                                className={ev.is_active ? "text-teal-700" : "text-slate-400"}
                              >
                                {ev.is_active ? "активно" : "неактивно"}
                              </span>
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/admin/manage/events/${ev.id}/fields`}
                              className={`${btnSecondary} no-underline`}
                            >
                              Поля
                            </Link>
                            <button
                              type="button"
                              onClick={() => startEditEvent(ev)}
                              className={btnSecondary}
                            >
                              Редактировать
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEvent(ev.id)}
                              className={btnDanger}
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </AppSection>
          </div>
        )}

        {result && (
          <p className="mt-6 rounded-lg border border-slate-200 bg-amber-50/80 px-3 py-2 text-sm text-slate-800">
            {result}
          </p>
        )}
      </AppCard>
    </AppShell>
  );
}