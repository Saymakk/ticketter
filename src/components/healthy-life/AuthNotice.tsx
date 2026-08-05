"use client";

import { useEffect } from "react";
import { cn } from "@/lib/healthy-life/format";

export type AuthNoticeTone = "success" | "error" | "info";

export function AuthNotice({
  message,
  tone = "info",
  onDismiss,
  autoHideMs = 0,
}: {
  message: string;
  tone?: AuthNoticeTone;
  onDismiss?: () => void;
  /** Auto-hide after N ms (0 = stay until dismissed / parent clears). */
  autoHideMs?: number;
}) {
  useEffect(() => {
    if (!autoHideMs || !onDismiss) return;
    const t = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(t);
  }, [autoHideMs, onDismiss, message]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "animate-rise fixed inset-x-0 top-0 z-[90] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]",
      )}
    >
      <div
        className={cn(
          "flex w-full max-w-lg items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_16px_40px_-20px_rgba(28,55,42,0.55)] backdrop-blur-md",
          tone === "success" &&
            "border-[#9bc4a8] bg-[color-mix(in_srgb,var(--accent)_92%,white)] text-white",
          tone === "error" && "border-[#e8b4ab] bg-[#fff5f3] text-[#8a3b2f]",
          tone === "info" && "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]",
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            tone === "success" && "bg-white/20",
            tone === "error" && "bg-[#f3d9d4]",
            tone === "info" && "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
          )}
          aria-hidden
        >
          {tone === "success" ? "✓" : tone === "error" ? "!" : "i"}
        </span>
        <p className="min-w-0 flex-1 pt-0.5 text-sm font-medium leading-snug">{message}</p>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              "shrink-0 rounded-lg px-2 py-1 text-xs font-semibold opacity-80 transition hover:opacity-100",
              tone === "success" && "text-white",
            )}
            aria-label="Закрыть"
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}
