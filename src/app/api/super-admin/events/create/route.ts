import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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
  fields: z.array(fieldDraftSchema).optional(),
});

async function ensureSuperAdmin() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false as const, status: 401, error: "Не авторизован" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "super_admin") {
    return { ok: false as const, status: 403, error: "Доступ запрещен" };
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  const check = await ensureSuperAdmin();
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

  const { title, city, eventDate, fields: fieldDrafts } = parsed.data;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("events")
    .insert({
      title,
      city,
      event_date: eventDate,
      is_active: true,
    })
    .select("id,title,city,event_date,is_active")
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

  return NextResponse.json({ ok: true, event: data });
}