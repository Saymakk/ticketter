import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthedProfile } from "@/lib/auth/api-guards";
import { isEventManagerRole, isSuperAdminRole } from "@/lib/auth/roles";

const patchSchema = z.object({
  fullName: z.string().min(2).optional(),
  region: z.string().nullable().optional(),
  role: z.enum(["user", "admin"]).optional(),
  password: z.string().min(8).optional(),
  canEditTickets: z.boolean().optional(),
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
    if (parsed.data.password !== undefined) {
      return NextResponse.json({ error: "Только суперадминистратор может задавать пароль" }, { status: 403 });
    }
  }

  if (parsed.data.password !== undefined) {
    if (!isSuperAdminRole(callerRole)) {
      return NextResponse.json({ error: "Только суперадминистратор может задавать пароль" }, { status: 403 });
    }
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
      password: parsed.data.password,
    });
    if (pwErr) {
      return NextResponse.json({ error: pwErr.message }, { status: 400 });
    }
  }

  const effectiveRole =
    isSuperAdminRole(callerRole) && parsed.data.role !== undefined
      ? parsed.data.role
      : target.role;

  if (parsed.data.canEditTickets !== undefined && effectiveRole !== "user") {
    return NextResponse.json(
      { error: "Право на редактирование билетов задаётся только для роли «пользователь»" },
      { status: 400 }
    );
  }

  const payload: Record<string, unknown> = {};
  if (parsed.data.fullName !== undefined) payload.full_name = parsed.data.fullName;
  if (parsed.data.region !== undefined) payload.region = parsed.data.region;
  if (isSuperAdminRole(callerRole) && parsed.data.role !== undefined) {
    payload.role = parsed.data.role;
  }
  if (parsed.data.canEditTickets !== undefined && effectiveRole === "user") {
    payload.can_edit_tickets = parsed.data.canEditTickets;
  }

  if (Object.keys(payload).length > 0) {
    const { error } = await admin.from("profiles").update(payload).eq("id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  } else if (parsed.data.password === undefined) {
    return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
  const auth = await getAuthedProfile();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const callerRole = auth.ctx.profile.role;
  if (!isEventManagerRole(callerRole)) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const { userId } = await params;
  if (userId === auth.ctx.user.id) {
    return NextResponse.json({ error: "Нельзя удалить собственную учётную запись" }, { status: 403 });
  }

  const admin = createAdminSupabaseClient();
  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("id,role,created_by")
    .eq("id", userId)
    .maybeSingle();

  if (targetErr || !target) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  if (target.role === "super_admin") {
    return NextResponse.json({ error: "Нельзя удалить суперадминистратора" }, { status: 403 });
  }

  if (callerRole === "admin") {
    if (target.role !== "user") {
      return NextResponse.json(
        { error: "Администратор может удалять только пользователей с ролью «пользователь»" },
        { status: 403 }
      );
    }
    if (target.created_by !== auth.ctx.user.id) {
      return NextResponse.json(
        { error: "Можно удалить только пользователей, созданных вами" },
        { status: 403 }
      );
    }
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
