"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AppCard,
  AppShell,
  BackNav,
  btnDanger,
  btnPrimary,
  btnSecondary,
  FormStack,
  inputClass,
  labelClass,
  selectClass,
} from "@/components/ui/app-shell";

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
      const res = await fetch(`/api/super-admin/events/${eventId}/fields`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? "Ошибка загрузки");
        setFields([]);
        return;
      }
      setFields(json.fields ?? []);
    } catch {
      setMessage("Сетевая ошибка");
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
    const key = newKey.trim();
    const label = newLabel.trim();
    if (!/^[a-z0-9_]+$/.test(key)) {
      setMessage("Ключ: только латиница, цифры и подчёркивание (например company_name)");
      return;
    }
    if (!label) {
      setMessage("Укажите подпись поля");
      return;
    }
    const opts = newType === "select" ? parseOptions(newOptions) : undefined;
    if (newType === "select" && (!opts || opts.length === 0)) {
      setMessage("Для списка укажите варианты (каждый с новой строки)");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/super-admin/events/${eventId}/fields`, {
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
        setMessage(json.error ?? "Ошибка сохранения");
        return;
      }
      setNewKey("");
      setNewLabel("");
      setNewType("text");
      setNewRequired(false);
      setNewOptions("");
      await load();
    } catch {
      setMessage("Сетевая ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEdit(fieldId: string) {
    const key = editKey.trim();
    const label = editLabel.trim();
    if (!/^[a-z0-9_]+$/.test(key)) {
      setMessage("Ключ: только латиница, цифры и подчёркивание");
      return;
    }
    if (!label) {
      setMessage("Укажите подпись");
      return;
    }
    const opts = editType === "select" ? parseOptions(editOptions) : null;
    if (editType === "select" && (!opts || opts.length === 0)) {
      setMessage("Для списка укажите варианты");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/super-admin/events/${eventId}/fields/${fieldId}`, {
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
        setMessage(json.error ?? "Ошибка сохранения");
        return;
      }
      cancelEdit();
      await load();
    } catch {
      setMessage("Сетевая ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(fieldId: string) {
    const ok = window.confirm("Удалить поле?");
    if (!ok) return;
    setMessage("");
    try {
      const res = await fetch(`/api/super-admin/events/${eventId}/fields/${fieldId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? "Ошибка удаления");
        return;
      }
      if (editingId === fieldId) cancelEdit();
      await load();
    } catch {
      setMessage("Сетевая ошибка");
    }
  }

  return (
    <AppShell maxWidth="max-w-2xl">
      <BackNav href="/super-admin/events">К мероприятиям</BackNav>
      <AppCard
        title="Поля мероприятия"
        subtitle="Дополнительные поля при создании билета (текст, многострочный текст, список)."
      >
        {loading ? (
          <p className="text-sm text-slate-600">Загрузка…</p>
        ) : (
          <ul className="mb-8 space-y-4">
            {fields.length === 0 ? (
              <li className="text-sm text-slate-600">Пока нет полей — добавьте ниже.</li>
            ) : (
              fields.map((f) => (
                <li
                  key={f.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm"
                >
                  {editingId === f.id ? (
                    <div className="space-y-3">
                      <label className={labelClass}>
                        Ключ (латиница)
                        <input
                          className={inputClass}
                          value={editKey}
                          onChange={(e) => setEditKey(e.target.value)}
                        />
                      </label>
                      <label className={labelClass}>
                        Подпись
                        <input
                          className={inputClass}
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                        />
                      </label>
                      <label className={labelClass}>
                        Тип
                        <select
                          className={selectClass}
                          value={editType}
                          onChange={(e) =>
                            setEditType(e.target.value as "text" | "textarea" | "select")
                          }
                        >
                          <option value="text">Текст</option>
                          <option value="textarea">Многострочный</option>
                          <option value="select">Список</option>
                        </select>
                      </label>
                      {editType === "select" && (
                        <label className={labelClass}>
                          Варианты (с новой строки)
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
                        Обязательное
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onSaveEdit(f.id)}
                          className={btnPrimary}
                        >
                          Сохранить
                        </button>
                        <button type="button" onClick={cancelEdit} className={btnSecondary}>
                          Отмена
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
                          {f.is_required ? " · обязательное" : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => startEdit(f)} className={btnSecondary}>
                          Изменить
                        </button>
                        <button type="button" onClick={() => onDelete(f.id)} className={btnDanger}>
                          Удалить
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        )}

        <form onSubmit={onAdd}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-teal-800/90">
            Новое поле
          </p>
          <FormStack>
            <label className={labelClass}>
              Ключ (латиница, например inn)
              <input
                className={inputClass}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="company_name"
              />
            </label>
            <label className={labelClass}>
              Подпись для формы
              <input
                className={inputClass}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Название компании"
              />
            </label>
            <label className={labelClass}>
              Тип
              <select
                className={selectClass}
                value={newType}
                onChange={(e) => setNewType(e.target.value as "text" | "textarea" | "select")}
              >
                <option value="text">Текст</option>
                <option value="textarea">Многострочный</option>
                <option value="select">Список</option>
              </select>
            </label>
            {newType === "select" && (
              <label className={labelClass}>
                Варианты (каждый с новой строки)
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
              Обязательное
            </label>
            <button type="submit" disabled={saving || loading} className={btnPrimary}>
              Добавить поле
            </button>
          </FormStack>
        </form>

        {message && (
          <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {message}
          </p>
        )}
      </AppCard>
    </AppShell>
  );
}
