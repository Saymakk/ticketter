"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import {
  AppCard,
  AppShell,
  PageHeaderWithBack,
  btnDanger,
  btnPrimary,
  btnSecondary,
  FormStack,
  inputClass,
  labelClass,
  ListLoading,
  selectClass,
} from "@/components/ui/app-shell";
import { DeleteActionIcon, EditActionIcon } from "@/components/ui/action-icons";

type EventField = {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  sort_order: number | null;
  options: unknown;
};

function optionsToText(opts: unknown): string {
  if (Array.isArray(opts)) {
    return (opts as string[]).join("\n");
  }
  return "";
}

function parseOptions(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function EventFieldsPage() {
  const { t } = useLocaleContext();
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;

  const [fields, setFields] = useState<EventField[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<"text" | "textarea" | "select">("text");
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState("");

  const [eventPast, setEventPast] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editType, setEditType] = useState<"text" | "textarea" | "select">("text");
  const [editRequired, setEditRequired] = useState(false);
  const [editOptions, setEditOptions] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const [res, eventRes] = await Promise.all([
        trackedFetch(`/api/super-admin/events/${eventId}/fields`, { cache: "no-store" }),
        trackedFetch(`/api/admin/events/${eventId}`, { cache: "no-store" }),
      ]);
      const eventJson = await eventRes.json();
      if (eventRes.ok) {
        const past = !!eventJson.event?.isPast;
        setEventPast(past);
        if (past) setEditingId(null);
      } else {
        setEventPast(false);
      }

      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? t("fields.loadFailed"));
        setFields([]);
        return;
      }
      setFields(json.fields ?? []);
    } catch {
      setMessage(t("fields.netError"));
      setFields([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (eventId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- перезагрузка только при смене eventId
  }, [eventId]);

  function startEdit(f: EventField) {
    if (eventPast) return;
    setEditingId(f.id);
    setEditKey(f.field_key);
    setEditLabel(f.field_label);
    setEditType((f.field_type as "text" | "textarea" | "select") || "text");
    setEditRequired(f.is_required);
    setEditOptions(optionsToText(f.options));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (eventPast) return;
    const key = newKey.trim();
    const label = newLabel.trim();
    if (!/^[a-z0-9_]+$/.test(key)) {
      setMessage(t("fields.keyLatin"));
      return;
    }
    if (!label) {
      setMessage(t("fields.fieldLabelRequired"));
      return;
    }
    const opts = newType === "select" ? parseOptions(newOptions) : undefined;
    if (newType === "select" && (!opts || opts.length === 0)) {
      setMessage(t("fields.selectOptions"));
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const res = await trackedFetch(`/api/super-admin/events/${eventId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldKey: key,
          fieldLabel: label,
          fieldType: newType,
          isRequired: newRequired,
          ...(opts?.length ? { options: opts } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? t("fields.saveFailed"));
        return;
      }
      setNewKey("");
      setNewLabel("");
      setNewType("text");
      setNewRequired(false);
      setNewOptions("");
      await load();
    } catch {
      setMessage(t("fields.netError"));
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEdit(fieldId: string) {
    if (eventPast) return;
    const key = editKey.trim();
    const label = editLabel.trim();
    if (!/^[a-z0-9_]+$/.test(key)) {
      setMessage(t("fields.keyShort"));
      return;
    }
    if (!label) {
      setMessage(t("fields.labelShort"));
      return;
    }
    const opts = editType === "select" ? parseOptions(editOptions) : null;
    if (editType === "select" && (!opts || opts.length === 0)) {
      setMessage(t("fields.selectShort"));
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const res = await trackedFetch(`/api/super-admin/events/${eventId}/fields/${fieldId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldKey: key,
          fieldLabel: label,
          fieldType: editType,
          isRequired: editRequired,
          options: editType === "select" ? opts : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? t("fields.saveFailed"));
        return;
      }
      cancelEdit();
      await load();
    } catch {
      setMessage(t("fields.netError"));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(fieldId: string) {
    if (eventPast) return;
    const ok = window.confirm(t("fields.deleteConfirm"));
    if (!ok) return;
    setMessage("");
    try {
      const res = await trackedFetch(`/api/super-admin/events/${eventId}/fields/${fieldId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? t("fields.deleteFailed"));
        return;
      }
      if (editingId === fieldId) cancelEdit();
      await load();
    } catch {
      setMessage(t("fields.netError"));
    }
  }

  return (
    <AppShell maxWidth="max-w-2xl">
      <PageHeaderWithBack
        backHref="/admin/manage/events"
        backLabel={t("fields.back")}
        title={t("fields.title")}
      />
      <AppCard>
        {eventPast && !loading ? (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {t("fields.eventPastReadOnly")}
          </p>
        ) : null}
        {loading ? (
          <ListLoading label={t("fields.loading")} />
        ) : (
          <ul className="mb-8 space-y-4">
            {fields.length === 0 ? (
              <li className="text-sm text-slate-600">{t("fields.empty")}</li>
            ) : (
              fields.map((f) => (
                <li
                  key={f.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm"
                >
                  {editingId === f.id && !eventPast ? (
                    <div className="space-y-3">
                      <label className={labelClass}>
                        {t("fields.editKeyPh")}
                        <input
                          className={inputClass}
                          value={editKey}
                          onChange={(e) => setEditKey(e.target.value)}
                        />
                      </label>
                      <label className={labelClass}>
                        {t("fields.editLabelPh")}
                        <input
                          className={inputClass}
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                        />
                      </label>
                      <label className={labelClass}>
                        {t("fields.editType")}
                        <select
                          className={selectClass}
                          value={editType}
                          onChange={(e) =>
                            setEditType(e.target.value as "text" | "textarea" | "select")
                          }
                        >
                          <option value="text">{t("admin.manage.fieldTypeText")}</option>
                          <option value="textarea">{t("admin.manage.fieldTypeTextarea")}</option>
                          <option value="select">{t("admin.manage.fieldTypeSelect")}</option>
                        </select>
                      </label>
                      {editType === "select" && (
                        <label className={labelClass}>
                          {t("fields.editOptions")}
                          <textarea
                            className={inputClass}
                            rows={4}
                            value={editOptions}
                            onChange={(e) => setEditOptions(e.target.value)}
                          />
                        </label>
                      )}
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={editRequired}
                          onChange={(e) => setEditRequired(e.target.checked)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        {t("common.required")}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onSaveEdit(f.id)}
                          className={btnPrimary}
                        >
                          {t("common.save")}
                        </button>
                        <button type="button" onClick={cancelEdit} className={btnSecondary}>
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-mono text-xs text-slate-500">{f.field_key}</p>
                        <p className="font-medium text-slate-900">{f.field_label}</p>
                        <p className="text-sm text-slate-600">
                          {f.field_type}
                          {f.is_required ? t("fields.listRequired") : ""}
                        </p>
                      </div>
                      {!eventPast ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(f)}
                            title={t("admin.users.edit")}
                            aria-label={t("admin.users.edit")}
                            className={`${btnSecondary} inline-flex min-h-9 min-w-9 items-center justify-center p-1.5`}
                          >
                            <EditActionIcon className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(f.id)}
                            title={t("common.delete")}
                            aria-label={t("common.delete")}
                            className={`${btnDanger} inline-flex min-h-9 min-w-9 items-center justify-center p-1.5`}
                          >
                            <DeleteActionIcon />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        )}

        {!eventPast ? (
        <form onSubmit={onAdd}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-teal-800/90">
            {t("fields.newField")}
          </p>
          <FormStack>
            <label className={labelClass}>
              {t("fields.keyLabel")}
              <input
                className={inputClass}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder={t("fields.keyPh")}
              />
            </label>
            <label className={labelClass}>
              {t("fields.formLabel")}
              <input
                className={inputClass}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={t("fields.labelPh")}
              />
            </label>
            <label className={labelClass}>
              {t("fields.editType")}
              <select
                className={selectClass}
                value={newType}
                onChange={(e) => setNewType(e.target.value as "text" | "textarea" | "select")}
              >
                <option value="text">{t("admin.manage.fieldTypeText")}</option>
                <option value="textarea">{t("admin.manage.fieldTypeTextarea")}</option>
                <option value="select">{t("admin.manage.fieldTypeSelect")}</option>
              </select>
            </label>
            {newType === "select" && (
              <label className={labelClass}>
                {t("admin.manage.fieldOptions")}
                <textarea
                  className={inputClass}
                  rows={4}
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                />
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              {t("common.required")}
            </label>
            <button type="submit" disabled={saving || loading} className={btnPrimary}>
              {t("fields.add")}
            </button>
          </FormStack>
        </form>
        ) : null}

        {message && (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {message}
          </p>
        )}
      </AppCard>
    </AppShell>
  );
}
