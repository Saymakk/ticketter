"use client";

import { useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import {
  AppCard,
  AppShell,
  BackNav,
  btnPrimary,
  inputClass,
  ListLoading,
} from "@/components/ui/app-shell";

type ActorProfile = {
  full_name: string | null;
  phone: string | null;
  role: string;
};

type LogRow = {
  id: string;
  created_at: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  path: string | null;
  method: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  actorProfile: ActorProfile | null;
};

export default function AuditLogsPage() {
  const { t } = useLocaleContext();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 200;

  async function load(nextOffset: number) {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams();
      sp.set("limit", String(limit));
      sp.set("offset", String(nextOffset));
      if (actorFilter.trim()) sp.set("actorId", actorFilter.trim());
      if (actionFilter.trim()) sp.set("action", actionFilter.trim());
      const res = await trackedFetch(`/api/super-admin/audit-logs?${sp}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t("admin.audit.loadError"));
        setLogs([]);
        return;
      }
      setLogs(json.logs ?? []);
      setOffset(nextOffset);
    } catch {
      setError(t("admin.audit.networkError"));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- первичная загрузка
  }, []);

  return (
    <AppShell maxWidth="max-w-6xl">
      <BackNav href="/admin">{t("common.toPanel")}</BackNav>
      <AppCard title={t("admin.audit.title")} subtitle={t("admin.audit.subtitle")}>
        <form
          className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void load(0);
          }}
        >
          <label className="block min-w-[12rem] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              {t("admin.audit.filterActorId")}
            </span>
            <input
              className={inputClass}
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              placeholder="uuid"
            />
          </label>
          <label className="block min-w-[12rem] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              {t("admin.audit.filterAction")}
            </span>
            <input
              className={inputClass}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="ticket.check_in"
            />
          </label>
          <button type="submit" className={btnPrimary}>
            {t("admin.audit.apply")}
          </button>
        </form>

        {loading ? (
          <ListLoading label={t("common.loading")} />
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-600">{t("admin.audit.empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="whitespace-nowrap px-2 py-2">{t("admin.audit.colTime")}</th>
                  <th className="whitespace-nowrap px-2 py-2">{t("admin.audit.colWho")}</th>
                  <th className="whitespace-nowrap px-2 py-2">{t("admin.audit.colAction")}</th>
                  <th className="whitespace-nowrap px-2 py-2">{t("admin.audit.colResource")}</th>
                  <th className="whitespace-nowrap px-2 py-2">{t("admin.audit.colWhere")}</th>
                  <th className="min-w-[8rem] px-2 py-2">{t("admin.audit.colDetails")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {logs.map((row) => (
                  <tr key={row.id} className="align-top text-slate-800">
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px] text-slate-600">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium">
                        {row.actorProfile?.full_name ?? "—"}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">{row.actor_id}</div>
                      {row.actorProfile?.phone ? (
                        <div className="text-[10px] text-slate-500">{row.actorProfile.phone}</div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px]">
                      {row.action}
                    </td>
                    <td className="px-2 py-2">
                      <div>{row.resource_type}</div>
                      {row.resource_id ? (
                        <div className="break-all font-mono text-[10px] text-slate-500">
                          {row.resource_id}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-mono text-[10px]">{row.method ?? "—"}</div>
                      <div className="break-all text-[10px] text-slate-600">{row.path ?? "—"}</div>
                      <div className="text-[10px] text-slate-500">{row.ip ?? ""}</div>
                    </td>
                    <td className="px-2 py-2 font-mono text-[10px] text-slate-700">
                      {row.metadata ? (
                        <pre className="max-h-32 max-w-xs overflow-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(row.metadata, null, 0)}
                        </pre>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && logs.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={offset === 0}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
              onClick={() => void load(Math.max(0, offset - limit))}
            >
              {t("admin.audit.prev")}
            </button>
            <button
              type="button"
              disabled={logs.length < limit}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40"
              onClick={() => void load(offset + limit)}
            >
              {t("admin.audit.next")}
            </button>
          </div>
        )}
      </AppCard>
    </AppShell>
  );
}
