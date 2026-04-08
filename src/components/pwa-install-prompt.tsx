"use client";

import { useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";

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
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [platformKind, setPlatformKind] = useState<"ios" | "android" | "other">("other");

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

  async function runDeferredInstall(): Promise<void> {
    if (!deferred) return;
    const ev = deferred;
    setDeferred(null);
    await ev.prompt();
    await ev.userChoice;
  }

  async function onBannerInstallClick() {
    if (!deferred) return;
    await runDeferredInstall();
  }

  if (!hydrated || standalone) return null;

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
    </div>
  );
}
