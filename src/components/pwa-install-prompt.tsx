"use client";

import { useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { btnSecondary } from "@/components/ui/app-shell";

const isDevBuild = process.env.NODE_ENV === "development";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function getPlatformKind(): "ios" | "android" | "other" {
  if (typeof navigator === "undefined") return "other";
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "android";
  return "other";
}

export default function PwaInstallPrompt() {
  const { t } = useLocaleContext();
  const [hydrated, setHydrated] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [modalDismissed, setModalDismissed] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [platformKind, setPlatformKind] = useState<"ios" | "android" | "other">("other");
  const [installFallbackHint, setInstallFallbackHint] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
    setPlatformKind(getPlatformKind());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    const sync = () => setStandalone(isStandaloneDisplay());
    sync();
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", sync);
    window.addEventListener("appinstalled", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("appinstalled", sync);
    };
  }, []);

  function pwaModalBody() {
    switch (platformKind) {
      case "ios":
        return t("scanner.pwaModalBodyIos");
      case "android":
        return t("scanner.pwaModalBodyAndroid");
      default:
        return t("scanner.pwaModalBodyOther");
    }
  }

  function pwaBannerBody() {
    switch (platformKind) {
      case "ios":
        return t("scanner.pwaBannerIos");
      case "android":
        return t("scanner.pwaBannerAndroid");
      default:
        return t("scanner.pwaBannerOther");
    }
  }

  function fallbackHintText() {
    return isDevBuild ? t("scanner.pwaInstallDevHint") : t("scanner.pwaInstallNoPrompt");
  }

  async function runDeferredInstall(): Promise<void> {
    if (!deferred) return;
    const ev = deferred;
    setDeferred(null);
    await ev.prompt();
    await ev.userChoice;
  }

  async function onPrimaryModalClick() {
    setInstallFallbackHint(false);

    /* Safari iOS: нет beforeinstallprompt — только ручная установка */
    if (platformKind === "ios") {
      setModalDismissed(true);
      return;
    }

    if (deferred) {
      try {
        await runDeferredInstall();
        setModalDismissed(true);
      } catch {
        setInstallFallbackHint(true);
      }
      return;
    }

    /* Нет отложенного события: dev без SW, не Chrome, критерии PWA и т.д. */
    setInstallFallbackHint(true);
  }

  async function onBannerInstallClick() {
    if (!deferred) return;
    try {
      await runDeferredInstall();
    } catch {
      setInstallFallbackHint(true);
      setModalDismissed(false);
    }
  }

  if (!hydrated || standalone) return null;

  if (!modalDismissed) {
    const primaryIsContinue = platformKind === "ios";
    return (
      <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-slate-900/45 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white px-5 py-5 shadow-2xl">
          <p className="text-sm leading-relaxed text-slate-700">{pwaModalBody()}</p>
          {installFallbackHint ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {fallbackHintText()}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-start gap-2">
            <button type="button" className={btnSecondary} onClick={() => setModalDismissed(true)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              onClick={() => void onPrimaryModalClick()}
            >
              {primaryIsContinue ? t("scanner.pwaContinue") : t("scanner.installApp")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-teal-200/80 bg-teal-50/90 px-3 py-2.5 text-sm text-slate-800 shadow-sm">
      <div className="flex flex-wrap items-center justify-start gap-2">
        <span className="min-w-0 flex-1 leading-snug">{pwaBannerBody()}</span>
        {deferred ? (
          <button
            type="button"
            className="shrink-0 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
            onClick={() => void onBannerInstallClick()}
          >
            {t("scanner.installApp")}
          </button>
        ) : null}
      </div>
      {installFallbackHint ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-snug text-amber-950">
          {fallbackHintText()}
        </p>
      ) : null}
    </div>
  );
}
