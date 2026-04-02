import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthedProfile } from "@/lib/auth/api-guards";
import { isEventManagerRole, isSuperAdminRole } from "@/lib/auth/roles";

const patchSchema = z.object({
  fullName: z.string().min(2).optional(),
  region: z.string().nullable().optional(),
  role: z.enum(["user", "admin"]).optional(),
});

type Params = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await getAuthedProfile();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const callerRole = auth.ctx.profile.role;
  if (!isEventManagerRole(callerRole)) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id,role")
    .eq("id", userId)
    .maybeSingle();

  if (targetErr || !target) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  if (target.role === "super_admin") {
    return NextResponse.json({ error: "Нельзя изменять суперадминистратора" }, { status: 403 });
  }

  if (callerRole === "admin") {
    if (target.role !== "user") {
      return NextResponse.json({ error: "Можно редактировать только пользователей с ролью «пользователь»" }, { status: 403 });
    }
    if (parsed.data.role !== undefined) {
      return NextResponse.json({ error: "Администратор не может менять роль" }, { status: 403 });
    }
  }

  const payload: Record<string, unknown> = {};
  if (parsed.data.fullName !== undefined) payload.full_name = parsed.data.fullName;
  if (parsed.data.region !== undefined) payload.region = parsed.data.region;
  if (isSuperAdminRole(callerRole) && parsed.data.role !== undefined) {
    payload.role = parsed.data.role;
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
  }

  const { error } = await admin.from("profiles").update(payload).eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
