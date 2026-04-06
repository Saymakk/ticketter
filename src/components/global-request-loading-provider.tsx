"use client";

import { useSyncExternalStore } from "react";
import {
  getGlobalRequestLoadingActive,
  subscribeTrackedFetch,
} from "@/lib/http/tracked-fetch";
import { CircularProgress } from "@/components/ui/loading";

export default function GlobalRequestLoadingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const active = useSyncExternalStore(
    subscribeTrackedFetch,
    getGlobalRequestLoadingActive,
    () => false
  );

  return (
    <>
      {children}
      {active ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/20 backdrop-blur-[1px]"
          aria-busy="true"
          aria-live="polite"
        >
          <div
            className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-10 py-8 shadow-xl"
            role="status"
          >
            <CircularProgress size="lg" />
          </div>
        </div>
      ) : null}
    </>
  );
}
