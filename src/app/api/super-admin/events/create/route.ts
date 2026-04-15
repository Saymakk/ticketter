import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireEventManager } from "@/lib/auth/api-guards";
import { writeAuditLog } from "@/lib/audit";
import { isValidOptionalEventTime } from "@/lib/event-date";
import { resolveEventCompanyId } from "@/lib/auth/company-access";

const fieldDraftSchema = z
  .object({
    fieldKey: z.string().min(1).regex(/^[a-z0-9_]+$/),
    fieldLabel: z.string().min(1),
    fieldType: z.enum(["text", "textarea", "select"]),
    isRequired: z.boolean(),
    options: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fieldType === "select" && (!data.options || data.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Для списка укажите варианты",
        path: ["options"],
      });
    }
  });

const bodySchema = z.object({
  title: z.string().min(2),
  city: z.string().min(2),
  eventDate: z.string().min(10),
  eventTime: z.string().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  fields: z.array(fieldDraftSchema).optional(),
});

export async function POST(request: Request) {
  const check = await requireEventManager();
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const payload = await request.json();
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 }
    );
  }

  const { title, city, eventDate, eventTime, companyId, fields: fieldDrafts } = parsed.data;
  const timeTrim = typeof eventTime === "string" ? eventTime.trim() : "";
  if (timeTrim && !isValidOptionalEventTime(timeTrim)) {
    return NextResponse.json({ error: "Время: формат HH:MM" }, { status: 400 });
  }

  const company = await resolveEventCompanyId({
    actorId: check.ctx.user.id,
    requestedCompanyId: companyId,
  });
  if (!company.ok) {
    return NextResponse.json({ error: company.error }, { status: company.status });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("events")
    .insert({
      title,
      city,
      event_date: eventDate,
      event_time: timeTrim || null,
      is_active: true,
      created_by: check.ctx.user.id,
      company_id: company.companyId,
    })
    .select("id,title,city,event_date,event_time,is_active")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (fieldDrafts?.length) {
    const rows = fieldDrafts.map((f, i) => ({
      event_id: data.id,
      field_key: f.fieldKey,
      field_label: f.fieldLabel,
      field_type: f.fieldType,
      is_required: f.isRequired,
      sort_order: i,
      options: f.fieldType === "select" && f.options?.length ? f.options : null,
    }));

    const { error: fieldsError } = await admin.from("event_fields").insert(rows);

    if (fieldsError) {
      await admin.from("events").delete().eq("id", data.id);
      return NextResponse.json({ error: fieldsError.message }, { status: 400 });
    }
  }

  void writeAuditLog({
    actorId: check.ctx.user.id,
    action: "event.create",
    resourceType: "event",
    resourceId: data.id,
    request,
    method: "POST",
    metadata: { title: data.title, city: data.city, event_date: data.event_date },
  });

  return NextResponse.json({ ok: true, event: data });
}