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
  selectClass,
} from "@/components/ui/app-shell";

type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
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

export default function AdminUsersPage() {
  const { t } = useLocaleContext();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [fullName, setFullName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [region, setRegion] = useState("");
  const [resultText, setResultText] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editRole, setEditRole] = useState<"user" | "admin">("user");
  const [isSuper, setIsSuper] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  async function loadUsers() {
    setListLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setUsers(json.users ?? []);
    } finally {
      setListLoading(false);
    }
  }

  async function loadMe() {
    const res = await fetch("/api/auth/role", { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.role === "super_admin") setIsSuper(true);
  }

  useEffect(() => {
    void loadUsers();
    void loadMe();
  }, []);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResultText(t("admin.users.creating"));

    const res = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        login,
        password,
        role: "user",
        region: region || null,
      }),
    });

    const data = (await res.json()) as ApiOk | ApiErr;

    if (!res.ok || !("ok" in data) || !data.ok) {
      setResultText(
        t("admin.users.createError", {
          error: "error" in data ? data.error : t("admin.users.unknownError"),
        })
      );
      return;
    }

    setResultText(
      data.mode === "phone"
        ? t("admin.users.donePhone", {
            loginHint: data.loginHint,
            authEmail: data.authEmail,
          })
        : t("admin.users.doneEmail", { loginHint: data.loginHint })
    );
    setFullName("");
    setLogin("");
    setPassword("");
    setRegion("");
    await loadUsers();
  }

  function startEdit(u: UserRow) {
    setEditId(u.id);
    setEditName(u.full_name ?? "");
    setEditRegion(u.region ?? "");
    setEditRole("user");
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function saveEdit() {
    if (!editId) return;
    const res = await fetch(`/api/admin/users/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: editName,
        region: editRegion || null,
        ...(isSuper ? { role: editRole } : {}),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setResultText(json.error ?? t("admin.users.saveError"));
      return;
    }
    cancelEdit();
    await loadUsers();
    setResultText(t("admin.users.saved"));
  }

  return (
    <AppShell maxWidth="max-w-2xl">
      <BackNav href="/admin">{t("common.toPanel")}</BackNav>
      <AppCard title={t("admin.users.title")} subtitle={t("admin.users.subtitle")}>
        <form onSubmit={onCreate}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-teal-800/90">
            {t("admin.users.sectionNew")}
          </p>
          <FormStack>
            <label className={labelClass}>
              {t("admin.users.fullName")}
              <input
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </label>
            <label className={labelClass}>
              {t("admin.users.login")}
              <input
                className={inputClass}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
            </label>
            <label className={labelClass}>
              {t("admin.users.password")}
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
            <label className={labelClass}>
              {t("admin.users.region")}
              <input
                className={inputClass}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder={t("admin.users.regionPh")}
              />
            </label>
            <button type="submit" className={btnPrimary}>
              {t("admin.users.submit")}
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
            {t("admin.users.listTitle")}
          </h2>
          {listLoading ? (
            <ListLoading label={t("common.loading")} className="py-8" />
          ) : (
          <ul className="space-y-3">
            {users.map((u) => (
              <li key={u.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                {editId === u.id ? (
                  <div className="space-y-2">
                    <input
                      className={inputClass}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <input
                      className={inputClass}
                      value={editRegion}
                      onChange={(e) => setEditRegion(e.target.value)}
                      placeholder={t("admin.users.editRegionPh")}
                    />
                    {isSuper && (
                      <select
                        className={selectClass}
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as "user" | "admin")}
                      >
                        <option value="user">{t("admin.users.roleUser")}</option>
                        <option value="admin">{t("admin.users.roleAdmin")}</option>
                      </select>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={saveEdit} className={btnPrimary}>
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
                      <p className="font-medium text-slate-900">{u.full_name ?? "—"}</p>
                      <p className="text-sm text-slate-600">
                        {u.phone ?? "—"}
                        {u.region ? ` · ${u.region}` : ""}
                      </p>
                    </div>
                    <button type="button" onClick={() => startEdit(u)} className={btnSecondary}>
                      {t("admin.users.edit")}
                    </button>
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
