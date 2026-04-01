import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhone, phoneToEmail, last6FromPhone } from "@/lib/auth/phone";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(6),
  role: z.enum(["admin", "super_admin"]),
  region: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    // 1) Проверяем, что запрос делает авторизованный super_admin
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

    // 2) Валидируем тело запроса
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
    }

    const { fullName, phone, role, region } = parsed.data;
    const normalizedPhone = normalizePhone(phone);
    const email = phoneToEmail(normalizedPhone);
    const password = last6FromPhone(normalizedPhone);

    // 3) Создаем auth user через service_role
    const adminSupabase = createAdminSupabaseClient();

    const { data: created, error: createUserError } =
      await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createUserError || !created.user) {
      return NextResponse.json(
        { error: createUserError?.message ?? "Ошибка создания auth user" },
        { status: 400 }
      );
    }

    // 4) Создаем профиль
    const { error: insertProfileError } = await adminSupabase.from("profiles").insert({
      id: created.user.id,
      full_name: fullName,
      phone: normalizedPhone,
      role,
      region: region ?? null,
    });

    if (insertProfileError) {
      return NextResponse.json(
        { error: insertProfileError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      userId: created.user.id,
      loginPhone: normalizedPhone,
      generatedPassword: password,
    });
  } catch (e) {
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}