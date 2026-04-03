"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocaleContext } from "@/components/locale-provider";
import {
  AppCard,
  AppShell,
  BackNav,
  btnPrimary,
  FormStack,
  inputClass,
  labelClass,
  ListLoading,
  selectClass,
} from "@/components/ui/app-shell";

type EventField = {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  options?: unknown;
};

function fieldOptions(opts: unknown): string[] {
  if (Array.isArray(opts)) return opts as string[];
  return [];
}

export default function NewTicketPage() {
  const { t } = useLocaleContext();
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const eventId = params.eventId;

  const [fields, setFields] = useState<EventField[]>([]);
  const [buyerName, setBuyerName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [customData, setCustomData] = useState<Record<string, string>>({});
  const [result, setResult] = useState("");
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [eventPastBlocked, setEventPastBlocked] = useState(false);

  useEffect(() => {
    async function loadFields() {
      if (!eventId) return;
      setFieldsLoading(true);
      setEventPastBlocked(false);
      setResult("");
      try {
        const [fieldsRes, eventRes] = await Promise.all([
          fetch(`/api/admin/events/${eventId}/fields`, { cache: "no-store" }),
          fetch(`/api/admin/events/${eventId}`, { cache: "no-store" }),
        ]);
        const eventJson = await eventRes.json();
        if (eventRes.ok && eventJson.event?.isPast) {
          setEventPastBlocked(true);
          setFields([]);
          return;
        }
        if (!eventRes.ok) {
          setResult(
            t("admin.ticketNew.createError", {
              detail: String(eventJson.error ?? t("common.error")),
            })
          );
          setFields([]);
          return;
        }

        const json = await fieldsRes.json();
        if (!fieldsRes.ok) {
          setResult(
            t("admin.ticketNew.createError", {
              detail: String(json.error ?? t("admin.ticketNew.loadFieldsError")),
            })
          );
          setFields([]);
          return;
        }
        setFields(json.fields ?? []);
      } finally {
        setFieldsLoading(false);
      }
    }
    void loadFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- перезагрузка при смене eventId
  }, [eventId]);

  function updateCustomField(key: string, value: string) {
    setCustomData((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    for (const f of fields) {
      if (f.is_required && (customData[f.field_key] === undefined || customData[f.field_key] === "")) {
        setResult(t("admin.ticketNew.requiredField", { label: f.field_label }));
        return;
      }
    }

    const res = await fetch(`/api/admin/events/${eventId}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerName,
        phone,
        region,
        customData,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setResult(
        t("admin.ticketNew.createError", {
          detail: String(json.error ?? t("admin.ticketNew.createFailed")),
        })
      );
      return;
    }

    setResult(t("admin.ticketNew.createdWithUuid", { uuid: json.ticket.uuid }));
    router.push(`/admin/events/${eventId}/tickets`);
  }

  if (eventPastBlocked) {
    return (
      <AppShell maxWidth="max-w-2xl">
        <BackNav href={`/admin/events/${eventId}/tickets`}>{t("admin.ticketNew.back")}</BackNav>
        <AppCard title={t("admin.ticketNew.title")}>
          <p className="text-sm text-slate-700">{t("admin.ticketNew.eventPastBlocked")}</p>
        </AppCard>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth="max-w-2xl">
      <BackNav href={`/admin/events/${eventId}/tickets`}>{t("admin.ticketNew.back")}</BackNav>
      <AppCard title={t("admin.ticketNew.title")} subtitle={t("admin.ticketNew.subtitle")}>
        <form onSubmit={onSubmit}>
          <FormStack>
            <label className={labelClass}>
              {t("admin.ticketNew.buyerName")}
              <input
                className={inputClass}
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
              />
            </label>

            <label className={labelClass}>
              {t("admin.ticketNew.phone")}
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>

            <label className={labelClass}>
              {t("admin.ticketNew.region")}
              <input
                className={inputClass}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </label>

            {fieldsLoading ? (
              <ListLoading label={t("common.loading")} className="py-6" />
            ) : fields.length > 0 ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-teal-800/90">
                  {t("admin.ticketNew.sectionFields")}
                </p>
                <div className="space-y-3">
                  {fields.map((f) => {
                    const val = customData[f.field_key] ?? "";
                    const opts = fieldOptions(f.options);
                    if (f.field_type === "select") {
                      return (
                        <label key={f.id} className={labelClass}>
                          {f.field_label}
                          {f.is_required ? <span className="text-red-500"> *</span> : null}
                          <select
                            className={selectClass}
                            value={val}
                            onChange={(e) => updateCustomField(f.field_key, e.target.value)}
                            required={f.is_required}
                          >
                            <option value="">—</option>
                            {opts.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    }
                    if (f.field_type === "textarea") {
                      return (
                        <label key={f.id} className={labelClass}>
                          {f.field_label}
                          {f.is_required ? <span className="text-red-500"> *</span> : null}
                          <textarea
                            className={inputClass}
                            rows={3}
                            value={val}
                            onChange={(e) => updateCustomField(f.field_key, e.target.value)}
                            required={f.is_required}
                          />
                        </label>
                      );
                    }
                    return (
                      <label key={f.id} className={labelClass}>
                        {f.field_label}
                        {f.is_required ? <span className="text-red-500"> *</span> : null}
                        <input
                          className={inputClass}
                          value={val}
                          onChange={(e) => updateCustomField(f.field_key, e.target.value)}
                          required={f.is_required}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <button type="submit" className={btnPrimary} disabled={fieldsLoading}>
              {t("admin.ticketNew.submit")}
            </button>
          </FormStack>
        </form>

        {result && (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
            {result}
          </p>
        )}
      </AppCard>
    </AppShell>
  );
}
