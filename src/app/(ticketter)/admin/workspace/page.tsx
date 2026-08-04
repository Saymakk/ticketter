"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import type { WorkspaceProject } from "@/lib/workspace/types";
import {
  AppCard,
  AppShell,
  btnDanger,
  btnPrimary,
  btnSecondary,
  FormStack,
  inputClass,
  labelClass,
  ListLoading,
  PageHeaderWithBack,
} from "@/components/ui/app-shell";

type FormState = {
  name: string;
  url: string;
  description: string;
  thumbnail_url: string;
  is_visible: boolean;
};

const emptyForm: FormState = {
  name: "",
  url: "",
  description: "",
  thumbnail_url: "",
  is_visible: true,
};

export default function AdminWorkspacePage() {
  const { t } = useLocaleContext();
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceProject | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await trackedFetch("/api/admin/workspace/projects", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t("admin.workspace.loadError"));
        setProjects([]);
        return;
      }
      setProjects(json.projects ?? []);
    } catch {
      setError(t("admin.workspace.loadError"));
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
    setMessage("");
    setError("");
  }

  function openEdit(project: WorkspaceProject) {
    setEditing(project);
    setForm({
      name: project.name,
      url: project.url,
      description: project.description ?? "",
      thumbnail_url: project.thumbnail_url ?? "",
      is_visible: project.is_visible,
    });
    setFormOpen(true);
    setMessage("");
    setError("");
  }

  async function uploadThumbnail(file: File) {
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.set("thumbnail", file);
      const res = await trackedFetch("/api/admin/workspace/upload", {
        method: "POST",
        body,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t("admin.workspace.uploadError"));
        return;
      }
      setForm((prev) => ({ ...prev, thumbnail_url: json.url ?? "" }));
    } catch {
      setError(t("admin.workspace.uploadError"));
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: form.name.trim(),
        url: form.url.trim(),
        description: form.description.trim() || null,
        thumbnail_url: form.thumbnail_url.trim() || null,
        is_visible: form.is_visible,
      };

      const res = editing
        ? await trackedFetch(`/api/admin/workspace/projects/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await trackedFetch("/api/admin/workspace/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t("admin.workspace.saveError"));
        return;
      }

      setMessage(editing ? t("admin.workspace.updated") : t("admin.workspace.created"));
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch {
      setError(t("admin.workspace.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisible(project: WorkspaceProject) {
    setError("");
    try {
      const res = await trackedFetch(`/api/admin/workspace/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: !project.is_visible }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t("admin.workspace.saveError"));
        return;
      }
      await load();
    } catch {
      setError(t("admin.workspace.saveError"));
    }
  }

  async function remove(project: WorkspaceProject) {
    if (!window.confirm(t("admin.workspace.deleteConfirm", { name: project.name }))) {
      return;
    }
    setError("");
    try {
      const res = await trackedFetch(`/api/admin/workspace/projects/${project.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t("admin.workspace.deleteError"));
        return;
      }
      setMessage(t("admin.workspace.deleted"));
      await load();
    } catch {
      setError(t("admin.workspace.deleteError"));
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= projects.length) return;

    const next = [...projects];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    setProjects(next);

    setError("");
    try {
      const res = await trackedFetch("/api/admin/workspace/projects/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((p) => p.id) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t("admin.workspace.reorderError"));
        await load();
        return;
      }
      if (json.projects) setProjects(json.projects);
    } catch {
      setError(t("admin.workspace.reorderError"));
      await load();
    }
  }

  return (
    <AppShell maxWidth="max-w-4xl">
      <PageHeaderWithBack
        backHref="/admin"
        backLabel={t("common.toPanel")}
        title={t("admin.workspace.title")}
        description={t("admin.workspace.subtitle")}
      />
      <AppCard>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" className={btnPrimary} onClick={openCreate}>
            {t("admin.workspace.add")}
          </button>
          <a
            href="/workspace"
            target="_blank"
            rel="noopener noreferrer"
            className={btnSecondary}
          >
            {t("admin.workspace.openPortal")}
          </a>
          <button type="button" className={btnSecondary} onClick={() => void load()}>
            {t("admin.workspace.refresh")}
          </button>
        </div>

        {message ? (
          <p className="mb-3 text-sm text-teal-700">{message}</p>
        ) : null}
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        {loading ? (
          <ListLoading />
        ) : projects.length === 0 ? (
          <p className="text-sm text-slate-600">{t("admin.workspace.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {projects.map((project, index) => (
              <li
                key={project.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {project.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={project.thumbnail_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-slate-900">{project.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          project.is_visible
                            ? "bg-teal-50 text-teal-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {project.is_visible
                          ? t("admin.workspace.visible")
                          : t("admin.workspace.hidden")}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{project.url}</p>
                    {project.description ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">
                        {project.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={index === 0}
                    onClick={() => void move(index, -1)}
                    title={t("admin.workspace.moveUp")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={index === projects.length - 1}
                    onClick={() => void move(index, 1)}
                    title={t("admin.workspace.moveDown")}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => void toggleVisible(project)}
                  >
                    {project.is_visible
                      ? t("admin.workspace.hide")
                      : t("admin.workspace.show")}
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => openEdit(project)}
                  >
                    {t("common.edit")}
                  </button>
                  <button
                    type="button"
                    className={btnDanger}
                    onClick={() => void remove(project)}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      {formOpen ? (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              {editing ? t("admin.workspace.editTitle") : t("admin.workspace.createTitle")}
            </h2>
            <form className="mt-4" onSubmit={(e) => void onSubmit(e)}>
              <FormStack>
                <label className={labelClass}>
                  {t("admin.workspace.fieldName")}
                  <input
                    className={inputClass}
                    required
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </label>
                <label className={labelClass}>
                  {t("admin.workspace.fieldUrl")}
                  <input
                    className={inputClass}
                    required
                    type="text"
                    placeholder="https://…"
                    value={form.url}
                    onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                  />
                </label>
                <label className={labelClass}>
                  {t("admin.workspace.fieldDescription")}
                  <textarea
                    className={`${inputClass} min-h-[72px]`}
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                  />
                </label>
                <div>
                  <label className={labelClass}>
                    {t("admin.workspace.fieldThumbnail")}
                    <input
                      className={inputClass}
                    type="text"
                    placeholder="https://…"
                    value={form.thumbnail_url}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, thumbnail_url: e.target.value }))
                      }
                    />
                  </label>
                  <label className="mt-2 block text-sm text-slate-600">
                    {t("admin.workspace.uploadThumbnail")}
                    <input
                      className="mt-1.5 block w-full text-sm"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadThumbnail(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {form.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.thumbnail_url}
                      alt=""
                      className="mt-3 h-24 w-40 rounded-xl object-cover ring-1 ring-slate-200"
                    />
                  ) : null}
                  {uploading ? (
                    <p className="mt-2 text-xs text-slate-500">
                      {t("admin.workspace.uploading")}
                    </p>
                  ) : null}
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_visible}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, is_visible: e.target.checked }))
                    }
                  />
                  {t("admin.workspace.fieldVisible")}
                </label>
              </FormStack>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setFormOpen(false);
                    setEditing(null);
                  }}
                >
                  {t("common.cancel")}
                </button>
                <button type="submit" className={btnPrimary} disabled={saving || uploading}>
                  {saving ? t("common.loading") : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
