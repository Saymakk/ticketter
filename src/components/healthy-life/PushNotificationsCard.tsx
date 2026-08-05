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

/** Avoid hanging on serviceWorker.ready when no SW is registered. */
async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("NO_SW");
  }

  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    try {
      reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    } catch {
      throw new Error("NO_SW");
    }
  }

  // Wait for active worker with timeout (ready can hang forever).
  if (reg.active) return reg;

  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<void>((_, reject) => {
      window.setTimeout(() => reject(new Error("NO_SW")), 8000);
    }),
  ]);

  reg = (await navigator.serviceWorker.getRegistration()) || reg;
  return reg;
}

type Status = {
  configured: boolean;
  pushEnabled: boolean;
  thisDevice: boolean;
  subscriptionCount: number;
  timezone: string;
  weightReminderTime: string | null;
  mealReminderTimes: string[];
  loadError?: string | null;
  publicKey?: string | null;
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
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(async () => {
    const vapidRes = await hlFetch("/api/push/vapid");
    const vapid = (await vapidRes.json().catch(() => ({}))) as {
      configured?: boolean;
      publicKey?: string | null;
    };

    if (vapidRes.status === 401) {
      setStatus({
        configured: false,
        pushEnabled: false,
        thisDevice: false,
        subscriptionCount: 0,
        timezone: detectTimezone(),
        weightReminderTime: null,
        mealReminderTimes: [],
        loadError: t("unauthorized"),
      });
      return;
    }

    if (!vapidRes.ok) {
      setStatus({
        configured: false,
        pushEnabled: false,
        thisDevice: false,
        subscriptionCount: 0,
        timezone: detectTimezone(),
        weightReminderTime: null,
        mealReminderTimes: [],
        loadError: t("push.loadError"),
      });
      return;
    }

    const configured = Boolean(vapid.configured || vapid.publicKey);
    if (!configured) {
      setStatus({
        configured: false,
        pushEnabled: false,
        thisDevice: false,
        subscriptionCount: 0,
        timezone: detectTimezone(),
        weightReminderTime: null,
        mealReminderTimes: [],
        loadError: null,
        publicKey: null,
      });
      return;
    }

    // Mark configured immediately — do not depend on SW / POST succeeding.
    let endpoint: string | undefined;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      endpoint = sub?.endpoint;
    } catch {
      /* ignore */
    }

    let pushEnabled = true;
    let thisDevice = false;
    let subscriptionCount = 0;
    let timezone = detectTimezone();
    let weightReminderTime: string | null = null;
    let mealReminderTimes: string[] = [];

    try {
      const res = await hlFetch("/api/push/vapid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      if (res.ok) {
        const json = await res.json();
        pushEnabled = Boolean(json.pushEnabled);
        thisDevice = Boolean(json.thisDevice);
        subscriptionCount = Number(json.subscriptionCount || 0);
        timezone = json.timezone || timezone;
        weightReminderTime = json.weightReminderTime ?? null;
        try {
          mealReminderTimes = JSON.parse(json.mealReminderTimesJson || "[]");
        } catch {
          mealReminderTimes = [];
        }
      }
    } catch {
      /* status POST is optional */
    }

    setStatus({
      configured: true,
      pushEnabled,
      thisDevice,
      subscriptionCount,
      timezone,
      weightReminderTime,
      mealReminderTimes,
      publicKey: vapid.publicKey ?? null,
    });
    setWeightTime(weightReminderTime ?? "");
    setMealTimes(mealReminderTimes.join(", "));
  }, [hlFetch, t]);

  useEffect(() => {
    setMounted(true);
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void hlFetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: detectTimezone(), preferredLocale: locale }),
    }).catch(() => null);
  }, [hlFetch, locale]);

  async function enable() {
    setBusy(true);
    try {
      if (!supported) throw new Error(t("push.unsupported"));

      const vapidRes = await hlFetch("/api/push/vapid");
      const vapid = await vapidRes.json();
      const publicKey = vapid.publicKey || status?.publicKey;
      if (!publicKey) throw new Error(t("push.notConfigured"));

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(t("push.denied"));

      let reg: ServiceWorkerRegistration;
      try {
        reg = await getOrRegisterServiceWorker();
      } catch {
        throw new Error(t("push.noServiceWorker"));
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
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
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
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

  // Avoid SSR/client text mismatch (React #418) — render only after mount.
  if (!mounted) {
    return (
      <Card className="mt-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--ink)]">{t("push.title")}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("push.hint")}</p>
        </div>
        <p className="text-sm text-[var(--muted)]">{t("loading")}</p>
      </Card>
    );
  }

  return (
    <Card className="mt-4 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-[var(--ink)]">{t("push.title")}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("push.hint")}</p>
      </div>

      {!status ? (
        <p className="text-sm text-[var(--muted)]">{t("loading")}</p>
      ) : !status.configured ? (
        <p className="text-sm text-[var(--muted)]">
          {status.loadError || t("push.notConfigured")}
        </p>
      ) : !supported ? (
        <p className="text-sm text-[var(--muted)]">{t("push.unsupported")}</p>
      ) : (
        <>
          <p className="text-sm text-[var(--ink)]">
            {on ? t("push.statusOn") : t("push.statusOff")}
            {status.timezone ? (
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
    const reg = await getOrRegisterServiceWorker();
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
