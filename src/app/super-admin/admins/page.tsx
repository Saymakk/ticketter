"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import {
  AppCard,
  AppShell,
  BackNav,
  btnDanger,
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
  const [pwModalId, setPwModalId] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

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

  async function deleteAdmin(id: string) {
    const ok = window.confirm(t("super.admins.deleteConfirm"));
    if (!ok) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setResultText(json.error ?? t("super.admins.deleteError"));
      return;
    }
    if (pwModalId === id) {
      setPwModalId(null);
      setNewPw("");
      setNewPw2("");
    }
    await loadAdmins();
    setResultText(t("super.admins.deleteSuccess"));
  }

  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pwModalId) return;
    if (newPw.length < 8) {
      setResultText(t("account.minLength"));
      return;
    }
    if (newPw !== newPw2) {
      setResultText(t("account.mismatch"));
      return;
    }
    setPwLoading(true);
    setResultText("");
    try {
      const res = await fetch(`/api/admin/users/${pwModalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPw }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResultText(json.error ?? t("super.admins.passwordError"));
        return;
      }
      setResultText(t("super.admins.passwordSaved"));
      setPwModalId(null);
      setNewPw("");
      setNewPw2("");
    } finally {
      setPwLoading(false);
    }
  }

  function closePwModal() {
    setPwModalId(null);
    setNewPw("");
    setNewPw2("");
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
                placeholder={t("super.admins.fullNamePh")}
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
                placeholder={t("super.admins.passwordPh")}
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
                <li
                  key={a.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span className="font-medium">{a.full_name ?? "—"}</span>
                    {a.phone ? <span className="text-slate-600"> · {a.phone}</span> : null}
                    {a.region ? <span className="text-slate-500"> · {a.region}</span> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPwModalId(a.id);
                        setNewPw("");
                        setNewPw2("");
                      }}
                      className={btnSecondary}
                    >
                      {t("super.admins.setPassword")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteAdmin(a.id)}
                      className={btnDanger}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
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

      {pwModalId ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={closePwModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">{t("super.admins.passwordModalTitle")}</h2>
            <form onSubmit={savePassword} className="mt-4 space-y-3">
              <label className={labelClass}>
                {t("account.newPassword")}
                <input
                  type="password"
                  className={inputClass}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  placeholder={t("common.passwordPlaceholder")}
                />
              </label>
              <label className={labelClass}>
                {t("account.confirmPassword")}
                <input
                  type="password"
                  className={inputClass}
                  value={newPw2}
                  onChange={(e) => setNewPw2(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  placeholder={t("common.passwordPlaceholder")}
                />
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="submit" disabled={pwLoading} className={btnPrimary}>
                  {pwLoading ? t("common.loading") : t("account.submit")}
                </button>
                <button type="button" onClick={closePwModal} className={btnSecondary}>
                  {t("account.close")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
