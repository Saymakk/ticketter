"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/healthy-life/format";

type ActionTone = "primary" | "secondary" | "med" | "med-secondary";

const toneClass: Record<ActionTone, string> = {
  primary: "bg-[var(--accent)] text-white shadow-[0_10px_22px_-14px_var(--accent)]",
  secondary: "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
  med: "bg-[var(--med-accent)] text-white shadow-[0_10px_22px_-14px_var(--med-accent)]",
  "med-secondary": "bg-[var(--med-soft)] text-[var(--med-accent-ink)]",
};

function ActionTooltip({
  label,
  visible,
}: {
  label: string;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-[calc(100%+0.4rem)] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--ink)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg"
    >
      {label}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--ink)]" />
    </span>
  );
}

function useHoldTooltip() {
  const [held, setHeld] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHeld(false);
  }, []);

  const onTouchStart = useCallback(() => {
    clear();
    timer.current = setTimeout(() => setHeld(true), 380);
  }, [clear]);

  useEffect(() => () => clear(), [clear]);

  return {
    held,
    clear,
    touchHandlers: {
      onTouchStart,
      onTouchEnd: clear,
      onTouchCancel: clear,
      onTouchMove: clear,
    },
  };
}

export function IconActionButton({
  label,
  tone,
  onClick,
  icon,
}: {
  label: string;
  tone: ActionTone;
  onClick: () => void;
  icon: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const tip = useHoldTooltip();
  const showTip = hovered || tip.held;

  return (
    <div className="relative flex flex-1 justify-center">
      <ActionTooltip label={label} visible={showTip} />
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        {...tip.touchHandlers}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl transition active:scale-95 touch-manipulation",
          toneClass[tone],
        )}
      >
        {icon}
      </button>
    </div>
  );
}

export function IconActionLink({
  label,
  tone,
  href,
  icon,
}: {
  label: string;
  tone: ActionTone;
  href: string;
  icon: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const tip = useHoldTooltip();
  const showTip = hovered || tip.held;

  return (
    <div className="relative flex flex-1 justify-center">
      <ActionTooltip label={label} visible={showTip} />
      <Link
        href={href}
        aria-label={label}
        title={label}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        {...tip.touchHandlers}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl transition active:scale-95 touch-manipulation",
          toneClass[tone],
        )}
      >
        {icon}
      </Link>
    </div>
  );
}

export function FoodActionIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 11c0-2.2 2.7-4 8-4s8 1.8 8 4v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 9V6.5M12 8.5V5.5M16 9V6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function WorkoutActionIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.5 9v6M17.5 9v6M4 11v2M20 11v2M8 12h8M6.5 9H8v6H6.5M17.5 9H16v6h1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MedActionIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="8" width="17" height="8" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v8M8.5 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ScheduleActionIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.2" fill="currentColor" />
    </svg>
  );
}
