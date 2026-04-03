import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhone } from "@/lib/auth/phone";
import { resolveAuthEmail } from "@/lib/auth/login";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthedProfile } from "@/lib/auth/api-guards";
import { isEventManagerRole } from "@/lib/auth/roles";

const bodySchema = z.object({
  fullName: z.string().min(2),
  login: z.string().min(3),
  password: z.string().min(8),
  role: z.enum(["user", "admin"]),
  region: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await getAuthedProfile();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const callerRole = auth.ctx.profile.role;
    if (!isEventManagerRole(callerRole)) {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
    }

    const { fullName, login, password, role, region } = parsed.data;

    if (callerRole === "admin" && role !== "user") {
      return NextResponse.json(
        { error: "Администратор может создавать только учётные записи с ролью «пользователь»." },
        { status: 403 }
      );
    }

    const { email, mode } = resolveAuthEmail(login);
    const adminSupabase = createAdminSupabaseClient();

    const { data: created, error: createUserError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createUserError || !created.user) {
      return NextResponse.json(
        { error: createUserError?.message ?? "Ошибка создания пользователя" },
        { status: 400 }
      );
    }

    const phoneForProfile = mode === "phone" ? normalizePhone(login) : null;

    const { error: insertProfileError } = await adminSupabase.from("profiles").insert({
      id: created.user.id,
      full_name: fullName,
      phone: phoneForProfile,
      role,
      region: region ?? null,
      created_by: auth.ctx.user.id,
    });

    if (insertProfileError) {
      return NextResponse.json({ error: insertProfileError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      userId: created.user.id,
      authEmail: email,
      loginHint: mode === "phone" ? phoneForProfile : email,
      mode,
    });
  } catch {
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
