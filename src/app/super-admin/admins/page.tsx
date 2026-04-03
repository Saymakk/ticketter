"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import {
  AppCard,
  AppShell,
  BackNav,
  btnPrimary,
  btnSecondary,
  FormStack,
  inputClass,
  labelClass,
  ListLoading,
} from "@/components/ui/app-shell";

type AdminRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  region: string | null;
};

type ApiOk = {
  ok: true;
  userId: string;
  authEmail: string;
  loginHint: string;
  mode: "phone" | "email";
};

type ApiErr = { error: string };

export default function SuperAdminAdminsPage() {
  const { t } = useLocaleContext();
  const [fullName, setFullName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [region, setRegion] = useState("");
  const [resultText, setResultText] = useState("");
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [listLoading, setListLoading] = useState(true);

  async function loadAdmins() {
    setListLoading(true);
    try {
      const res = await fetch("/api/super-admin/admins", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setAdmins(json.admins ?? []);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    void loadAdmins();
  }, []);

  async function onCreateAdmin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResultText(t("super.admins.creating"));

    const res = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        login,
        password,
        role: "admin",
        region: region || null,
      }),
    });

    const data = (await res.json()) as ApiOk | ApiErr;

    if (!res.ok || !("ok" in data) || !data.ok) {
      setResultText(
        t("super.admins.createError", {
          error: "error" in data ? data.error : t("super.admins.unknownError"),
        })
      );
      return;
    }

    if (data.mode === "phone") {
      setResultText(
        t("super.admins.donePhone", {
          loginHint: data.loginHint,
          authEmail: data.authEmail,
        })
      );
    } else {
      setResultText(t("super.admins.doneEmail", { loginHint: data.loginHint }));
    }

    setFullName("");
    setLogin("");
    setPassword("");
    setRegion("");
    await loadAdmins();
  }

  return (
    <AppShell maxWidth="max-w-2xl">
      <BackNav href="/admin">{t("common.toPanel")}</BackNav>
      <AppCard title={t("super.admins.title")} subtitle={t("super.admins.subtitle")}>
        <form onSubmit={onCreateAdmin}>
          <FormStack>
            <label className={labelClass}>
              {t("super.admins.fullName")}
              <input
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </label>

            <label className={labelClass}>
              {t("super.admins.login")}
              <input
                className={inputClass}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder={t("super.admins.loginPh")}
                autoComplete="off"
                required
              />
            </label>

            <label className={labelClass}>
              {t("super.admins.password")}
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </label>

            <label className={labelClass}>
              {t("super.admins.region")}
              <input
                className={inputClass}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder={t("super.admins.regionPh")}
              />
            </label>

            <button type="submit" className={btnPrimary}>
              {t("super.admins.submit")}
            </button>
          </FormStack>
        </form>

        {resultText && (
          <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {resultText}
          </p>
        )}

        <div className="mt-10 border-t border-slate-100 pt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-teal-800/90">
            {t("super.admins.listTitle")}
          </h2>
          {listLoading ? (
            <ListLoading label={t("common.loading")} className="py-8" />
          ) : admins.length === 0 ? (
            <p className="text-sm text-slate-600">{t("super.admins.listEmpty")}</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-800">
              {admins.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <span className="font-medium">{a.full_name ?? "—"}</span>
                  {a.phone ? <span className="text-slate-600"> · {a.phone}</span> : null}
                  {a.region ? <span className="text-slate-500"> · {a.region}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => void loadAdmins()}
            disabled={listLoading}
            className={`${btnSecondary} mt-4`}
          >
            {t("super.admins.refreshList")}
          </button>
        </div>
      </AppCard>
    </AppShell>
  );
}
