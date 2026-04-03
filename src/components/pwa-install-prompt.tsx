"use client";

import { useEffect, useState } from "react";
import { useLocaleContext } from "@/components/locale-provider";
import { btnSecondary } from "@/components/ui/app-shell";

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

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export default function PwaInstallPrompt() {
  const { t } = useLocaleContext();
  const [standalone, setStandalone] = useState(true);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone || dismissed) return null;

  if (deferred) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200/80 bg-teal-50/90 px-3 py-2.5 text-sm text-slate-800 shadow-sm">
        <span className="min-w-0 flex-1 leading-snug">{t("scanner.installAppHint")}</span>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => setDismissed(true)}
            aria-label={t("scanner.installAppDismiss")}
          >
            {t("scanner.installAppLater")}
          </button>
          <button
            type="button"
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
            onClick={async () => {
              try {
                await deferred.prompt();
                await deferred.userChoice;
              } finally {
                setDeferred(null);
              }
            }}
          >
            {t("scanner.installApp")}
          </button>
        </div>
      </div>
    );
  }

  if (isIos()) {
    return (
      <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs leading-relaxed text-slate-600">
        {t("scanner.installAppIosHint")}
      </p>
    );
  }

  return null;
}
