import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhone } from "@/lib/auth/phone";
import { resolveAuthEmail } from "@/lib/auth/login";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  fullName: z.string().min(2),
  login: z.string().min(3),
  password: z.string().min(8),
  role: z.enum(["admin", "super_admin"]),
  region: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const serverSupabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await serverSupabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profileError || profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
    }

    const { fullName, login, password, role, region } = parsed.data;
    const { email, mode } = resolveAuthEmail(login);

    const adminSupabase = createAdminSupabaseClient();

    const { data: created, error: createUserError } =
        await adminSupabase.auth.admin.createUser({
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