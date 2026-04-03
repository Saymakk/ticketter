import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import { EVENT_ENDED_MESSAGE, isEventPastByDateString } from "@/lib/event-date";

const createFieldSchema = z
  .object({
    fieldKey: z.string().min(1).regex(/^[a-z0-9_]+$/),
    fieldLabel: z.string().min(1),
    fieldType: z.enum(["text", "textarea", "select"]),
    isRequired: z.boolean(),
    options: z.array(z.string()).optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fieldType === "select" && (!data.options || data.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для типа «список» укажите хотя бы один вариант",
        path: ["options"],
      });
    }
  });

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_: Request, { params }: Params) {
  const check = await requireEventManager();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { eventId } = await params;
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("event_fields")
    .select("id,field_key,field_label,field_type,is_required,sort_order,options")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ fields: data ?? [] });
}

export async function POST(request: Request, { params }: Params) {
  const check = await requireEventManager();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { eventId } = await params;

  const adminGuard = createAdminSupabaseClient();
  const { data: evRow } = await adminGuard.from("events").select("event_date").eq("id", eventId).maybeSingle();
  if (!evRow) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  if (isEventPastByDateString(evRow.event_date)) {
    return NextResponse.json({ error: EVENT_ENDED_MESSAGE }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createFieldSchema.safeParse(body);

  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.options?.[0] ?? "Некорректные данные";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const p = parsed.data;
  const admin = adminGuard;

  let sortOrder = p.sortOrder;
  if (sortOrder === undefined) {
    const { data: maxRow } = await admin
      .from("event_fields")
      .select("sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (maxRow?.sort_order ?? -1) + 1;
  }

  const optionsPayload =
    p.fieldType === "select" && p.options?.length ? p.options : null;

  const { data, error } = await admin
    .from("event_fields")
    .insert({
      event_id: eventId,
      field_key: p.fieldKey,
      field_label: p.fieldLabel,
      field_type: p.fieldType,
      is_required: p.isRequired,
      sort_order: sortOrder,
      options: optionsPayload,
    })
    .select("id,field_key,field_label,field_type,is_required,sort_order,options")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ field: data });
}
