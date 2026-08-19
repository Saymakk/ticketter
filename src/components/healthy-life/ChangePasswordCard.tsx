"use client";

import { FormEvent, useState } from "react";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useT } from "@/lib/healthy-life/i18n";
import { useHlToast } from "@/components/healthy-life/HlToast";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { Button, Card, Field, inputClass } from "@/components/healthy-life/ui";

export function ChangePasswordCard() {
  const { fetch: hlFetch } = useHlRouting();
  const t = useT();
  const toast = useHlToast();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage(null);
  }

  function cancel() {
    resetForm();
    setOpen(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessage(t("auth.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage(t("auth.passwordsMismatch"));
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await hlFetch("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "WRONG_PASSWORD") throw new Error(t("profile.wrongPassword"));
        if (data.error === "PASSWORDS_MISMATCH") throw new Error(t("auth.passwordsMismatch"));
        if (data.error === "PASSWORD_TOO_SHORT") throw new Error(t("auth.passwordTooShort"));
        throw new Error(data.error || t("error"));
      }
      resetForm();
      setOpen(false);
      toast.success(t("toast.passwordChanged"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("error");
      setMessage(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--ink)]">{t("profile.changePassword")}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("profile.changePasswordHint")}</p>
        </div>
        {!open ? (
          <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
            {t("profile.changePasswordAction")}
          </Button>
        ) : null}
      </div>

      {open ? (
        <form className="space-y-3" onSubmit={onSubmit}>
          <Field label={t("profile.currentPassword")}>
            <input
              className={inputClass}
              type={showPasswords ? "text" : "password"}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </Field>
          <Field label={t("profile.newPassword")}>
            <input
              className={inputClass}
              type={showPasswords ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              placeholder={t("auth.passwordHint")}
              required
            />
          </Field>
          <Field label={t("profile.confirmNewPassword")}>
            <input
              className={inputClass}
              type={showPasswords ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
            />
            {showPasswords ? t("auth.hidePassword") : t("auth.showPassword")}
          </label>
          {message ? <p className="text-sm text-[#8a3b2f]">{message}</p> : null}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? t("profile.changingPassword") : t("profile.savePassword")}
          </Button>
          <Button type="button" variant="secondary" className="w-full" disabled={saving} onClick={cancel}>
            {t("cancel")}
          </Button>
        </form>
      ) : null}
    </Card>
  );
}
