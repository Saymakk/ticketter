"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { trackedFetch } from "@/lib/http/tracked-fetch";
import {
  AppCard,
  AppShell,
  PageHeaderWithBack,
  btnDanger,
  btnPrimary,
  btnSecondary,
  FormStack,
  inputClass,
  labelClass,
  ListLoading,
  selectClass,
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

/** Доступ через API только для super_admin; редактирование списка — как у пользователей (ФИО, регион, роль, пароль). */
export default function SuperAdminAdminsPage() {
  const { t } = useLocaleContext();
  const [fullName, setFullName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [region, setRegion] = useState("");
  const [resultText, setResultText] = useState("");
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editRole, setEditRole] = useState<"user" | "admin">("admin");
  const [editPassword, setEditPassword] = useState("");

  async function loadAdmins() {
    setListLoading(true);
    try {
      const res = await trackedFetch("/api/super-admin/admins", { cache: "no-store" });
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

    const res = await trackedFetch("/api/admin/users/create", {
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
    const res = await trackedFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setResultText(json.error ?? t("super.admins.deleteError"));
      return;
    }
    if (editId === id) cancelEdit();
    await loadAdmins();
    setResultText(t("super.admins.deleteSuccess"));
  }

  function startEdit(a: AdminRow) {
    setEditId(a.id);
    setEditName(a.full_name ?? "");
    setEditRegion(a.region ?? "");
    setEditRole(a.role === "admin" ? "admin" : "user");
    setEditPassword("");
  }

  function cancelEdit() {
    setEditId(null);
    setEditPassword("");
  }

  async function saveEdit() {
    if (!editId) return;
    const body: Record<string, unknown> = {
      fullName: editName,
      region: editRegion || null,
      role: editRole,
    };
    if (editPassword.trim().length >= 8) {
      body.password = editPassword.trim();
    }

    const res = await trackedFetch(`/api/admin/users/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setResultText(json.error ?? t("admin.users.saveError"));
      return;
    }
    cancelEdit();
    await loadAdmins();
    setResultText(t("admin.users.saved"));
  }

  return (
    <AppShell maxWidth="max-w-2xl">
      <PageHeaderWithBack
        backHref="/admin"
        backLabel={t("common.toPanel")}
        title={t("super.admins.title")}
      />
      <AppCard>
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
            <ul className="space-y-3 text-sm text-slate-800">
              {admins.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                  {editId === a.id ? (
                    <div className="space-y-2">
                      <input
                        className={inputClass}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={t("admin.users.fullNamePh")}
                      />
                      <input
                        className={inputClass}
                        value={editRegion}
                        onChange={(e) => setEditRegion(e.target.value)}
                        placeholder={t("admin.users.editRegionPh")}
                      />
                      <select
                        className={selectClass}
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as "user" | "admin")}
                      >
                        <option value="user">{t("admin.users.roleUser")}</option>
                        <option value="admin">{t("admin.users.roleAdmin")}</option>
                      </select>
                      <label className={labelClass}>
                        {t("admin.users.newPasswordOptional")}
                        <input
                          type="password"
                          className={inputClass}
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder={t("admin.users.newPasswordPh")}
                          minLength={8}
                          autoComplete="new-password"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void saveEdit()} className={btnPrimary}>
                          {t("common.save")}
                        </button>
                        <button type="button" onClick={cancelEdit} className={btnSecondary}>
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{a.full_name ?? "—"}</p>
                        <p className="text-sm text-slate-600">
                          {a.phone ?? "—"}
                          {a.region ? ` · ${a.region}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => startEdit(a)} className={btnSecondary}>
                          {t("admin.users.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteAdmin(a.id)}
                          className={btnDanger}
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </AppCard>
    </AppShell>
  );
}
