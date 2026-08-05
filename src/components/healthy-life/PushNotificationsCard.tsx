"use client";

import { useCallback, useEffect, useState } from "react";
import { useHlRouting } from "@/lib/healthy-life/routing";
import { useHlI18n, useT } from "@/lib/healthy-life/i18n";
import type { HlMessageKey } from "@/lib/healthy-life/i18n";
import { useHlToast } from "@/components/healthy-life/HlToast";
import { Button, Card, Field, inputClass } from "@/components/healthy-life/ui";
import { normalizeTime } from "@/lib/healthy-life/medications";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

type Status = {
  configured: boolean;
  pushEnabled: boolean;
  thisDevice: boolean;
  subscriptionCount: number;
  timezone: string;
  weightReminderTime: string | null;
  mealReminderTimes: string[];
};

export function PushNotificationsCard() {
  const { fetch: hlFetch } = useHlRouting();
  const { locale } = useHlI18n();
  const t = useT();
  const toast = useHlToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [weightTime, setWeightTime] = useState("");
  const [mealTimes, setMealTimes] = useState("");
  const [supported, setSupported] = useState(true);

  const refresh = useCallback(async () => {
    const vapidRes = await hlFetch("/api/push/vapid");
    const vapid = await vapidRes.json().catch(() => ({}));
    if (!vapid.configured) {
      setStatus({
        configured: false,
        pushEnabled: false,
        thisDevice: false,
        subscriptionCount: 0,
        timezone: detectTimezone(),
        weightReminderTime: null,
        mealReminderTimes: [],
      });
      return;
    }

    let endpoint: string | undefined;
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        endpoint = sub?.endpoint;
      } catch {
        /* ignore */
      }
    }

    const res = await hlFetch("/api/push/vapid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
    const json = await res.json();
    if (!res.ok) return;

    let mealReminderTimes: string[] = [];
    try {
      mealReminderTimes = JSON.parse(json.mealReminderTimesJson || "[]");
    } catch {
      mealReminderTimes = [];
    }

    setStatus({
      configured: true,
      pushEnabled: Boolean(json.pushEnabled),
      thisDevice: Boolean(json.thisDevice),
      subscriptionCount: Number(json.subscriptionCount || 0),
      timezone: json.timezone || detectTimezone(),
      weightReminderTime: json.weightReminderTime ?? null,
      mealReminderTimes,
    });
    setWeightTime(json.weightReminderTime ?? "");
    setMealTimes(mealReminderTimes.join(", "));
  }, [hlFetch]);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    void refresh();
  }, [refresh]);

  async function enable() {
    setBusy(true);
    try {
      if (!supported) throw new Error(t("push.unsupported"));

      const vapidRes = await hlFetch("/api/push/vapid");
      const vapid = await vapidRes.json();
      if (!vapid.publicKey) throw new Error(t("push.notConfigured"));

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(t("push.denied"));

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
        });
      }

      const json = sub.toJSON();
      const res = await hlFetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          timezone: detectTimezone(),
          locale,
          userAgent: navigator.userAgent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("error"));
      toast.success(t("push.enabled"));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      let endpoint: string | undefined;
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        endpoint = sub?.endpoint;
        if (sub) await sub.unsubscribe().catch(() => null);
      }
      await hlFetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      toast.success(t("push.disabled"));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  async function saveReminderPrefs() {
    setBusy(true);
    try {
      const meals = mealTimes
        .split(/[,;\s]+/)
        .map((s) => normalizeTime(s.trim()))
        .filter(Boolean);
      const weight = weightTime.trim() ? normalizeTime(weightTime.trim()) : null;
      if (weightTime.trim() && !weight) throw new Error(t("push.invalidTime"));

      const res = await hlFetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone: detectTimezone(),
          weightReminderTime: weight || null,
          mealReminderTimes: meals,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("error"));
      toast.success(t("push.prefsSaved"));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  const on = Boolean(status?.thisDevice || (status?.subscriptionCount && status.subscriptionCount > 0));

  return (
    <Card className="mt-4 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-[var(--ink)]">{t("push.title")}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("push.hint")}</p>
      </div>

      {!status?.configured ? (
        <p className="text-sm text-[var(--muted)]">{t("push.notConfigured")}</p>
      ) : !supported ? (
        <p className="text-sm text-[var(--muted)]">{t("push.unsupported")}</p>
      ) : (
        <>
          <p className="text-sm text-[var(--ink)]">
            {on ? t("push.statusOn") : t("push.statusOff")}
            {status?.timezone ? (
              <span className="mt-1 block text-xs text-[var(--muted)]">
                {t("push.timezone", { tz: status.timezone })}
              </span>
            ) : null}
          </p>

          {on ? (
            <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={disable}>
              {busy ? t("saving") : t("push.disable")}
            </Button>
          ) : (
            <Button type="button" className="w-full" disabled={busy} onClick={enable}>
              {busy ? t("saving") : t("push.enable")}
            </Button>
          )}

          <div className="border-t border-[var(--line)] pt-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {t("push.extraTitle")}
            </p>
            <Field label={t("push.weightTime")}>
              <input
                className={inputClass}
                type="time"
                value={weightTime}
                onChange={(e) => setWeightTime(e.target.value)}
              />
            </Field>
            <Field label={t("push.mealTimes")}>
              <input
                className={inputClass}
                value={mealTimes}
                onChange={(e) => setMealTimes(e.target.value)}
                placeholder={t("push.mealTimesPh")}
              />
            </Field>
            <p className="text-xs text-[var(--muted)]">{t("push.medsAuto")}</p>
            <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={saveReminderPrefs}>
              {busy ? t("saving") : t("push.savePrefs")}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

/** Soft prompt after medication schedule save — asks to enable pushes once. */
export async function ensurePushPrompt(opts: {
  hlFetch: (input: string, init?: RequestInit) => Promise<Response>;
  t: (key: HlMessageKey, vars?: Record<string, string | number>) => string;
  toast: { success: (m: string) => void; error: (m: string) => void };
  locale?: string;
}) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return;
  }

  const subscribeCurrent = async () => {
    const vapidRes = await opts.hlFetch("/api/push/vapid");
    const vapid = await vapidRes.json();
    if (!vapid.publicKey) throw new Error(opts.t("push.notConfigured"));
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
    }
    const json = sub.toJSON();
    await opts.hlFetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        timezone: detectTimezone(),
        locale: opts.locale,
        userAgent: navigator.userAgent,
      }),
    });
  };

  if (Notification.permission === "granted") {
    try {
      await subscribeCurrent();
    } catch {
      /* ignore */
    }
    return;
  }
  if (Notification.permission === "denied") return;
  if (sessionStorage.getItem("hl_push_prompted") === "1") return;
  sessionStorage.setItem("hl_push_prompted", "1");

  const ok = window.confirm(opts.t("push.promptConfirm"));
  if (!ok) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    await subscribeCurrent();
    opts.toast.success(opts.t("push.enabled"));
  } catch {
    /* ignore soft prompt failures */
  }
}
