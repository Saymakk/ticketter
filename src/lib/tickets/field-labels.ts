import type { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type EventFieldLabelRow = {
  field_key: string;
  field_label: string;
  sort_order?: number | null;
};

export async function loadEventFieldLabelsMap(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  eventId: string
): Promise<Record<string, string>> {
  const { data } = await admin
    .from("event_fields")
    .select("field_key,field_label,sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.field_key && row.field_label) {
      map[row.field_key] = row.field_label;
    }
  }
  return map;
}

export function labelForFieldKey(
  key: string,
  labels?: Record<string, string> | null
): string {
  const label = labels?.[key]?.trim();
  return label || key;
}

export function orderedCustomFieldEntries(
  customData: unknown,
  labels?: Record<string, string> | null
): Array<{ key: string; label: string; value: string }> {
  if (!customData || typeof customData !== "object" || Array.isArray(customData)) {
    return [];
  }

  const record = customData as Record<string, unknown>;
  const orderedKeys = labels ? Object.keys(labels) : [];
  const extraKeys = Object.keys(record).filter((k) => !orderedKeys.includes(k));
  const keys = [...orderedKeys, ...extraKeys.sort((a, b) => a.localeCompare(b))];

  const out: Array<{ key: string; label: string; value: string }> = [];
  for (const key of keys) {
    const raw = record[key];
    if (raw === null || raw === undefined) continue;
    const value = String(raw).trim();
    if (!value) continue;
    out.push({
      key,
      label: labelForFieldKey(key, labels),
      value,
    });
  }
  return out;
}
