import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhone } from "@/lib/auth/phone";
import { resolveAuthEmail } from "@/lib/auth/login";
import {
  findAuthUserByEmail,
  isDuplicateAuthEmailError,
} from "@/lib/auth/admin-auth-users";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthedProfile } from "@/lib/auth/api-guards";
import { isEventManagerRole } from "@/lib/auth/roles";
import { getActorCompanyProfile } from "@/lib/auth/company-access";

const bodySchema = z.object({
  fullName: z.string().min(2),
  login: z.string().min(3),
  password: z.string().min(8),
  role: z.enum(["user", "admin"]),
  region: z.string().nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
});

type ProfilePayload = {
  id: string;
  full_name: string;
  phone: string | null;
  role: "user" | "admin";
  region: string | null;
  created_by: string;
  company_id: string | null;
  managed_password: string;
};

async function upsertManagedProfile(
  adminSupabase: ReturnType<typeof createAdminSupabaseClient>,
  payload: ProfilePayload
) {
  return adminSupabase.from("profiles").upsert(payload, { onConflict: "id" });
}

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

    const { fullName, login, password, role, region, companyId } = parsed.data;

    if (callerRole === "admin" && role !== "user") {
      return NextResponse.json(
        { error: "Администратор может создавать только учётные записи с ролью «пользователь»." },
        { status: 403 }
      );
    }

    const { email, mode } = resolveAuthEmail(login);
    const adminSupabase = createAdminSupabaseClient();
    const actorCompany = await getActorCompanyProfile(auth.ctx.user.id);
    const effectiveCompanyId =
      actorCompany?.company_id ?? (callerRole === "super_admin" ? companyId ?? null : null);

    let phoneForProfile: string | null = null;
    try {
      phoneForProfile = mode === "phone" ? normalizePhone(login) : null;
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Неверный формат телефона" },
        { status: 400 }
      );
    }

    const profilePayload = (userId: string): ProfilePayload => ({
      id: userId,
      full_name: fullName,
      phone: phoneForProfile,
      role,
      region: region ?? null,
      created_by: auth.ctx.user.id,
      company_id: effectiveCompanyId,
      managed_password: password,
    });

    const { data: created, error: createUserError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createUserError || !created.user) {
      if (createUserError && isDuplicateAuthEmailError(createUserError.message)) {
        const existing = await findAuthUserByEmail(adminSupabase, email);
        if (!existing) {
          return NextResponse.json(
            {
              error:
                "Логин уже занят в Auth, но пользователь не найден. Обратитесь к суперадмину для очистки.",
            },
            { status: 409 }
          );
        }

        const { data: existingProfile } = await adminSupabase
          .from("profiles")
          .select("id,role")
          .eq("id", existing.id)
          .maybeSingle();

        if (existingProfile && existingProfile.role !== role) {
          return NextResponse.json(
            { error: "Пользователь с таким логином уже существует с другой ролью." },
            { status: 409 }
          );
        }

        const { error: pwErr } = await adminSupabase.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
        });
        if (pwErr) {
          return NextResponse.json({ error: pwErr.message }, { status: 400 });
        }

        const { error: upsertErr } = await upsertManagedProfile(
          adminSupabase,
          profilePayload(existing.id)
        );
        if (upsertErr) {
          return NextResponse.json({ error: upsertErr.message }, { status: 400 });
        }

        return NextResponse.json({
          ok: true,
          repaired: true,
          userId: existing.id,
          authEmail: email,
          loginHint: mode === "phone" ? phoneForProfile : email,
          mode,
        });
      }

      return NextResponse.json(
        {
          error:
            createUserError?.message === "Database error creating new user"
              ? "Ошибка БД Supabase Auth. Выполните в SQL Editor миграцию 20260421130000_drop_auth_user_profile_trigger.sql (удаление триггера on_auth_user_created)."
              : (createUserError?.message ?? "Ошибка создания пользователя"),
        },
        { status: 400 }
      );
    }

    const { error: insertProfileError } = await upsertManagedProfile(
      adminSupabase,
      profilePayload(created.user.id)
    );

    if (insertProfileError) {
      await adminSupabase.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: insertProfileError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      userId: created.user.id,
      authEmail: email,
      loginHint: mode === "phone" ? phoneForProfile : email,
      mode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Внутренняя ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
