"use client";

import { useMemo, useRef } from "react";
import type { TouchEventHandler } from "react";

type UseHorizontalSwipeTabsParams<T extends string> = {
  tabs: readonly T[];
  activeTab: T;
  onChange: (next: T) => void;
  enabled?: boolean;
};

type SwipeHandlers = {
  onTouchStart: TouchEventHandler<HTMLElement>;
  onTouchMove: TouchEventHandler<HTMLElement>;
  onTouchEnd: TouchEventHandler<HTMLElement>;
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input,textarea,select,button,a,label,[role='button'],[data-no-swipe-tabs='true']"
    )
  );
}

export function useHorizontalSwipeTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
  enabled = true,
}: UseHorizontalSwipeTabsParams<T>): SwipeHandlers {
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const blockedRef = useRef(false);

  return useMemo(
    () => ({
      onTouchStart: (e) => {
        if (!enabled) return;
        blockedRef.current = isInteractiveTarget(e.target);
        if (blockedRef.current) return;
        const t = e.touches[0];
        if (!t) return;
        startXRef.current = t.clientX;
        startYRef.current = t.clientY;
      },
      onTouchMove: () => {
        // no-op, but kept for consistent handler set
      },
      onTouchEnd: (e) => {
        if (!enabled || blockedRef.current) return;
        const startX = startXRef.current;
        const startY = startYRef.current;
        startXRef.current = null;
        startYRef.current = null;
        if (startX === null || startY === null) return;
        const t = e.changedTouches[0];
        if (!t) return;

        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        // Require intentional horizontal swipe.
        if (absX < 42 || absX <= absY * 1.2) return;

        const idx = tabs.indexOf(activeTab);
        if (idx < 0) return;

        if (dx < 0 && idx < tabs.length - 1) {
          onChange(tabs[idx + 1]);
        } else if (dx > 0 && idx > 0) {
          onChange(tabs[idx - 1]);
        }
      },
    }),
    [activeTab, enabled, onChange, tabs]
  );
}

