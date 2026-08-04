"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/healthy-life/supabase/client";
import { Button, Card, Field, PageHeader, Shell, inputClass } from "@/components/healthy-life/ui";

type AuthMode = "login" | "register";

function authErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Неверный email или пароль.";
  }
  if (lower.includes("email not confirmed")) {
    return "Подтвердите email в письме или отключите Confirm email в Supabase.";
  }
  if (lower.includes("user already registered")) {
    return "Этот email уже зарегистрирован. Войдите.";
  }
  if (lower.includes("password")) {
    return message;
  }
  return message;
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    params.get("error") === "auth" ? "Не удалось войти. Попробуйте ещё раз." : null,
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage(null);

    const trimmedEmail = email.trim().toLowerCase();

    if (password.length < 6) {
      setLoading(false);
      setMessage("Пароль должен быть не короче 6 символов.");
      return;
    }

    try {
      if (mode === "register") {
        if (password !== confirmPassword) {
          setMessage("Пароли не совпадают.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });

        if (error) {
          setMessage(authErrorMessage(error.message));
          return;
        }

        if (data.session) {
          router.replace(next);
          router.refresh();
          return;
        }

        setMessage("Аккаунт создан. Если нужно подтверждение почты — проверьте письмо, затем войдите.");
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setMessage(authErrorMessage(error.message));
        return;
      }

      router.replace(next);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  const nextQuery = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <Shell className="relative z-10 pb-10">
      <PageHeader
        title={mode === "login" ? "Вход" : "Регистрация"}
        subtitle="Email и пароль"
      />

      <Card className="relative z-10">
        <form className="space-y-3" onSubmit={onSubmit} noValidate>
          <Field label="Email">
            <input
              className={inputClass}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </Field>
          <Field label="Пароль">
            <input
              className={inputClass}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="минимум 6 символов"
            />
          </Field>
          {mode === "register" ? (
            <Field label="Повторите пароль">
              <input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
          ) : null}

          <Button
            type="submit"
            className="w-full touch-manipulation"
            disabled={loading}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {loading
              ? mode === "login"
                ? "Входим…"
                : "Создаём…"
              : mode === "login"
                ? "Войти"
                : "Зарегистрироваться"}
          </Button>
        </form>

        {message ? <p className="mt-3 text-sm text-[var(--muted)]">{message}</p> : null}
      </Card>

      <p className="relative z-10 mt-5 text-center text-sm text-[var(--muted)]">
        {mode === "login" ? (
          <>
            Нет аккаунта?{" "}
            <Link
              href={`/register${nextQuery}`}
              className="inline-block min-h-11 px-1 py-2 font-semibold text-[var(--accent)] touch-manipulation underline-offset-2"
            >
              Регистрация
            </Link>
          </>
        ) : (
          <>
            Уже есть аккаунт?{" "}
            <Link
              href={`/login${nextQuery}`}
              className="inline-block min-h-11 px-1 py-2 font-semibold text-[var(--accent)] touch-manipulation underline-offset-2"
            >
              Войти
            </Link>
          </>
        )}
      </p>
    </Shell>
  );
}
