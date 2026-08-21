"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import {
  formatFileSize,
  type WorkspaceAttachment,
  type WorkspaceBlockKind,
  type WorkspaceDisplaySize,
  type WorkspaceDisplayVariant,
  type WorkspaceGridColumns,
} from "@/lib/workspace/layout";
import type { WorkspacePageSettings, WorkspaceProject } from "@/lib/workspace/types";
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
  kind: WorkspaceBlockKind;
  name: string;
  url: string;
  description: string;
  thumbnail_url: string;
  is_visible: boolean;
  display_size: WorkspaceDisplaySize;
  display_variant: WorkspaceDisplayVariant;
  file_name: string;
  file_size: number | null;
  file_mime: string;
  attachments: WorkspaceAttachment[];
};

const emptyForm: FormState = {
  kind: "site",
  name: "",
  url: "",
  description: "",
  thumbnail_url: "",
  is_visible: true,
  display_size: "m",
  display_variant: "card",
  file_name: "",
  file_size: null,
  file_mime: "",
  attachments: [],
};

const chip =
  "inline-flex min-h-9 flex-col items-start justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50";
const chipOn =
  "inline-flex min-h-9 flex-col items-start justify-center rounded-lg border border-teal-600 bg-teal-600 px-3 py-1.5 text-left text-sm font-medium text-white shadow-sm";

function formFromProject(project: WorkspaceProject): FormState {
  return {
    kind: project.kind,
    name: project.name,
    url: project.url,
    description: project.description ?? "",
    thumbnail_url: project.thumbnail_url ?? "",
    is_visible: project.is_visible,
    display_size: project.display_size,
    display_variant: project.display_variant,
    file_name: project.file_name ?? "",
    file_size: project.file_size,
    file_mime: project.file_mime ?? "",
    attachments: project.attachments ?? [],
  };
}

export default function AdminWorkspacePage() {
  const { t } = useLocaleContext();
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [page, setPage] = useState({
    kicker: "myworkspace",
    title: "Workspace",
    subtitle: "Все проекты в одном месте.",
    footer: "myworkspace.su",
    columns: 3 as WorkspaceGridColumns,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPage, setSavingPage] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WorkspaceProject | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [projectsRes, pageRes] = await Promise.all([
        trackedFetch("/api/admin/workspace/projects", { cache: "no-store" }),
        trackedFetch("/api/admin/workspace/page", { cache: "no-store" }),
      ]);
      const projectsJson = await projectsRes.json();
      if (!projectsRes.ok) {
        setError(projectsJson.error || t("admin.workspace.loadError"));
        setProjects([]);
        return;
      }
      setProjects(projectsJson.projects ?? []);

      if (pageRes.ok) {
        const pageJson = (await pageRes.json()) as { settings?: WorkspacePageSettings };
        if (pageJson.settings) {
          setPage({
            kicker: pageJson.settings.kicker,
            title: pageJson.settings.title,
            subtitle: pageJson.settings.subtitle,
            footer: pageJson.settings.footer,
            columns: pageJson.settings.columns,
          });
        }
      }
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

  function openCreate(kind: WorkspaceBlockKind) {
    setEditing(null);
    setForm({
      ...emptyForm,
      kind,
      display_variant: kind === "file" ? "compact" : "card",
    });
    setFormOpen(true);
    setMessage("");
    setError("");
  }

  function openEdit(project: WorkspaceProject) {
    setEditing(project);
    setForm(formFromProject(project));
    setFormOpen(true);
    setMessage("");
    setError("");
  }

  async function uploadAsset(file: File, purpose: "thumbnail" | "file") {
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.set("purpose", purpose);
      body.set("file", file);
      const res = await trackedFetch("/api/admin/workspace/upload", {
        method: "POST",
        body,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(
          json.error ||
            (purpose === "file"
              ? t("admin.workspace.uploadFileError")
              : t("admin.workspace.uploadError"))
        );
        return null;
      }
      return json as { url: string; name: string; size: number; mime: string };
    } catch {
      setError(
        purpose === "file"
          ? t("admin.workspace.uploadFileError")
          : t("admin.workspace.uploadError")
      );
      return null;
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
        kind: form.kind,
        name: form.name.trim(),
        url: form.url.trim(),
        description: form.description.trim() || null,
        thumbnail_url: form.thumbnail_url.trim() || null,
        is_visible: form.is_visible,
        display_size: form.display_size,
        display_variant: form.display_variant,
        file_name: form.kind === "file" ? form.file_name.trim() || form.name.trim() : null,
        file_size: form.kind === "file" ? form.file_size : null,
        file_mime: form.kind === "file" ? form.file_mime.trim() || null : null,
        attachments: form.attachments,
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

  async function savePage(e: FormEvent) {
    e.preventDefault();
    setSavingPage(true);
    setError("");
    setMessage("");
    try {
      const res = await trackedFetch("/api/admin/workspace/page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || t("admin.workspace.pageSaveError"));
        return;
      }
      if (json.settings) {
        setPage({
          kicker: json.settings.kicker,
          title: json.settings.title,
          subtitle: json.settings.subtitle,
          footer: json.settings.footer,
          columns: json.settings.columns,
        });
      }
      setMessage(t("admin.workspace.pageSaved"));
    } catch {
      setError(t("admin.workspace.pageSaveError"));
    } finally {
      setSavingPage(false);
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

  const sizeOptions: { id: WorkspaceDisplaySize; label: string }[] = [
    { id: "s", label: t("admin.workspace.sizeS") },
    { id: "m", label: t("admin.workspace.sizeM") },
    { id: "l", label: t("admin.workspace.sizeL") },
    { id: "xl", label: t("admin.workspace.sizeXl") },
  ];
  const variantOptions: { id: WorkspaceDisplayVariant; label: string }[] = [
    { id: "card", label: t("admin.workspace.variantCard") },
    { id: "compact", label: t("admin.workspace.variantCompact") },
    { id: "wide", label: t("admin.workspace.variantWide") },
    { id: "tile", label: t("admin.workspace.variantTile") },
  ];

  function kindLabel(kind: WorkspaceBlockKind) {
    return kind === "file" ? t("admin.workspace.kindFile") : t("admin.workspace.kindSite");
  }

  function sizeLabel(size: WorkspaceDisplaySize) {
    return sizeOptions.find((s) => s.id === size)?.label ?? size;
  }

  function variantLabel(variant: WorkspaceDisplayVariant) {
    return variantOptions.find((s) => s.id === variant)?.label ?? variant;
  }

  const formTitle = editing
    ? form.kind === "file"
      ? t("admin.workspace.editFileTitle")
      : t("admin.workspace.editSiteTitle")
    : form.kind === "file"
      ? t("admin.workspace.createFileTitle")
      : t("admin.workspace.createSiteTitle");

  return (
    <AppShell maxWidth="max-w-4xl">
      <PageHeaderWithBack
        backHref="/admin"
        backLabel={t("common.toPanel")}
        title={t("admin.workspace.title")}
        description={t("admin.workspace.subtitle")}
      />

      {message ? (
        <p className="mb-4 text-sm text-teal-700">{message}</p>
      ) : null}
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <AppCard>
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          {t("admin.workspace.pageTitle")}
        </h2>
        <form onSubmit={(e) => void savePage(e)}>
          <FormStack fullWidth>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                {t("admin.workspace.pageKicker")}
                <input
                  className={inputClass}
                  value={page.kicker}
                  onChange={(e) => setPage((p) => ({ ...p, kicker: e.target.value }))}
                />
              </label>
              <label className={labelClass}>
                {t("admin.workspace.pageHeroTitle")}
                <input
                  className={inputClass}
                  required
                  value={page.title}
                  onChange={(e) => setPage((p) => ({ ...p, title: e.target.value }))}
                />
              </label>
            </div>
            <label className={labelClass}>
              {t("admin.workspace.pageHeroSubtitle")}
              <textarea
                className={`${inputClass} min-h-[72px]`}
                value={page.subtitle}
                onChange={(e) => setPage((p) => ({ ...p, subtitle: e.target.value }))}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                {t("admin.workspace.pageFooter")}
                <input
                  className={inputClass}
                  value={page.footer}
                  onChange={(e) => setPage((p) => ({ ...p, footer: e.target.value }))}
                />
              </label>
              <div>
                <p className={labelClass}>{t("admin.workspace.pageColumns")}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {([2, 3, 4] as WorkspaceGridColumns[]).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={page.columns === n ? chipOn : chip}
                      onClick={() => setPage((p) => ({ ...p, columns: n }))}
                    >
                      {t(`admin.workspace.columns${n}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button type="submit" className={btnPrimary} disabled={savingPage}>
              {savingPage ? t("common.loading") : t("common.save")}
            </button>
          </FormStack>
        </form>
      </AppCard>

      <div className="mt-6">
        <AppCard>
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            {t("admin.workspace.blocksTitle")}
          </h2>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button type="button" className={btnPrimary} onClick={() => openCreate("site")}>
              {t("admin.workspace.addSite")}
            </button>
            <button type="button" className={btnPrimary} onClick={() => openCreate("file")}>
              {t("admin.workspace.addFile")}
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
                          {project.kind === "file"
                            ? "↓"
                            : project.name.charAt(0).toUpperCase()}
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
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {kindLabel(project.kind)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {sizeLabel(project.display_size)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {variantLabel(project.display_variant)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-500">{project.url}</p>
                      {project.description ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">
                          {project.description}
                        </p>
                      ) : null}
                      {project.attachments.length > 0 ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {t("admin.workspace.attachments")}: {project.attachments.length}
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
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">{formTitle}</h2>
            <form className="mt-4" onSubmit={(e) => void onSubmit(e)}>
              <FormStack fullWidth>
                <div>
                  <p className={labelClass}>{t("admin.workspace.kind")}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(["site", "file"] as WorkspaceBlockKind[]).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        className={form.kind === kind ? chipOn : chip}
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            kind,
                            display_variant:
                              kind === "file" && p.display_variant === "card"
                                ? "compact"
                                : p.display_variant,
                          }))
                        }
                      >
                        {kindLabel(kind)}
                      </button>
                    ))}
                  </div>
                </div>

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
                  {form.kind === "file"
                    ? t("admin.workspace.fieldUrlFile")
                    : t("admin.workspace.fieldUrlSite")}
                  <input
                    className={inputClass}
                    required
                    type="text"
                    placeholder="https://…"
                    value={form.url}
                    onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                  />
                </label>

                {form.kind === "file" ? (
                  <div>
                    <p className={labelClass}>{t("admin.workspace.fieldFile")}</p>
                    <label className="mt-1.5 block text-sm text-slate-600">
                      {t("admin.workspace.uploadFile")}
                      <input
                        className="mt-1.5 block w-full text-sm"
                        type="file"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          void uploadAsset(file, "file").then((uploaded) => {
                            if (!uploaded) return;
                            setForm((p) => ({
                              ...p,
                              url: uploaded.url,
                              file_name: uploaded.name,
                              file_size: uploaded.size,
                              file_mime: uploaded.mime,
                              name: p.name || uploaded.name.replace(/\.[^.]+$/, ""),
                            }));
                          });
                        }}
                      />
                    </label>
                    {form.file_name ? (
                      <p className="mt-2 text-xs text-slate-600">
                        {t("admin.workspace.fileReady", {
                          name: `${form.file_name}${
                            formatFileSize(form.file_size)
                              ? ` · ${formatFileSize(form.file_size)}`
                              : ""
                          }`,
                        })}
                      </p>
                    ) : null}
                  </div>
                ) : null}

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
                  <p className={labelClass}>{t("admin.workspace.size")}</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {sizeOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={form.display_size === opt.id ? chipOn : chip}
                        onClick={() =>
                          setForm((p) => ({ ...p, display_size: opt.id }))
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className={labelClass}>{t("admin.workspace.variant")}</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {variantOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={form.display_variant === opt.id ? chipOn : chip}
                        onClick={() =>
                          setForm((p) => ({ ...p, display_variant: opt.id }))
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

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
                        e.target.value = "";
                        if (!file) return;
                        void uploadAsset(file, "thumbnail").then((uploaded) => {
                          if (!uploaded) return;
                          setForm((p) => ({ ...p, thumbnail_url: uploaded.url }));
                        });
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
                </div>

                <div>
                  <p className={labelClass}>{t("admin.workspace.attachments")}</p>
                  <label className="mt-1.5 block text-sm text-slate-600">
                    {t("admin.workspace.addAttachment")}
                    <input
                      className="mt-1.5 block w-full text-sm"
                      type="file"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        void uploadAsset(file, "file").then((uploaded) => {
                          if (!uploaded) return;
                          setForm((p) => ({
                            ...p,
                            attachments: [
                              ...p.attachments,
                              {
                                url: uploaded.url,
                                name: uploaded.name,
                                size: uploaded.size,
                                mime: uploaded.mime,
                              },
                            ],
                          }));
                        });
                      }}
                    />
                  </label>
                  {form.attachments.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {form.attachments.map((file, i) => (
                        <li
                          key={`${file.url}-${i}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate text-slate-700">
                            {file.name}
                            {formatFileSize(file.size)
                              ? ` · ${formatFileSize(file.size)}`
                              : ""}
                          </span>
                          <button
                            type="button"
                            className={btnDanger}
                            onClick={() =>
                              setForm((p) => ({
                                ...p,
                                attachments: p.attachments.filter((_, idx) => idx !== i),
                              }))
                            }
                          >
                            {t("admin.workspace.removeAttachment")}
                          </button>
                        </li>
                      ))}
                    </ul>
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

                {uploading ? (
                  <p className="text-xs text-slate-500">{t("admin.workspace.uploading")}</p>
                ) : null}
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
