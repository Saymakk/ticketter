"use client";

import { FormEvent, useState } from "react";

type ApiResult =
  | { ok: true; userId: string; loginPhone: string; generatedPassword: string }
  | { error: string };

export default function SuperAdminUsersPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "super_admin">("admin");
  const [region, setRegion] = useState("");
  const [resultText, setResultText] = useState("");

  async function onCreateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResultText("Создаем пользователя...");

    const res = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, phone, role, region: region || null }),
    });

    const data = (await res.json()) as ApiResult;

    if (!res.ok || "error" in data) {
      setResultText(`Ошибка: ${"error" in data ? data.error : "Неизвестная ошибка"}`);
      return;
    }

    setResultText(
      `Готово. Телефон для входа: ${data.loginPhone}, пароль: ${data.generatedPassword}`
    );

    setFullName("");
    setPhone("");
    setRole("admin");
    setRegion("");
  }

  return (
    <main style={{ maxWidth: 560, margin: "24px auto", padding: 16 }}>
      <h1>Super Admin / Пользователи</h1>

      <form onSubmit={onCreateUser} style={{ display: "grid", gap: 12 }}>
        <label>
          ФИО
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>

        <label>
          Телефон
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 701 123 45 67"
            required
          />
        </label>

        <label>
          Роль
          <select value={role} onChange={(e) => setRole(e.target.value as any)}>
            <option value="admin">admin</option>
            <option value="scanner">scanner</option>
            <option value="super_admin">super_admin</option>
          </select>
        </label>

        <label>
          Регион (north/south/west/east)
          <input value={region} onChange={(e) => setRegion(e.target.value)} />
        </label>

        <button type="submit">Создать пользователя</button>
      </form>

      {resultText && <p style={{ marginTop: 12 }}>{resultText}</p>}
    </main>
  );
}