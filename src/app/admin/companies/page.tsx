"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import {
  AppCard,
  AppShell,
  btnPrimary,
  btnSecondary,
  FormStack,
  inputClass,
  labelClass,
  ListLoading,
  PageHeaderWithBack,
} from "@/components/ui/app-shell";
import CompanyLogo from "@/components/company-logo";

type Company = {
  id: string;
  name: string;
  image_url: string | null;
  custom_data: Record<string, unknown>;
  is_legacy: boolean;
};
type Assignee = { id: string; full_name: string | null; role: "user" | "admin"; company_id?: string | null };
type EventItem = { id: string; title: string; company_id?: string | null };
type CompanyAccessRow = {
  adminId: string;
  adminName: string | null;
  adminPhone: string | null;
  allEvents: boolean;
  eventIds: string[];
};
type CompanyDetails = {
  company: Company;
  events: Array<{ id: string; title: string; city: string | null; event_date: string }>;
  admins: Array<{ id: string; full_name: string | null; phone: string | null }>;
  users: Array<{ id: string; full_name: string | null; phone: string | null }>;
  tickets: Array<{ id: number; uuid: string; event_id: string; status: string; buyer_name: string | null }>;
};
type CustomField = { id: string; key: string; value: string; content: string };

function modalBg(open: boolean): string {
  return open ? "fixed inset-0 z-[310] flex items-center justify-center bg-black/45 p-4" : "hidden";
}

export default function AdminCompaniesPage() {
  const { t } = useLocaleContext();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [isSuper, setIsSuper] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editError, setEditError] = useState("");
  const [editCustomFields, setEditCustomFields] = useState<CustomField[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerRole, setPickerRole] = useState<"all" | "admin" | "user">("all");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  const [grantCompanyId, setGrantCompanyId] = useState("");
  const [grantAdminId, setGrantAdminId] = useState("");
  const [grantAllEvents, setGrantAllEvents] = useState(true);
  const [grantEventIds, setGrantEventIds] = useState<string[]>([]);
  const [companyAccessRows, setCompanyAccessRows] = useState<CompanyAccessRow[]>([]);
  const [companyAccessLoading, setCompanyAccessLoading] = useState(false);
  const [partialRevokeByAdmin, setPartialRevokeByAdmin] = useState<Record<string, string[]>>({});

  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState<CompanyDetails | null>(null);
  const [exporting, setExporting] = useState(false);

  const adminsOnly = useMemo(() => assignees.filter((x) => x.role === "admin"), [assignees]);
  const companyEvents = useMemo(
    () => events.filter((e) => e.company_id === grantCompanyId),
    [events, grantCompanyId]
  );
  const filteredAssignees = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return assignees.filter((x) => {
      if (pickerRole !== "all" && x.role !== pickerRole) return false;
      if (!q) return true;
      return (x.full_name ?? "").toLowerCase().includes(q);
    });
  }, [assignees, pickerQuery, pickerRole]);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    setLoading(true);
    try {
      const [cRes, roleRes, evRes, usersRes, adminsRes] = await Promise.all([
        trackedFetch("/api/companies", { cache: "no-store" }),
        trackedFetch("/api/auth/role", { cache: "no-store", trackGlobalLoading: false }),
        trackedFetch("/api/super-admin/events", { cache: "no-store", trackGlobalLoading: false }),
        trackedFetch("/api/admin/users", { cache: "no-store", trackGlobalLoading: false }),
        trackedFetch("/api/super-admin/admins", { cache: "no-store", trackGlobalLoading: false }),
      ]);

      const cJson = await cRes.json().catch(() => ({}));
      if (cRes.ok) {
        setCompanies((cJson.companies ?? []) as Company[]);
        setCanCreate(Boolean(cJson.canCreate));
      } else {
        setMessage(String(cJson.error ?? t("admin.companies.loadError")));
      }
      const rJson = await roleRes.json().catch(() => ({}));
      setIsSuper(roleRes.ok && rJson.role === "super_admin");
      const evJson = await evRes.json().catch(() => ({}));
      setEvents(evRes.ok ? ((evJson.events ?? []) as EventItem[]) : []);

      const usersJson = await usersRes.json().catch(() => ({}));
      const adminsJson = await adminsRes.json().catch(() => ({}));
      const users = ((usersJson.users ?? []) as Array<Record<string, unknown>>).map((x) => ({
        id: String(x.id ?? ""),
        full_name: (x.full_name as string | null) ?? null,
        role: "user" as const,
        company_id: (x.company_id as string | null) ?? null,
      }));
      const admins = adminsRes.ok
        ? ((adminsJson.admins ?? []) as Array<Record<string, unknown>>).map((x) => ({
            id: String(x.id ?? ""),
            full_name: (x.full_name as string | null) ?? null,
            role: "admin" as const,
            company_id: (x.company_id as string | null) ?? null,
          }))
        : [];
      setAssignees(Array.from(new Map([...users, ...admins].map((x) => [x.id, x])).values()));
    } finally {
      setLoading(false);
    }
  }

  function resetCreate() {
    setName("");
    setImageUrl("");
    setCustomFields([]);
    setSelectedAssignees([]);
    setPickerQuery("");
    setPickerRole("all");
  }

  function addCustomField() {
    setCustomFields((prev) => [
      ...prev,
      { id: crypto.randomUUID(), key: "", value: "", content: "" },
    ]);
  }

  async function onPickImageFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    await new Promise<void>((resolve, reject) => {
      reader.onload = () => resolve();
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    if (typeof reader.result === "string") {
      setImageUrl(reader.result);
    }
  }

  async function onPickEditImageFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    await new Promise<void>((resolve, reject) => {
      reader.onload = () => resolve();
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    if (typeof reader.result === "string") {
      setEditImageUrl(reader.result);
    }
  }

  async function onCreateCompany(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const customData: Record<string, unknown> = {};
    for (const row of customFields) {
      const k = row.key.trim();
      if (!k) continue;
      customData[k] = { value: row.value, content: row.content };
    }
    const adminIds = assignees.filter((x) => x.role === "admin" && selectedAssignees.includes(x.id)).map((x) => x.id);
    const userIds = assignees.filter((x) => x.role === "user" && selectedAssignees.includes(x.id)).map((x) => x.id);
    const res = await trackedFetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        imageUrl: imageUrl || null,
        customData,
        adminIds,
        userIds,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(String(json.error ?? t("admin.companies.createError")));
      return;
    }
    setMessage(t("admin.companies.createOk"));
    setCreateOpen(false);
    resetCreate();
    await bootstrap();
  }

  async function loadCompanyDetails(companyId: string) {
    setSelectedCompanyId(companyId);
    setDetailsLoading(true);
    try {
      const res = await trackedFetch(`/api/companies/${companyId}/details`, {
        cache: "no-store",
        trackGlobalLoading: false,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(String(json.error ?? t("admin.companies.detailsLoadError")));
        return;
      }
      setDetails(json as CompanyDetails);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function exportCompany(eventId?: string) {
    if (!selectedCompanyId) return;
    setExporting(true);
    try {
      const suffix = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
      const res = await trackedFetch(`/api/companies/${selectedCompanyId}/export${suffix}`, {
        method: "GET",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setMessage(String((json as { error?: string }).error ?? t("admin.companies.exportError")));
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = eventId ? "company-event.xlsx" : "company-full.xlsx";
      a.click();
      URL.revokeObjectURL(href);
    } finally {
      setExporting(false);
    }
  }

  function openEditModal(company: Company) {
    if (company.is_legacy) {
      setMessage("Legacy-компанию нельзя редактировать");
      return;
    }
    setEditError("");
    setEditCompany(company);
    setEditName(company.name);
    setEditImageUrl(company.image_url ?? "");
    const source = company.custom_data ?? {};
    const rows = Object.entries(source).map(([key, value]) => {
      const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      return {
        id: crypto.randomUUID(),
        key,
        value: String(rec.value ?? ""),
        content: String(rec.content ?? ""),
      };
    });
    setEditCustomFields(rows);
    setEditOpen(true);
  }

  async function submitEditCompany(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editCompany) return;
    setEditError("");
    const customData: Record<string, unknown> = {};
    for (const row of editCustomFields) {
      const k = row.key.trim();
      if (!k) continue;
      customData[k] = { value: row.value, content: row.content };
    }
    const res = await trackedFetch(`/api/companies/${editCompany.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim() || editCompany.name,
        imageUrl: editImageUrl.trim() || null,
        customData,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setEditError(String(json.error ?? t("admin.companies.updateError")));
      return;
    }
    setMessage(t("admin.companies.updateOk"));
    setEditOpen(false);
    await bootstrap();
    if (selectedCompanyId === editCompany.id) {
      await loadCompanyDetails(editCompany.id);
    }
  }

  async function deleteCompany(company: Company) {
    const res = await trackedFetch(`/api/companies/${company.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(String(json.error ?? t("admin.companies.deleteError")));
      return;
    }
    if (selectedCompanyId === company.id) {
      setSelectedCompanyId("");
      setDetails(null);
    }
    setMessage(t("admin.companies.deleteOk"));
    setEditOpen(false);
    await bootstrap();
  }

  async function loadCompanyAccess(companyId: string) {
    if (!companyId) {
      setCompanyAccessRows([]);
      return;
    }
    setCompanyAccessLoading(true);
    try {
      const res = await trackedFetch(`/api/companies/${companyId}/access`, {
        cache: "no-store",
        trackGlobalLoading: false,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(String(json.error ?? t("admin.companies.accessLoadError")));
        return;
      }
      setCompanyAccessRows((json.access ?? []) as CompanyAccessRow[]);
    } finally {
      setCompanyAccessLoading(false);
    }
  }

  async function onGrantCompanyAccess(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!grantCompanyId || !grantAdminId) {
      setMessage(t("admin.companies.grantPickRequired"));
      return;
    }
    const res = await trackedFetch(`/api/companies/${grantCompanyId}/grant-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminId: grantAdminId,
        allEvents: grantAllEvents,
        eventIds: grantAllEvents ? [] : grantEventIds,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(String(json.error ?? t("admin.companies.grantError")));
      return;
    }
    setMessage(t("admin.companies.grantOk"));
    await loadCompanyAccess(grantCompanyId);
  }

  async function revokeCompanyAccess(adminId: string) {
    if (!grantCompanyId) return;
    const res = await trackedFetch(`/api/companies/${grantCompanyId}/revoke-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId, mode: "all" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(String(json.error ?? t("admin.companies.revokeError")));
      return;
    }
    setMessage(t("admin.companies.revokeOk"));
    await loadCompanyAccess(grantCompanyId);
  }

  async function revokeSelectedEvents(adminId: string) {
    if (!grantCompanyId) return;
    const selected = partialRevokeByAdmin[adminId] ?? [];
    if (selected.length === 0) {
      setMessage(t("admin.companies.revokeSelectEventsRequired"));
      return;
    }
    const res = await trackedFetch(`/api/companies/${grantCompanyId}/revoke-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminId, mode: "selected", eventIds: selected }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(String(json.error ?? t("admin.companies.revokeError")));
      return;
    }
    setMessage(t("admin.companies.revokeSelectedOk"));
    setPartialRevokeByAdmin((prev) => ({ ...prev, [adminId]: [] }));
    await loadCompanyAccess(grantCompanyId);
  }

  return (
    <AppShell maxWidth="max-w-4xl">
      <PageHeaderWithBack backHref="/admin" backLabel={t("common.toPanel")} title={t("admin.companies.title")} />
      <AppCard subtitle={t("admin.companies.subtitle")}>
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" className={btnPrimary} onClick={() => setCreateOpen(true)} disabled={!canCreate}>
            {t("admin.companies.actionCreate")}
          </button>
          <button type="button" className={btnSecondary} onClick={() => setListOpen(true)}>
            {t("admin.companies.actionList")}
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => setGrantOpen(true)}
            disabled={!isSuper}
          >
            {t("admin.companies.actionGrant")}
          </button>
        </div>
        {!canCreate ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t("admin.companies.createBlockedBound")}
          </p>
        ) : null}
        {message ? (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p>
        ) : null}
        {loading ? <ListLoading label={t("common.loading")} className="py-8" /> : null}
      </AppCard>

      <div className={modalBg(createOpen)} onClick={() => setCreateOpen(false)}>
        <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-semibold text-slate-900">{t("admin.companies.createModalTitle")}</h2>
          <form className="mt-4" onSubmit={onCreateCompany}>
            <FormStack>
              <label className={labelClass}>
                {t("admin.companies.name")}
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className={labelClass}>
                {t("admin.companies.imageUrl")}
                <input className={inputClass} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              </label>
              <label className={labelClass}>
                {t("admin.companies.imageFile")}
                <input type="file" accept="image/*" className={inputClass} onChange={(e) => void onPickImageFile(e.target.files?.[0] ?? null)} />
              </label>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium text-slate-700">{t("admin.companies.customFieldsTitle")}</p>
                <div className="space-y-2">
                  {customFields.map((row, idx) => (
                    <div key={row.id} className="grid gap-2 sm:grid-cols-3">
                      <input className={inputClass} placeholder={t("admin.companies.customKey")} value={row.key} onChange={(e) => setCustomFields((prev) => prev.map((x, i) => (i === idx ? { ...x, key: e.target.value } : x)))} />
                      <input className={inputClass} placeholder={t("admin.companies.customValue")} value={row.value} onChange={(e) => setCustomFields((prev) => prev.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))} />
                      <input className={inputClass} placeholder={t("admin.companies.customContent")} value={row.content} onChange={(e) => setCustomFields((prev) => prev.map((x, i) => (i === idx ? { ...x, content: e.target.value } : x)))} />
                    </div>
                  ))}
                </div>
                <button type="button" className={`${btnSecondary} mt-3`} onClick={addCustomField}>
                  {t("admin.companies.addField")}
                </button>
              </div>
              <button type="button" className={btnSecondary} onClick={() => setPickerOpen(true)}>
                {t("admin.companies.attachUsers")}
              </button>
              <p className="text-xs text-slate-500">{t("admin.companies.selectedCount", { count: selectedAssignees.length })}</p>
              <div className="flex gap-2">
                <button type="submit" className={btnPrimary}>{t("admin.companies.create")}</button>
                <button type="button" className={btnSecondary} onClick={() => setCreateOpen(false)}>{t("common.close")}</button>
              </div>
            </FormStack>
          </form>
        </div>
      </div>

      <div className={modalBg(pickerOpen)} onClick={() => setPickerOpen(false)}>
        <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-semibold text-slate-900">{t("admin.companies.attachUsers")}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input className={inputClass} placeholder={t("admin.companies.filterByName")} value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} />
            <select className={inputClass} value={pickerRole} onChange={(e) => setPickerRole(e.target.value as "all" | "admin" | "user")}>
              <option value="all">{t("admin.companies.filterAllRoles")}</option>
              <option value="admin">{t("admin.users.roleAdmin")}</option>
              <option value="user">{t("admin.users.roleUser")}</option>
            </select>
          </div>
          <div className="mt-3 grid gap-1 sm:grid-cols-2">
            {filteredAssignees.map((a) => (
              <label key={a.id} className="inline-flex items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-sm">
                <input type="checkbox" checked={selectedAssignees.includes(a.id)} onChange={(e) => setSelectedAssignees((prev) => (e.target.checked ? [...prev, a.id] : prev.filter((x) => x !== a.id)))} />
                {a.full_name ?? "—"} · {a.role}
              </label>
            ))}
          </div>
          <button type="button" className={`${btnSecondary} mt-4`} onClick={() => setPickerOpen(false)}>{t("common.close")}</button>
        </div>
      </div>

      <div className={modalBg(listOpen)} onClick={() => setListOpen(false)}>
        <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-semibold text-slate-900">{t("admin.companies.listModalTitle")}</h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="max-h-[68vh] space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {companies.map((c) => (
                <div
                  key={c.id}
                  className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-left text-sm ${selectedCompanyId === c.id ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white"}`}
                  onClick={() => void loadCompanyDetails(c.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void loadCompanyDetails(c.id);
                    }
                  }}
                >
                  {c.image_url ? (
                    <div className="mb-2 flex">
                      <CompanyLogo src={c.image_url} alt={c.name} size="sm" maxAspectRatio={2.2} />
                    </div>
                  ) : null}
                  <p className="w-full text-left font-medium">
                    {c.name}
                  </p>
                  {canCreate ? (
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        className={`${btnSecondary} inline-flex h-9 w-9 items-center justify-center px-0`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(c);
                        }}
                        disabled={c.is_legacy}
                        aria-label={t("common.edit")}
                        title={c.is_legacy ? "Legacy-компанию нельзя редактировать" : t("common.edit")}
                      >
                        <span aria-hidden="true" className="text-base leading-none">✎</span>
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-0 py-0 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(c);
                        }}
                        disabled={c.is_legacy}
                        aria-label={t("common.delete")}
                        title={c.is_legacy ? "Legacy-компанию нельзя удалять" : t("common.delete")}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              {detailsLoading ? (
                <ListLoading label={t("common.loading")} className="py-8" />
              ) : !details ? (
                <p className="text-sm text-slate-600">{t("admin.companies.pickCompanyForDetails")}</p>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btnSecondary} onClick={() => void exportCompany()} disabled={exporting}>
                      {t("admin.companies.exportCompanyFull")}
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Stat label={t("admin.companies.statsEvents")} value={details.events.length} />
                    <Stat label={t("admin.companies.statsAdmins")} value={details.admins.length} />
                    <Stat label={t("admin.companies.statsUsers")} value={details.users.length} />
                    <Stat label={t("admin.companies.statsTickets")} value={details.tickets.length} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{t("admin.companies.companyEventsTitle")}</p>
                    <ul className="mt-2 space-y-1">
                      {details.events.map((ev) => (
                        <li key={ev.id} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1.5">
                          <span>{ev.title} · {ev.event_date}</span>
                          <button type="button" className={btnSecondary} onClick={() => void exportCompany(ev.id)} disabled={exporting}>
                            {t("admin.companies.exportEvent")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{t("admin.companies.companyAdminsTitle")}</p>
                    <ul className="mt-1 list-disc pl-6 text-slate-700">
                      {details.admins.map((x) => <li key={x.id}>{x.full_name ?? "—"} · {x.phone ?? "—"}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{t("admin.companies.companyUsersTitle")}</p>
                    <ul className="mt-1 list-disc pl-6 text-slate-700">
                      {details.users.map((x) => <li key={x.id}>{x.full_name ?? "—"} · {x.phone ?? "—"}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
          <button type="button" className={`${btnSecondary} mt-4`} onClick={() => setListOpen(false)}>{t("common.close")}</button>
        </div>
      </div>

      <div className={modalBg(grantOpen)} onClick={() => setGrantOpen(false)}>
        <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-semibold text-slate-900">{t("admin.companies.grantTitle")}</h2>
          {isSuper ? (
            <>
              <form className="mt-3" onSubmit={onGrantCompanyAccess}>
                <FormStack>
                  <label className={labelClass}>
                    {t("admin.companies.grantCompany")}
                    <select className={inputClass} value={grantCompanyId} onChange={(e) => { setGrantCompanyId(e.target.value); void loadCompanyAccess(e.target.value); }} required>
                      <option value="">{t("admin.companies.grantSelectCompany")}</option>
                      {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label className={labelClass}>
                    {t("admin.companies.grantAdmin")}
                    <select className={inputClass} value={grantAdminId} onChange={(e) => setGrantAdminId(e.target.value)} required>
                      <option value="">{t("admin.companies.grantSelectAdmin")}</option>
                      {adminsOnly.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? a.id}</option>)}
                    </select>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={grantAllEvents} onChange={(e) => setGrantAllEvents(e.target.checked)} />
                    {t("admin.companies.grantAllEvents")}
                  </label>
                  {!grantAllEvents ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-sm font-medium text-slate-700">{t("admin.companies.grantSelectedEvents")}</p>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {companyEvents.map((ev) => (
                          <label key={ev.id} className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={grantEventIds.includes(ev.id)} onChange={(e) => setGrantEventIds((prev) => e.target.checked ? [...prev, ev.id] : prev.filter((x) => x !== ev.id))} />
                            {ev.title}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <button type="submit" className={btnPrimary}>{t("admin.companies.grantButton")}</button>
                </FormStack>
              </form>
              <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-medium text-slate-700">{t("admin.companies.currentAccessTitle")}</p>
                {!grantCompanyId ? (
                  <p className="text-sm text-slate-600">{t("admin.companies.currentAccessPickCompany")}</p>
                ) : companyAccessLoading ? (
                  <ListLoading label={t("common.loading")} className="py-6" />
                ) : companyAccessRows.length === 0 ? (
                  <p className="text-sm text-slate-600">{t("admin.companies.currentAccessEmpty")}</p>
                ) : (
                  <ul className="space-y-2">
                    {companyAccessRows.map((row) => (
                      <li key={row.adminId} className="rounded border border-slate-200 bg-white p-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{row.adminName ?? row.adminId}</p>
                          <button type="button" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100" onClick={() => void revokeCompanyAccess(row.adminId)}>{t("admin.companies.revokeButton")}</button>
                        </div>
                        {!row.allEvents && row.eventIds.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <select multiple className={`${inputClass} min-h-20 w-64 text-xs`} value={partialRevokeByAdmin[row.adminId] ?? []} onChange={(e) => setPartialRevokeByAdmin((prev) => ({ ...prev, [row.adminId]: Array.from(e.target.selectedOptions).map((o) => o.value) }))}>
                              {row.eventIds.map((id) => <option key={id} value={id}>{companyEvents.find((x) => x.id === id)?.title ?? id}</option>)}
                            </select>
                            <button type="button" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100" onClick={() => void revokeSelectedEvents(row.adminId)}>{t("admin.companies.revokeSelectedButton")}</button>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-600">{t("admin.companies.currentAccessAllEvents")}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">{t("admin.companies.grantOnlySuper")}</p>
          )}
          <button type="button" className={`${btnSecondary} mt-4`} onClick={() => setGrantOpen(false)}>{t("common.close")}</button>
        </div>
      </div>

      <div className={modalBg(editOpen)}>
        <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {t("common.edit")} {editCompany ? `· ${editCompany.name}` : ""}
            </h2>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() => setEditOpen(false)}
              aria-label={t("common.close")}
              title={t("common.close")}
            >
              <span aria-hidden="true" className="text-lg leading-none">×</span>
            </button>
          </div>
          <form className="mt-4" onSubmit={submitEditCompany}>
            <FormStack>
              {editImageUrl ? (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <CompanyLogo
                    src={editImageUrl}
                    alt={editName || editCompany?.name || "Company logo"}
                    size="md"
                    maxAspectRatio={2.4}
                  />
                  <p className="text-xs text-slate-600">{t("admin.companies.imageFile")}</p>
                </div>
              ) : null}
              <label className={labelClass}>
                {t("admin.companies.name")}
                <input className={inputClass} value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </label>
              <label className={labelClass}>
                {t("admin.companies.imageUrl")}
                <input className={inputClass} value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} placeholder="https://..." />
              </label>
              <label className={labelClass}>
                {t("admin.companies.imageFile")}
                <input type="file" accept="image/*" className={inputClass} onChange={(e) => void onPickEditImageFile(e.target.files?.[0] ?? null)} />
              </label>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium text-slate-700">{t("admin.companies.customFieldsTitle")}</p>
                <div className="space-y-2">
                  {editCustomFields.map((row, idx) => (
                    <div key={row.id} className="grid gap-2 sm:grid-cols-3">
                      <input className={inputClass} placeholder={t("admin.companies.customKey")} value={row.key} onChange={(e) => setEditCustomFields((prev) => prev.map((x, i) => (i === idx ? { ...x, key: e.target.value } : x)))} />
                      <input className={inputClass} placeholder={t("admin.companies.customValue")} value={row.value} onChange={(e) => setEditCustomFields((prev) => prev.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))} />
                      <input className={inputClass} placeholder={t("admin.companies.customContent")} value={row.content} onChange={(e) => setEditCustomFields((prev) => prev.map((x, i) => (i === idx ? { ...x, content: e.target.value } : x)))} />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className={`${btnSecondary} mt-3`}
                  onClick={() =>
                    setEditCustomFields((prev) => [
                      ...prev,
                      { id: crypto.randomUUID(), key: "", value: "", content: "" },
                    ])
                  }
                >
                  {t("admin.companies.addField")}
                </button>
              </div>
              {editError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {editError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={btnPrimary}>{t("common.save")}</button>
                <button type="button" className={btnSecondary} onClick={() => setEditOpen(false)}>{t("common.cancel")}</button>
                {editCompany ? (
                  <button
                    type="button"
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100"
                    onClick={() => void deleteCompany(editCompany)}
                  >
                    {t("common.delete")}
                  </button>
                ) : null}
              </div>
            </FormStack>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

