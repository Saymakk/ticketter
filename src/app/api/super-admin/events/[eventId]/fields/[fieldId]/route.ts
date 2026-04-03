import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import { EVENT_ENDED_MESSAGE, isEventPastByDateString } from "@/lib/event-date";

async function blockIfEventEnded(eventId: string): Promise<NextResponse | null> {
  const admin = createAdminSupabaseClient();
  const { data: evRow } = await admin.from("events").select("event_date").eq("id", eventId).maybeSingle();
  if (!evRow) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  if (isEventPastByDateString(evRow.event_date)) {
    return NextResponse.json({ error: EVENT_ENDED_MESSAGE }, { status: 403 });
  }
  return null;
}

const patchFieldSchema = z.object({
  fieldKey: z.string().min(1).regex(/^[a-z0-9_]+$/).optional(),
  fieldLabel: z.string().min(1).optional(),
  fieldType: z.enum(["text", "textarea", "select"]).optional(),
  isRequired: z.boolean().optional(),
  options: z.array(z.string()).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

type Params = { params: Promise<{ eventId: string; fieldId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const check = await requireEventManager();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { eventId, fieldId } = await params;
  const blocked = await blockIfEventEnded(eventId);
  if (blocked) return blocked;

  const body = await request.json();
  const parsed = patchFieldSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const p = parsed.data;

  const nextType = p.fieldType;
  const nextOptions = p.options;
  if (nextType === "select" && nextOptions !== undefined && nextOptions !== null && nextOptions.length === 0) {
    return NextResponse.json({ error: "Для типа «список» укажите варианты" }, { status: 400 });
  }
  const payload: Record<string, unknown> = {};

  if (p.fieldKey !== undefined) payload.field_key = p.fieldKey;
  if (p.fieldLabel !== undefined) payload.field_label = p.fieldLabel;
  if (p.fieldType !== undefined) payload.field_type = p.fieldType;
  if (p.isRequired !== undefined) payload.is_required = p.isRequired;
  if (p.sortOrder !== undefined) payload.sort_order = p.sortOrder;

  if (p.options !== undefined) {
    payload.options = p.options;
  } else if (p.fieldType !== undefined && p.fieldType !== "select") {
    payload.options = null;
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("event_fields")
    .update(payload)
    .eq("id", fieldId)
    .eq("event_id", eventId)
    .select("id,field_key,field_label,field_type,is_required,sort_order,options")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Поле не найдено" }, { status: 404 });

  return NextResponse.json({ field: data });
}

export async function DELETE(_: Request, { params }: Params) {
  const check = await requireEventManager();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { eventId, fieldId } = await params;
  const blocked = await blockIfEventEnded(eventId);
  if (blocked) return blocked;

  const admin = createAdminSupabaseClient();

  const { error } = await admin.from("event_fields").delete().eq("id", fieldId).eq("event_id", eventId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
