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
  const [fullName, setFullName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [region, setRegion] = useState("");
  const [resultText, setResultText] = useState("");
  const [admins, setAdmins] = useState<AdminRow[]>([]);

  async function loadAdmins() {
    const res = await fetch("/api/super-admin/admins", { cache: "no-store" });
    const json = await res.json();
    if (res.ok) setAdmins(json.admins ?? []);
  }

  useEffect(() => {
    void loadAdmins();
  }, []);

  async function onCreateAdmin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResultText("Создаём администратора…");

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
      setResultText(`Ошибка: ${"error" in data ? data.error : "Неизвестная ошибка"}`);
      return;
    }

    if (data.mode === "phone") {
      setResultText(
        `Готово. Вход: телефон ${data.loginHint}, пароль — заданный при создании. Технический email в Auth: ${data.authEmail}`
      );
    } else {
      setResultText(
        `Готово. Вход: email ${data.loginHint}, пароль — заданный при создании.`
      );
    }

    setFullName("");
    setLogin("");
    setPassword("");
    setRegion("");
    await loadAdmins();
  }

  return (
    <AppShell maxWidth="max-w-2xl">
      <BackNav href="/super-admin">К суперадмину</BackNav>
      <AppCard
        title="Администраторы"
        subtitle="Только суперадмин может создавать учётные записи с ролью «администратор». Они управляют мероприятиями и пользователями."
      >
        <form onSubmit={onCreateAdmin}>
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
                placeholder="+7 701 123 45 67 или name@company.com"
                autoComplete="off"
                required
              />
            </label>

            <label className={labelClass}>
              Пароль (минимум 8 символов)
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
              Регион (north / south / west / east)
              <input
                className={inputClass}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Необязательно"
              />
            </label>

            <button type="submit" className={btnPrimary}>
              Создать администратора
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
            Список администраторов
          </h2>
          {admins.length === 0 ? (
            <p className="text-sm text-slate-600">Пока нет записей</p>
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
          <button type="button" onClick={() => loadAdmins()} className={`${btnSecondary} mt-4`}>
            Обновить список
          </button>
        </div>
      </AppCard>
    </AppShell>
  );
}
