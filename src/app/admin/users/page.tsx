"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AppCard,
  AppShell,
  BackNav,
  btnPrimary,
  btnSecondary,
  FormStack,
  inputClass,
  labelClass,
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

  async function loadUsers() {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const json = await res.json();
    if (res.ok) setUsers(json.users ?? []);
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
    setResultText("Создаём пользователя…");

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
      setResultText(`Ошибка: ${"error" in data ? data.error : "Неизвестная ошибка"}`);
      return;
    }

    setResultText(
      data.mode === "phone"
        ? `Готово. Вход: телефон ${data.loginHint}. Email в Auth: ${data.authEmail}`
        : `Готово. Вход: email ${data.loginHint}`
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
      setResultText(json.error ?? "Ошибка сохранения");
      return;
    }
    cancelEdit();
    await loadUsers();
    setResultText("Сохранено");
  }

  return (
    <AppShell maxWidth="max-w-2xl">
      <BackNav href="/admin">К панели</BackNav>
      <AppCard
        title="Пользователи"
        subtitle="Учётные записи с ролью «пользователь» — билеты и сканер по назначенным мероприятиям."
      >
        <form onSubmit={onCreate}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-teal-800/90">
            Новый пользователь
          </p>
          <FormStack>
            <label className={labelClass}>
              ФИО
              <input
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </label>
            <label className={labelClass}>
              Логин (телефон или email)
              <input
                className={inputClass}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
            </label>
            <label className={labelClass}>
              Пароль (мин. 8 символов)
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
              Регион
              <input
                className={inputClass}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Необязательно"
              />
            </label>
            <button type="submit" className={btnPrimary}>
              Создать пользователя
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
            Список
          </h2>
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
                      placeholder="Регион"
                    />
                    {isSuper && (
                      <select
                        className={selectClass}
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as "user" | "admin")}
                      >
                        <option value="user">пользователь</option>
                        <option value="admin">администратор</option>
                      </select>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={saveEdit} className={btnPrimary}>
                        Сохранить
                      </button>
                      <button type="button" onClick={cancelEdit} className={btnSecondary}>
                        Отмена
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
                      Изменить
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </AppCard>
    </AppShell>
  );
}
