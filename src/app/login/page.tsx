"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { phoneToEmail } from "@/lib/auth/phone";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorText("");
    setLoading(true);

    try {
      const email = phoneToEmail(phone);

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorText("Неверный телефон или пароль");
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

      router.push("/admin");
    } catch {
      setErrorText("Проверь формат телефона. Пример: +7 701 123 45 67");
    } finally {
      setLoading(false);
    }
  }

  return (
      <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
        <h1>Вход в ticketter</h1>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label>
            Телефон
            <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 701 123 45 67"
                autoComplete="tel"
                required
            />
          </label>

          <label>
            Пароль (последние 6 цифр номера)
            <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="123456"
                type="password"
                maxLength={6}
                required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>

        {errorText && <p style={{ color: "crimson", marginTop: 12 }}>{errorText}</p>}
      </main>
  );
}

export default function LoginPage() {
  return (
      <Suspense fallback={<main style={{ padding: 16 }}>Загрузка...</main>}>
        <LoginForm />
      </Suspense>
  );
}