"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/healthy-life/supabase/client";
import {
  readRememberMePreference,
  writeRememberMePreference,
} from "@/lib/healthy-life/auth-prefs";
import { AuthNotice, type AuthNoticeTone } from "@/components/healthy-life/AuthNotice";
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

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: AuthNoticeTone } | null>(
    params.get("error") === "auth"
      ? { message: "Не удалось войти. Попробуйте ещё раз.", tone: "error" }
      : null,
  );

  useEffect(() => {
    setRememberMe(readRememberMePreference());
  }, []);

  const supabase = useMemo(() => createClient({ rememberMe }), [rememberMe]);

  const clearNotice = useCallback(() => setNotice(null), []);

  async function finishSignedIn(successMessage: string) {
    setNotice({ message: successMessage, tone: "success" });
    await delay(1100);
    router.replace(next);
    router.refresh();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setNotice(null);

    const trimmedEmail = email.trim().toLowerCase();

    if (password.length < 6) {
      setLoading(false);
      setNotice({ message: "Пароль должен быть не короче 6 символов.", tone: "error" });
      return;
    }

    writeRememberMePreference(rememberMe);

    try {
      if (mode === "register") {
        if (password !== confirmPassword) {
          setNotice({ message: "Пароли не совпадают.", tone: "error" });
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });

        if (error) {
          setNotice({ message: authErrorMessage(error.message), tone: "error" });
          return;
        }

        // Prefer the session from signUp; otherwise sign in immediately (auto-login).
        if (!data.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });

          if (signInError) {
            setNotice({
              message:
                "Аккаунт создан. Подтвердите email в письме, затем войдите — или отключите Confirm email в Supabase.",
              tone: "info",
            });
            router.push(`/login?next=${encodeURIComponent(next)}`);
            return;
          }
        }

        await finishSignedIn("Регистрация успешна — вход выполнен");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setNotice({ message: authErrorMessage(error.message), tone: "error" });
        return;
      }

      await finishSignedIn(rememberMe ? "С возвращением!" : "Вход выполнен");
    } catch (err) {
      setNotice({
        message: err instanceof Error ? err.message : "Ошибка",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const nextQuery = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <Shell className="relative z-10 pb-10">
      {notice ? (
        <AuthNotice
          message={notice.message}
          tone={notice.tone}
          onDismiss={clearNotice}
          autoHideMs={notice.tone === "error" ? 6000 : 0}
        />
      ) : null}

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

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-1 py-1 touch-manipulation">
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 rounded-md border-[var(--line)] accent-[var(--accent)]"
              checked={rememberMe}
              onChange={(e) => {
                const nextValue = e.target.checked;
                setRememberMe(nextValue);
                writeRememberMePreference(nextValue);
              }}
            />
            <span className="text-sm text-[var(--ink)]">
              Запомнить меня
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                {rememberMe
                  ? "Оставаться в аккаунте на этом устройстве"
                  : "Короткая сессия — около 12 часов"}
              </span>
            </span>
          </label>

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
