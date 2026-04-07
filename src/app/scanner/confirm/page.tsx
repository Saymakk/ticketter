"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocaleContext } from "@/components/locale-provider";
import {
  isScannerFromPanelParam,
  scannerConfirmHref,
  SCANNER_FROM_PANEL_PARAM,
} from "@/lib/scanner/from-panel";
import { AppShell, ListLoading } from "@/components/ui/app-shell";

/** Старые ссылки `/scanner/confirm?…` ведут на `/scanner?eventId&uuid…` с модалкой билета. */
function ConfirmRedirectInner() {
  const { t } = useLocaleContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const eventId = searchParams.get("eventId") ?? "";
    const uuid = searchParams.get("uuid") ?? "";
    if (!eventId || !uuid) {
      router.replace("/scanner");
      return;
    }
    const fromPanel = isScannerFromPanelParam(
      searchParams.get(SCANNER_FROM_PANEL_PARAM)
    );
    router.replace(scannerConfirmHref(eventId, uuid, fromPanel));
  }, [router, searchParams]);

  return (
    <AppShell maxWidth="max-w-md">
      <ListLoading label={t("common.loading")} />
    </AppShell>
  );
}

function ConfirmRedirectFallback() {
  const { t } = useLocaleContext();
  return (
    <AppShell maxWidth="max-w-md">
      <ListLoading label={t("common.loading")} />
    </AppShell>
  );
}

export default function ScannerConfirmRedirectPage() {
  return (
    <Suspense fallback={<ConfirmRedirectFallback />}>
      <ConfirmRedirectInner />
    </Suspense>
  );
}
