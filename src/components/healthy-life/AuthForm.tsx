"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetAuthClient } from "@/lib/healthy-life/supabase/client";
import { looksLikeEmail, resolveAuthEmail, resolveAuthEmailCandidates } from "@/lib/auth/login";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { tryNormalizePhone, phoneToEmail } from "@/lib/auth/phone";
import {
  readRememberMePreference,
  writeRememberMePreference,
} from "@/lib/healthy-life/auth-prefs";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useT } from "@/lib/healthy-life/i18n";
import { AuthNotice, type AuthNoticeTone } from "@/components/healthy-life/AuthNotice";
import { Button, Card, Field, PageHeader, Shell, inputClass } from "@/components/healthy-life/ui";

type AuthMode = "login" | "register";

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { path } = useHlRouting();
  const t = useT();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: AuthNoticeTone } | null>(
    params.get("error") === "auth"
      ? { message: t("auth.authFailed"), tone: "error" }
      : null,
  );

  useEffect(() => {
    setRememberMe(readRememberMePreference());
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  function authErrorMessage(message: string) {
    const lower = message.toLowerCase();
    if (lower.includes("invalid login credentials")) {
      return t("auth.invalidCredentials");
    }
    if (lower.includes("email not confirmed")) {
      return t("auth.emailNotConfirmed");
    }
    if (lower.includes("user already registered")) {
      return t("auth.alreadyRegistered");
    }
    if (lower.includes("password")) {
      return message;
    }
    return message;
  }

  async function finishSignedIn(successMessage: string) {
    setNotice({ message: successMessage, tone: "success" });
    await delay(1100);
    const dest = next.startsWith("/") ? next : `/${next}`;
    router.replace(path(dest));
    router.refresh();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setNotice(null);

    const rawLogin = login.trim();
    if (!rawLogin) {
      setLoading(false);
      setNotice({ message: t("auth.identifierRequired"), tone: "error" });
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setLoading(false);
      setNotice({ message: t("auth.passwordTooShort"), tone: "error" });
      return;
    }

    let authEmails: string[];
    let authMode: "email" | "phone";
    let phone: string | undefined;
    try {
      if (looksLikeEmail(rawLogin) || rawLogin.includes("@")) {
        if (!looksLikeEmail(rawLogin)) {
          throw new Error("invalid_email");
        }
        const resolved = resolveAuthEmail(rawLogin);
        authEmails = [resolved.email];
        authMode = "email";
      } else {
        const normalized = tryNormalizePhone(rawLogin);
        if (!normalized) throw new Error("invalid_phone");
        phone = normalized;
        authEmails = resolveAuthEmailCandidates(rawLogin).emails;
        authMode = "phone";
        if (authEmails.length === 0) throw new Error("invalid_phone");
      }
    } catch (err) {
      setLoading(false);
      const code = err instanceof Error ? err.message : "";
      setNotice({
        message: code === "invalid_email" ? t("auth.emailInvalid") : t("auth.phoneInvalid"),
        tone: "error",
      });
      return;
    }

    writeRememberMePreference(rememberMe);
    const supabase = resetAuthClient(rememberMe);

    try {
      if (mode === "register") {
        if (password !== confirmPassword) {
          setNotice({ message: t("auth.passwordsMismatch"), tone: "error" });
          return;
        }

        const primaryEmail = authMode === "phone" && phone ? phoneToEmail(phone) : authEmails[0];
        const { data, error } = await supabase.auth.signUp({
          email: primaryEmail,
          password,
          options: phone ? { data: { phone } } : undefined,
        });

        if (error) {
          setNotice({ message: authErrorMessage(error.message), tone: "error" });
          return;
        }

        // Prefer the session from signUp; otherwise sign in immediately (auto-login).
        if (!data.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: primaryEmail,
            password,
          });

          if (signInError) {
            setNotice({
              message: t("auth.confirmEmailNeeded"),
              tone: "info",
            });
            router.push(path(`/login?next=${encodeURIComponent(next)}`));
            return;
          }
        }

        await finishSignedIn(t("auth.successRegister"));
        return;
      }

      let signedIn = false;
      for (const email of authEmails) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          signedIn = true;
          break;
        }
      }

      if (!signedIn) {
        setNotice({ message: t("auth.invalidCredentials"), tone: "error" });
        return;
      }

      await finishSignedIn(rememberMe ? t("auth.welcomeBack") : t("auth.signedIn"));
    } catch (err) {
      setNotice({
        message: err instanceof Error ? err.message : t("error"),
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
        title={mode === "login" ? t("auth.loginTitle") : t("auth.registerTitle")}
        subtitle={t("auth.subtitle")}
      />

      <Card className="relative z-10">
        <form className="space-y-3" onSubmit={onSubmit} noValidate>
          <Field label={t("auth.login")} hint={t("auth.phoneHint")}>
            <input
              className={inputClass}
              type="text"
              inputMode={login.includes("@") ? "email" : "tel"}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder={t("auth.loginPlaceholder")}
            />
          </Field>
          <div className="block space-y-1.5">
            <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
              {t("auth.password")}
            </span>
            <div className="relative">
              <input
                className={`${inputClass} pr-12`}
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordHint")}
              />
              <button
                type="button"
                className="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--muted)] touch-manipulation"
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                title={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          {mode === "register" ? (
            <div className="block space-y-1.5">
              <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                {t("auth.confirmPassword")}
              </span>
              <div className="relative">
                <input
                  className={`${inputClass} pr-12`}
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--muted)] touch-manipulation"
                  aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  title={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
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
              {t("auth.rememberMe")}
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                {rememberMe ? t("auth.rememberOn") : t("auth.rememberOff")}
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
                ? t("auth.signingIn")
                : t("auth.registering")
              : mode === "login"
                ? t("auth.signIn")
                : t("auth.register")}
          </Button>
        </form>
      </Card>

      <p className="relative z-10 mt-5 text-center text-sm text-[var(--muted)]">
        {mode === "login" ? (
          <>
            {t("auth.noAccount")}{" "}
            <Link
              href={path(`/register${nextQuery}`)}
              className="inline-block min-h-11 px-1 py-2 font-semibold text-[var(--accent)] touch-manipulation underline-offset-2"
            >
              {t("auth.registerLink")}
            </Link>
          </>
        ) : (
          <>
            {t("auth.hasAccount")}{" "}
            <Link
              href={path(`/login${nextQuery}`)}
              className="inline-block min-h-11 px-1 py-2 font-semibold text-[var(--accent)] touch-manipulation underline-offset-2"
            >
              {t("auth.loginLink")}
            </Link>
          </>
        )}
      </p>
    </Shell>
  );
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.5 10.7a2.6 2.6 0 0 0 3.7 3.7M9.4 5.6C10.2 5.3 11.1 5.1 12 5.1c6 0 9.5 6.9 9.5 6.9a16 16 0 0 1-3.3 3.8M6.2 6.4A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5c1.2 0 2.3-.3 3.3-.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
