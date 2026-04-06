"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveAuthEmail } from "@/lib/auth/login";
import { patchProfileLocale, getStoredLocale } from "@/lib/i18n/sync-locale";
import LanguageSwitcher from "@/components/language-switcher";
import { useLocaleContext } from "@/components/locale-provider";
import {
  AppCard,
  AppShellCenter,
  btnPrimary,
  CircularProgress,
  FormStack,
  inputClass,
  labelClass,
  ListLoading,
} from "@/components/ui/app-shell";

function LoginSuspenseFallback() {
  const { t } = useLocaleContext();
  return <ListLoading label={t("login.suspenseFallback")} />;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { t } = useLocaleContext();

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
        setErrorText(t("login.errorCredentials"));
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorText(t("login.errorUser"));
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        setErrorText(t("login.errorProfile"));
        return;
      }

      await patchProfileLocale(getStoredLocale());

      const nextPath = searchParams.get("next");
      if (nextPath && nextPath.startsWith("/")) {
        router.push(nextPath);
        return;
      }

      if (profile.role === "super_admin" || profile.role === "admin" || profile.role === "user") {
        router.push("/admin");
        return;
      }

      setErrorText(t("login.errorUnknownRole"));
    } catch {
      setErrorText(t("login.errorFormat"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShellCenter>
      <div className="mb-4 flex justify-end">
        <LanguageSwitcher />
      </div>
      <AppCard title={t("login.title")} subtitle={t("login.subtitle")}>
        <form onSubmit={onSubmit}>
          <FormStack>
            <label className={labelClass}>
              {t("login.loginLabel")}
              <input
                className={inputClass}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder={t("login.loginPlaceholder")}
                autoComplete="username"
                required
              />
            </label>

            <label className={labelClass}>
              {t("login.password")}
              <input
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder={t("login.passwordPlaceholder")}
                autoComplete="current-password"
                required
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className={`${btnPrimary} inline-flex w-full items-center justify-center gap-2`}
            >
              {loading ? (
                <>
                  <CircularProgress size="sm" className="border-white/35 border-t-white" />
                  {t("login.submitting")}
                </>
              ) : (
                t("login.submit")
              )}
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
          <LoginSuspenseFallback />
        </AppShellCenter>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
