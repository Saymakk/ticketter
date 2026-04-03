"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { isEventPastByDateString } from "@/lib/event-date";
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
  ListLoading,
  selectClass,
} from "@/components/ui/app-shell";

type EventItem = {
  id: string;
  title: string;
  city: string;
  event_date: string;
  is_active: boolean;
};

type AssigneeItem = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "user" | "admin";
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
  const { t } = useLocaleContext();
  const [activeTab, setActiveTab] = useState<ManageTab>("create");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [assignees, setAssignees] = useState<AssigneeItem[]>([]);
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
      const [eventsRes, usersRes, adminsRes] = await Promise.all([
        fetch("/api/super-admin/events", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/assignable-admins", { cache: "no-store" }),
      ]);

      const eventsJson =
          (await safeReadJson<{ events?: EventItem[] } & ApiError>(eventsRes)) ?? {};
      const usersJson =
          (await safeReadJson<{ users?: AssigneeItem[] } & ApiError>(usersRes)) ?? {};
      const adminsJson =
          (await safeReadJson<{ admins?: AssigneeItem[] } & ApiError>(adminsRes)) ?? {};

      if (eventsRes.ok) {
        setEvents(eventsJson.events ?? []);
      } else {
        setEvents([]);
        setResult(
          t("admin.manage.loadEventsFailed", {
            detail: String(eventsJson.error ?? `HTTP ${eventsRes.status}`),
          })
        );
      }

      if (usersRes.ok) {
        const users = usersJson.users ?? [];
        const admins = adminsRes.ok ? adminsJson.admins ?? [] : [];
        const merged: AssigneeItem[] = [...users, ...admins].map((x) => ({
          ...x,
          role: x.role === "admin" ? "admin" : "user",
        }));
        const uniq = Array.from(new Map(merged.map((x) => [x.id, x])).values());
        setAssignees(uniq);
      } else {
        setAssignees([]);
        setResult(
          t("admin.manage.loadUsersFailed", {
            detail: String(usersJson.error ?? `HTTP ${usersRes.status}`),
          })
        );
      }
    } catch {
      setResult(t("admin.manage.loadError"));
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

  useEffect(() => {
    if (!selectedEventId) return;
    const ev = events.find((e) => e.id === selectedEventId);
    if (ev && isEventPastByDateString(ev.event_date)) {
      setSelectedEventId("");
    }
  }, [events, selectedEventId]);

  const assignSelectedEventPast = useMemo(() => {
    const ev = events.find((e) => e.id === selectedEventId);
    return ev ? isEventPastByDateString(ev.event_date) : false;
  }, [events, selectedEventId]);

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
    setResult(t("admin.manage.resultCreating"));

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
        setResult(t("admin.manage.fieldRowError"));
        return;
      }
      if (!/^[a-z0-9_]+$/.test(key)) {
        setResult(t("admin.manage.fieldKeyError", { key }));
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
        setResult(t("admin.manage.fieldSelectError", { label }));
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
        setResult(
          t("admin.manage.errorApi", {
            detail: String(json.error ?? `HTTP ${res.status}`),
          })
        );
        return;
      }

      setResult(t("admin.manage.resultCreated"));
      setTitle("");
      setCity("");
      setEventDate("");
      setDraftFields([]);
      await loadData();
    } catch {
      setResult(t("admin.manage.networkCreate"));
    }
  }

  async function onAssign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedEventId || !selectedUserId) {
      setResult(t("admin.manage.errorApi", { detail: t("admin.manage.assignPickRequired") }));
      return;
    }
    const evForAssign = events.find((e) => e.id === selectedEventId);
    if (evForAssign && isEventPastByDateString(evForAssign.event_date)) {
      setResult(t("admin.manage.errorApi", { detail: t("admin.manage.assignPastBlocked") }));
      return;
    }
    setResult(t("admin.manage.resultAssigning"));

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
        setResult(
          t("admin.manage.errorApi", {
            detail: String(json.error ?? `HTTP ${res.status}`),
          })
        );
        return;
      }

      setResult(t("admin.manage.resultAssigned"));
    } catch {
      setResult(t("admin.manage.networkAssign"));
    }
  }

  function startEditEvent(ev: EventItem) {
    if (isEventPastByDateString(ev.event_date)) return;
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
    setResult(t("admin.manage.resultSaving"));

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
      setResult(
        t("admin.manage.errorApi", {
          detail: String(json.error ?? `HTTP ${res.status}`),
        })
      );
      return;
    }

    setResult(t("admin.manage.resultSaved"));
    cancelEditEvent();
    await loadData();
  }

  async function deleteEvent(eventId: string) {
    const ok = window.confirm(t("admin.manage.deleteConfirm"));
    if (!ok) return;

    setResult(t("admin.manage.resultDeleting"));
    const res = await fetch(`/api/super-admin/events/${eventId}`, {
      method: "DELETE",
    });

    const json = (await safeReadJson<ApiError>(res)) ?? {};
    if (!res.ok) {
      setResult(
        t("admin.manage.errorApi", {
          detail: String(json.error ?? `HTTP ${res.status}`),
        })
      );
      return;
    }

    setResult(t("admin.manage.resultDeleted"));
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
      <BackNav href="/admin">{t("common.toPanel")}</BackNav>
      <AppCard title={t("admin.manage.title")} subtitle={t("admin.manage.subtitle")}>
        <div
          className="mb-5 flex gap-0.5 overflow-x-auto border-b border-slate-200"
          role="tablist"
          aria-label={t("admin.manage.tabsAria")}
        >
          {tabBtn("create", t("admin.manage.tabCreate"))}
          {tabBtn("assign", t("admin.manage.tabAssign"))}
          {tabBtn("list", t("admin.manage.tabList"))}
        </div>

        {activeTab === "create" && (
          <div className="space-y-8" role="tabpanel">
            <AppSection title={t("admin.manage.sectionNew")}>
              <form onSubmit={onCreateEvent}>
                <FormStack>
                  <input
                    className={inputClass}
                    placeholder={t("admin.manage.placeholderTitle")}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                  <input
                    className={inputClass}
                    placeholder={t("admin.manage.placeholderCity")}
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
                    {t("admin.manage.submitCreate")}
                  </button>
                </FormStack>
              </form>
            </AppSection>

            <AppSection title={t("admin.manage.sectionFields")}>
              <div className="max-w-md space-y-4">
              <p className="text-xs text-slate-600">{t("admin.manage.fieldsHint")}</p>
              {draftFields.map((f) => (
                <div
                  key={f.id}
                  className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <input
                    className={inputClass}
                    placeholder={t("admin.manage.fieldKey")}
                    value={f.fieldKey}
                    onChange={(e) => updateDraftField(f.id, { fieldKey: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder={t("admin.manage.fieldLabel")}
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
                    <option value="text">{t("admin.manage.fieldTypeText")}</option>
                    <option value="textarea">{t("admin.manage.fieldTypeTextarea")}</option>
                    <option value="select">{t("admin.manage.fieldTypeSelect")}</option>
                  </select>
                  {f.fieldType === "select" && (
                    <textarea
                      className={inputClass}
                      rows={3}
                      placeholder={t("admin.manage.fieldOptions")}
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
                    {t("common.required")}
                  </label>
                  <button type="button" onClick={() => removeDraftField(f.id)} className={btnDanger}>
                    {t("admin.manage.removeField")}
                  </button>
                </div>
              ))}
              <button type="button" onClick={addDraftField} className={btnSecondary}>
                {t("admin.manage.addField")}
              </button>
              </div>
            </AppSection>
          </div>
        )}

        {activeTab === "assign" && (
          <div role="tabpanel">
            {loading ? (
              <ListLoading label={t("common.loading")} />
            ) : (
            <AppSection title={t("admin.manage.sectionAssign")}>
              <p className="mb-4 text-xs text-slate-600">{t("admin.manage.assignHint")}</p>
              <form onSubmit={onAssign}>
                <FormStack>
                  <div>
                    <select
                      className={selectClass}
                      value={selectedEventId}
                      onChange={(e) => setSelectedEventId(e.target.value)}
                      required
                    >
                      <option value="">{t("admin.manage.selectEvent")}</option>
                      {events.map((ev) => {
                        const past = isEventPastByDateString(ev.event_date);
                        return (
                          <option key={ev.id} value={ev.id} disabled={past}>
                            {ev.title} / {ev.city} / {ev.event_date}
                            {past ? ` · ${t("admin.events.eventPastBadge")}` : ""}
                          </option>
                        );
                      })}
                    </select>
                    <p className="mt-2 text-xs text-slate-600">{t("admin.manage.assignPastHint")}</p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-800/90">
                      {t("admin.manage.assigneeListLabel")}
                    </p>
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-2">
                      {assignees.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-slate-600">{t("admin.manage.assignNoAssignees")}</p>
                      ) : (
                        assignees.map((u) => (
                          <label
                            key={u.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                              selectedUserId === u.id
                                ? "border-teal-500 bg-white shadow-sm"
                                : "border-transparent bg-white/70 hover:border-slate-200 hover:bg-white"
                            }`}
                          >
                            <input
                              type="radio"
                              name="assignee"
                              value={u.id}
                              checked={selectedUserId === u.id}
                              onChange={() => setSelectedUserId(u.id)}
                              className="mt-0.5 h-4 w-4 shrink-0 border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-slate-900">
                                  {u.full_name ?? t("admin.manage.noUserName")}
                                </span>
                                <span
                                  className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                                    u.role === "admin"
                                      ? "bg-amber-100 text-amber-900"
                                      : "bg-slate-200/90 text-slate-800"
                                  }`}
                                >
                                  {u.role === "admin"
                                    ? t("admin.manage.assigneeBadgeAdmin")
                                    : t("admin.manage.assigneeBadgeUser")}
                                </span>
                              </span>
                              {u.phone ? (
                                <span className="mt-0.5 block text-xs text-slate-600">{u.phone}</span>
                              ) : null}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading || assignSelectedEventPast || !selectedEventId || !selectedUserId}
                    className={btnPrimary}
                  >
                    {t("admin.manage.assignSubmit")}
                  </button>
                </FormStack>
              </form>
            </AppSection>
            )}
          </div>
        )}

        {activeTab === "list" && (
          <div
            className="max-h-[min(70vh,calc(100vh-16rem))] overflow-y-auto pr-1"
            role="tabpanel"
          >
            <AppSection title={t("admin.manage.sectionList")}>
              {loading ? (
                <ListLoading label={t("common.loading")} className="py-6" />
              ) : events.length === 0 ? (
                <p className="text-sm text-slate-600">{t("admin.manage.listEmpty")}</p>
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
                            {t("admin.manage.activeFlag")}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={saveEditEvent} className={btnPrimary}>
                              {t("common.save")}
                            </button>
                            <button type="button" onClick={cancelEditEvent} className={btnSecondary}>
                              {t("common.cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{ev.title}</p>
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
                              <span>
                                {ev.city} · {ev.event_date} ·{" "}
                                <span
                                  className={ev.is_active ? "text-teal-700" : "text-slate-400"}
                                >
                                  {ev.is_active ? t("common.active") : t("common.inactive")}
                                </span>
                              </span>
                              {isEventPastByDateString(ev.event_date) ? (
                                <span className="rounded-full bg-slate-200/90 px-2 py-0.5 text-xs font-medium text-slate-700">
                                  {t("admin.events.eventPastBadge")}
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/admin/manage/events/${ev.id}/fields`}
                              className={`${btnSecondary} no-underline`}
                            >
                              {t("admin.manage.fieldsLink")}
                            </Link>
                            <button
                              type="button"
                              onClick={() => startEditEvent(ev)}
                              disabled={isEventPastByDateString(ev.event_date)}
                              title={
                                isEventPastByDateString(ev.event_date)
                                  ? t("admin.manage.cannotEditPast")
                                  : undefined
                              }
                              className={`${btnSecondary} disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {t("common.edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEvent(ev.id)}
                              className={btnDanger}
                            >
                              {t("common.delete")}
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