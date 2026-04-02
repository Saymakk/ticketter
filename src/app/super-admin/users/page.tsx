"use client";

import { FormEvent, useState } from "react";
import {
  AppCard,
  AppShell,
  BackNav,
  btnPrimary,
  FormStack,
  inputClass,
  labelClass,
  selectClass,
} from "@/components/ui/app-shell";

type ApiOk = {
  ok: true;
  userId: string;
  authEmail: string;
  loginHint: string;
  mode: "phone" | "email";
};

type ApiErr = { error: string };

export default function SuperAdminUsersPage() {
  const [fullName, setFullName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "super_admin">("admin");
  const [region, setRegion] = useState("");
  const [resultText, setResultText] = useState("");

  async function onCreateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResultText("Создаем пользователя...");

    const res = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        login,
        password,
        role,
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
    setRole("admin");
    setRegion("");
  }

  return (
    <AppShell maxWidth="max-w-2xl">
      <BackNav href="/super-admin">К суперадмину</BackNav>
      <AppCard
        title="Новый пользователь"
        subtitle="Логин — телефон или email. Пароль задаёте вы."
      >
        <form onSubmit={onCreateUser}>
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
              Роль
              <select
                className={selectClass}
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "super_admin")}
              >
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
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
              Создать пользователя
            </button>
          </FormStack>
        </form>

        {resultText && (
          <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {resultText}
          </p>
        )}
      </AppCard>
    </AppShell>
  );
}
