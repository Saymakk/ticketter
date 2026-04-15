"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { formatEventDateTimeLine, isEventPastByDateString } from "@/lib/event-date";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import { useHorizontalSwipeTabs } from "@/lib/ui/use-horizontal-swipe-tabs";
import {
  AppCard,
  AppSection,
  AppShell,
  PageHeaderWithBack,
  btnDanger,
  btnPrimary,
  btnSecondary,
  FormStack,
  inputClass,
  ListLoading,
  selectClass,
} from "@/components/ui/app-shell";
import { DeleteActionIcon, EditActionIcon } from "@/components/ui/action-icons";

type EventItem = {
  id: string;
  title: string;
  city: string;
  event_date: string;
  event_time?: string | null;
  is_active: boolean;
};

type AssigneeItem = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "user" | "admin";
  region: string | null;
};
type CompanyItem = { id: string; name: string };

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

type ManageEventsPageCache = {
  events: EventItem[];
  assignees: AssigneeItem[];
  updatedAt: number;
};

const MANAGE_EVENTS_CACHE_TTL_MS = 5 * 60 * 1000;
let manageEventsPageCache: ManageEventsPageCache | null = null;

function readManageEventsPageCache(): ManageEventsPageCache | null {
  if (!manageEventsPageCache) return null;
  if (Date.now() - manageEventsPageCache.updatedAt > MANAGE_EVENTS_CACHE_TTL_MS) {
    return null;
  }
  return manageEventsPageCache;
}

function writeManageEventsPageCache(events: EventItem[], assignees: AssigneeItem[]) {
  manageEventsPageCache = {
    events,
    assignees,
    updatedAt: Date.now(),
  };
}

export default function ManageEventsPage() {
  const { t } = useLocaleContext();
  const [activeTab, setActiveTab] = useState<ManageTab>("create");
  const manageTabOrder: readonly ManageTab[] = ["create", "assign", "list"];
  const manageSwipeHandlers = useHorizontalSwipeTabs<ManageTab>({
    tabs: manageTabOrder,
    activeTab,
    onChange: setActiveTab,
  });
  const [events, setEvents] = useState<EventItem[]>([]);
  const [assignees, setAssignees] = useState<AssigneeItem[]>([]);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [createToast, setCreateToast] = useState("");
  const [assignToast, setAssignToast] = useState("");
  const [companies, setCompanies] = useState<CompanyItem[]>([]);

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [createCompanyId, setCreateCompanyId] = useState("");

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [eventAccess, setEventAccess] = useState<{
    creatorId: string | null;
    assignedProfileIds: string[];
    revokableProfileIds: string[];
  } | null>(null);
  const [eventAccessLoading, setEventAccessLoading] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);

  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  const [draftFields, setDraftFields] = useState<DraftField[]>([]);

  async function loadData(opts?: { silent?: boolean }) {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    try {
      const [eventsRes, usersRes, adminsRes, companiesRes] = await Promise.all([
        trackedFetch("/api/super-admin/events", {
          cache: "no-store",
          trackGlobalLoading: false,
        }),
        trackedFetch("/api/admin/users", {
          cache: "no-store",
          trackGlobalLoading: false,
        }),
        trackedFetch("/api/admin/assignable-admins", {
          cache: "no-store",
          trackGlobalLoading: false,
        }),
        trackedFetch("/api/companies", {
          cache: "no-store",
          trackGlobalLoading: false,
        }),
      ]);

      const eventsJson =
          (await safeReadJson<{ events?: EventItem[] } & ApiError>(eventsRes)) ?? {};
      const usersJson =
          (await safeReadJson<{ users?: AssigneeItem[] } & ApiError>(usersRes)) ?? {};
      const adminsJson =
          (await safeReadJson<{ admins?: AssigneeItem[] } & ApiError>(adminsRes)) ?? {};
      const companiesJson =
          (await safeReadJson<{ companies?: CompanyItem[] } & ApiError>(companiesRes)) ?? {};

      const nextEvents = eventsRes.ok ? eventsJson.events ?? [] : events;
      if (eventsRes.ok) {
        setEvents(nextEvents);
      } else if (!silent) {
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
        writeManageEventsPageCache(nextEvents, uniq);
      } else {
        if (!silent) setAssignees([]);
        setResult(
          t("admin.manage.loadUsersFailed", {
            detail: String(usersJson.error ?? `HTTP ${usersRes.status}`),
          })
        );
      }
      if (companiesRes.ok) {
        const nextCompanies = companiesJson.companies ?? [];
        setCompanies(nextCompanies);
        if (nextCompanies.length === 1) {
          setCreateCompanyId(nextCompanies[0].id);
        } else if (!nextCompanies.some((c) => c.id === createCompanyId)) {
          setCreateCompanyId("");
        }
      }
    } catch {
      setResult(t("admin.manage.loadError"));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    const cached = readManageEventsPageCache();
    if (cached) {
      setEvents(cached.events);
      setAssignees(cached.assignees);
      setLoading(false);
      void loadData({ silent: true });
      return;
    }
    void loadData();
  }, []);

  useEffect(() => {
    if (!createToast) return;
    const t = window.setTimeout(() => setCreateToast(""), 2200);
    return () => window.clearTimeout(t);
  }, [createToast]);

  useEffect(() => {
    if (!assignToast) return;
    const t = window.setTimeout(() => setAssignToast(""), 2200);
    return () => window.clearTimeout(t);
  }, [assignToast]);

  useEffect(() => {
    if (activeTab === "assign" || activeTab === "list") {
      const hasCached = events.length > 0 || assignees.length > 0;
      void loadData({ silent: hasCached });
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

  const assignedIdSet = useMemo(
    () => new Set(eventAccess?.assignedProfileIds ?? []),
    [eventAccess?.assignedProfileIds]
  );

  const revokableIdSet = useMemo(
    () => new Set(eventAccess?.revokableProfileIds ?? []),
    [eventAccess?.revokableProfileIds]
  );

  const assignAllSelectedAlreadyAssigned = useMemo(
    () =>
      selectedUserIds.length > 0 &&
      selectedUserIds.every((id) => assignedIdSet.has(id)),
    [selectedUserIds, assignedIdSet]
  );

  const pullEventAccess = useCallback(async (eventId: string) => {
    try {
      const res = await trackedFetch(
        `/api/super-admin/events/${encodeURIComponent(eventId)}/access-holders`,
        { cache: "no-store" }
      );
      const json =
        (await safeReadJson<{
          creatorId?: string | null;
          assignedProfileIds?: string[];
          revokableProfileIds?: string[];
        }>(res)) ?? {};
      if (!res.ok) return null;
      return {
        creatorId: json.creatorId ?? null,
        assignedProfileIds: json.assignedProfileIds ?? [],
        revokableProfileIds: json.revokableProfileIds ?? [],
      };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      setEventAccess(null);
      setEventAccessLoading(false);
      return;
    }
    let cancelled = false;
    setEventAccessLoading(true);
    void pullEventAccess(selectedEventId).then((data) => {
      if (cancelled) return;
      setEventAccess(data);
      setEventAccessLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedEventId, pullEventAccess]);

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
      const res = await trackedFetch("/api/super-admin/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          city,
          eventDate,
          ...(createCompanyId ? { companyId: createCompanyId } : {}),
          ...(eventTime.trim() ? { eventTime: eventTime.trim() } : {}),
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
      setCreateToast(t("admin.manage.resultCreated"));
      setTitle("");
      setCity("");
      setEventDate("");
      setEventTime("");
      if (companies.length !== 1) setCreateCompanyId("");
      setDraftFields([]);
      await loadData();
    } catch {
      setResult(t("admin.manage.networkCreate"));
    }
  }

  function toggleAssignee(id: string) {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onAssign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedEventId || selectedUserIds.length === 0) {
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
      const res = await trackedFetch("/api/super-admin/events/assign-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: selectedUserIds,
          eventId: selectedEventId,
        }),
      });

      const json =
        (await safeReadJson<
          ApiError & {
            assigned?: number;
            duplicate?: number;
            failures?: { userId: string; error: string }[];
          }
        >(res)) ?? {};

      if (!res.ok) {
        setResult(
          t("admin.manage.errorApi", {
            detail: String(json.error ?? `HTTP ${res.status}`),
          })
        );
        return;
      }

      const assigned = json.assigned ?? 0;
      const dup = json.duplicate ?? 0;
      const fails = json.failures ?? [];

      const parts: string[] = [];
      if (assigned > 0) {
        parts.push(t("admin.manage.resultAssignedCount", { count: assigned }));
      }
      if (dup > 0) {
        parts.push(t("admin.manage.assignSkippedDup", { count: dup }));
      }
      if (fails.length > 0) {
        const detail = [...new Set(fails.map((f) => f.error))].join("; ");
        parts.push(
          t("admin.manage.assignPartialFailures", {
            count: fails.length,
            detail,
          })
        );
      }
      if (parts.length === 0) {
        parts.push(t("admin.manage.resultAssigned"));
      }
      setResult(parts.join(" "));
      if (assigned > 0) {
        setAssignToast(t("admin.manage.resultAssigned"));
      }
      const refreshed = await pullEventAccess(selectedEventId);
      if (refreshed) setEventAccess(refreshed);
      if (assigned > 0 && fails.length === 0) {
        setSelectedUserIds([]);
      }
    } catch {
      setResult(t("admin.manage.networkAssign"));
    }
  }

  async function onRevokeAccess(targetUserId: string) {
    if (!selectedEventId) return;
    const evForRevoke = events.find((e) => e.id === selectedEventId);
    if (evForRevoke && isEventPastByDateString(evForRevoke.event_date)) {
      setResult(t("admin.manage.errorApi", { detail: t("admin.manage.assignPastBlocked") }));
      return;
    }
    setRevokingUserId(targetUserId);
    setResult(t("admin.manage.resultRevoking"));
    try {
      const res = await trackedFetch("/api/super-admin/events/revoke-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          userIds: [targetUserId],
        }),
      });

      const json =
        (await safeReadJson<
          ApiError & {
            revoked?: number;
            failures?: { userId: string; error: string }[];
          }
        >(res)) ?? {};

      if (!res.ok) {
        setResult(
          t("admin.manage.errorApi", {
            detail: String(json.error ?? `HTTP ${res.status}`),
          })
        );
        return;
      }

      const revoked = json.revoked ?? 0;
      const fails = json.failures ?? [];
      const parts: string[] = [];
      if (revoked > 0) {
        parts.push(t("admin.manage.resultRevokedCount", { count: revoked }));
      }
      if (fails.length > 0) {
        const detail = [...new Set(fails.map((f) => f.error))].join("; ");
        parts.push(
          t("admin.manage.revokePartialFailures", {
            count: fails.length,
            detail,
          })
        );
      }
      if (parts.length === 0) {
        parts.push(t("admin.manage.resultRevoked"));
      }
      setResult(parts.join(" "));
      const refreshed = await pullEventAccess(selectedEventId);
      if (refreshed) setEventAccess(refreshed);
      setSelectedUserIds((prev) => prev.filter((id) => id !== targetUserId));
    } catch {
      setResult(t("admin.manage.networkRevoke"));
    } finally {
      setRevokingUserId(null);
    }
  }

  function startEditEvent(ev: EventItem) {
    if (isEventPastByDateString(ev.event_date)) return;
    setEditEventId(ev.id);
    setEditTitle(ev.title);
    setEditCity(ev.city);
    setEditDate(ev.event_date);
    setEditTime(ev.event_time?.trim() ?? "");
    setEditIsActive(ev.is_active);
  }

  function cancelEditEvent() {
    setEditEventId(null);
    setEditTitle("");
    setEditCity("");
    setEditDate("");
    setEditTime("");
    setEditIsActive(true);
  }

  async function saveEditEvent() {
    if (!editEventId) return;
    setResult(t("admin.manage.resultSaving"));

    const res = await trackedFetch(`/api/super-admin/events/${editEventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        city: editCity,
        eventDate: editDate,
        eventTime: editTime.trim() ? editTime.trim() : null,
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
    const res = await trackedFetch(`/api/super-admin/events/${eventId}`, {
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

  return (
    <AppShell maxWidth="max-w-4xl">
      <PageHeaderWithBack
        backHref="/admin"
        backLabel={t("common.toPanel")}
        title={t("admin.manage.title")}
        end={
          <Link
            href="/admin/events"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          >
            {t("admin.manage.toTickets")}
            <span aria-hidden>→</span>
          </Link>
        }
      />
      <AppCard>
        {createToast ? (
          <div className="pointer-events-none fixed inset-0 z-[320] flex items-center justify-center p-4">
            <div className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
              {createToast}
            </div>
          </div>
        ) : null}
        {assignToast ? (
          <div className="pointer-events-none fixed inset-0 z-[320] flex items-center justify-center p-4">
            <div className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
              {assignToast}
            </div>
          </div>
        ) : null}
        <div
          className="mb-6 grid grid-cols-3 gap-1.5 rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1.5 shadow-inner"
          role="tablist"
          aria-label={t("admin.manage.tabsAria")}
        >
          {(
            [
              { id: "create" as const, label: t("admin.manage.tabCreate") },
              { id: "assign" as const, label: t("admin.manage.tabAssign") },
              { id: "list" as const, label: t("admin.manage.tabList") },
            ] as const
          ).map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                id={`manage-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[3rem] rounded-xl px-1.5 py-2.5 text-center text-[0.8125rem] font-semibold leading-snug tracking-tight transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 sm:px-3 sm:text-sm ${
                  active
                    ? "bg-teal-600 text-white shadow-md ring-1 ring-teal-700/20"
                    : "text-slate-600 hover:bg-white/90 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div style={{ touchAction: "pan-y" }} {...manageSwipeHandlers}>
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
                  <input
                    type="time"
                    className={inputClass}
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    title={t("admin.manage.placeholderEventTime")}
                  />
                  {companies.length > 1 ? (
                    <select
                      className={selectClass}
                      value={createCompanyId}
                      onChange={(e) => setCreateCompanyId(e.target.value)}
                      required
                    >
                      <option value="">{t("admin.companies.grantSelectCompany")}</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <p className="text-xs text-slate-500">{t("admin.manage.eventTimeHint")}</p>
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
                            {ev.title} / {ev.city} /{" "}
                            {formatEventDateTimeLine(ev.event_date, ev.event_time)}
                            {past ? ` · ${t("admin.events.eventPastBadge")}` : ""}
                          </option>
                        );
                      })}
                    </select>
                    <p className="mt-2 text-xs text-slate-600">{t("admin.manage.assignPastHint")}</p>
                    {loading ? (
                      <p className="mt-2 text-xs text-slate-500">{t("common.loading")}</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-800/90">
                      {t("admin.manage.assigneeListLabel")}
                    </p>
                    {selectedEventId && eventAccessLoading ? (
                      <p className="mb-2 text-xs text-slate-500">{t("admin.manage.assignAccessLoading")}</p>
                    ) : null}
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-2">
                      {loading && assignees.length === 0 ? (
                        <ListLoading label={t("common.loading")} className="py-4" />
                      ) : assignees.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-slate-600">{t("admin.manage.assignNoAssignees")}</p>
                      ) : (
                        assignees.map((u) => {
                          const selected = selectedUserIds.includes(u.id);
                          const isExplicitlyAssigned = assignedIdSet.has(u.id);
                          const isEventCreator = eventAccess?.creatorId === u.id;
                          const canRevokeRow =
                            isExplicitlyAssigned && revokableIdSet.has(u.id);
                          return (
                          <div
                            key={u.id}
                            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                              selected
                                ? "border-teal-500 bg-white shadow-sm"
                                : "border-transparent bg-white/70 hover:border-slate-200 hover:bg-white"
                            } ${
                              isExplicitlyAssigned
                                ? "ring-1 ring-inset ring-emerald-300/80"
                                : isEventCreator
                                  ? "ring-1 ring-inset ring-amber-200/90"
                                  : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              id={`assignee-${u.id}`}
                              checked={selected}
                              onChange={() => toggleAssignee(u.id)}
                              aria-label={t("admin.manage.assigneeCheckboxAria", {
                                name: u.full_name ?? t("admin.manage.noUserName"),
                              })}
                              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                            />
                            <label
                              htmlFor={`assignee-${u.id}`}
                              className="min-w-0 flex-1 cursor-pointer"
                            >
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
                                {isExplicitlyAssigned ? (
                                  <span className="inline-flex shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
                                    {t("admin.manage.assigneeBadgeAlreadyAssigned")}
                                  </span>
                                ) : isEventCreator ? (
                                  <span className="inline-flex shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-950 ring-1 ring-amber-200/90">
                                    {t("admin.manage.assigneeBadgeEventCreator")}
                                  </span>
                                ) : null}
                              </span>
                              {u.phone ? (
                                <span className="mt-0.5 block text-xs text-slate-600">{u.phone}</span>
                              ) : null}
                            </label>
                            {canRevokeRow ? (
                              <button
                                type="button"
                                disabled={revokingUserId !== null || assignSelectedEventPast}
                                onClick={() => void onRevokeAccess(u.id)}
                                className={`shrink-0 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-800 shadow-sm transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/25 disabled:opacity-50`}
                              >
                                {revokingUserId === u.id
                                  ? t("admin.manage.revokeInProgressButton")
                                  : t("admin.manage.revokeAccessButton")}
                              </button>
                            ) : null}
                          </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      assignSelectedEventPast ||
                      !selectedEventId ||
                      selectedUserIds.length === 0 ||
                      assignAllSelectedAlreadyAssigned ||
                      eventAccessLoading
                    }
                    className={btnPrimary}
                  >
                    {t("admin.manage.assignSubmit")}
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
            <AppSection title={t("admin.manage.sectionList")}>
              {loading && events.length === 0 ? (
                <ListLoading label={t("common.loading")} className="py-6" />
              ) : events.length === 0 ? (
                <p className="text-sm text-slate-600">{t("admin.manage.listEmpty")}</p>
              ) : (
                <>
                {loading ? (
                  <p className="mb-3 text-xs text-slate-500">{t("common.loading")}</p>
                ) : null}
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
                          <input
                            type="time"
                            className={inputClass}
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                            title={t("admin.manage.placeholderEventTime")}
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
                                {ev.city} · {formatEventDateTimeLine(ev.event_date, ev.event_time)} ·{" "}
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
                                  : t("common.edit")
                              }
                              aria-label={
                                isEventPastByDateString(ev.event_date)
                                  ? t("admin.manage.cannotEditPast")
                                  : t("common.edit")
                              }
                              className={`${btnSecondary} inline-flex min-h-9 min-w-9 items-center justify-center p-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              <EditActionIcon className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEvent(ev.id)}
                              title={t("common.delete")}
                              aria-label={t("common.delete")}
                              className={`${btnDanger} inline-flex min-h-9 min-w-9 items-center justify-center p-1.5`}
                            >
                              <DeleteActionIcon />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                </>
              )}
            </AppSection>
          </div>
        )}
        {result && (
          <p className="mt-6 rounded-lg border border-slate-200 bg-amber-50/80 px-3 py-2 text-sm text-slate-800">
            {result}
          </p>
        )}
        </div>
      </AppCard>
    </AppShell>
  );
}