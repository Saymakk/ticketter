"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useLocaleContext } from "@/components/locale-provider";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/components/ui/app-shell";

export default function AccountSettingsButton() {
  const { t } = useLocaleContext();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function close() {
    setOpen(false);
    setMsg("");
    setMsgOk(false);
    setPw("");
    setPw2("");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg("");
    setMsgOk(false);
    if (pw.length < 8) {
      setMsg(t("account.minLength"));
      return;
    }
    if (pw !== pw2) {
      setMsg(t("account.mismatch"));
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        setMsg(error.message || t("account.error"));
        return;
      }
      setMsgOk(true);
      setMsg(t("account.success"));
      setPw("");
      setPw2("");
    } catch {
      setMsg(t("account.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        aria-label={t("account.settingsAria")}
        title={t("account.settingsAria")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
              role="presentation"
              onClick={close}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="account-settings-title"
                className="my-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="account-settings-title" className="text-lg font-semibold text-slate-900">
                  {t("account.changePassword")}
                </h2>
                <form onSubmit={onSubmit} className="mt-4 space-y-3">
                  <label className={labelClass}>
                    {t("account.newPassword")}
                    <input
                      type="password"
                      className={inputClass}
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      placeholder={t("common.passwordPlaceholder")}
                    />
                  </label>
                  <label className={labelClass}>
                    {t("account.confirmPassword")}
                    <input
                      type="password"
                      className={inputClass}
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      placeholder={t("common.passwordPlaceholder")}
                    />
                  </label>
                  {msg ? (
                    <p className={`text-sm ${msgOk ? "text-teal-800" : "text-red-700"}`}>{msg}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button type="submit" disabled={loading} className={btnPrimary}>
                      {loading ? t("common.loading") : t("account.submit")}
                    </button>
                    <button type="button" onClick={close} className={btnSecondary}>
                      {t("account.close")}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
