"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveAuthEmail } from "@/lib/auth/login";
import {
  AppCard,
  AppShellCenter,
  btnPrimary,
  FormStack,
  inputClass,
  labelClass,
} from "@/components/ui/app-shell";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorText("");
    setLoading(true);

    try {
      const { email } = resolveAuthEmail(login);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorText("Неверный логин или пароль");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorText("Не удалось получить пользователя после входа");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        setErrorText("Профиль пользователя не найден");
        return;
      }

      const nextPath = searchParams.get("next");
      if (nextPath && nextPath.startsWith("/")) {
        router.push(nextPath);
        return;
      }

      if (profile.role === "super_admin") {
        router.push("/super-admin");
        return;
      }

      if (profile.role === "admin" || profile.role === "user") {
        router.push("/admin");
        return;
      }

      setErrorText("Неизвестная роль в профиле. Обратитесь к администратору.");
    } catch {
      setErrorText("Проверь формат: телефон (+7 …) или корректный email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShellCenter>
      <AppCard
        title="Вход"
        subtitle="Телефон или email и пароль, выданные администратором."
      >
        <form onSubmit={onSubmit}>
          <FormStack>
            <label className={labelClass}>
              Телефон или email
              <input
                className={inputClass}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="+7 701 123 45 67 или name@company.com"
                autoComplete="username"
                required
              />
            </label>

            <label className={labelClass}>
              Пароль
              <input
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
              />
            </label>

            <button type="submit" disabled={loading} className={`${btnPrimary} w-full`}>
              {loading ? "Входим…" : "Войти"}
            </button>
          </FormStack>
        </form>

        {errorText && (
          <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">
            {errorText}
          </p>
        )}
      </AppCard>
    </AppShellCenter>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AppShellCenter>
          <p className="text-center text-sm text-slate-600">Загрузка…</p>
        </AppShellCenter>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
