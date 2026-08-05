"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/healthy-life/format";

const items = [
  { href: "/", label: "День", icon: DayIcon },
  { href: "/add", label: "Еда", icon: MealIcon },
  { href: "/progress", label: "График", icon: ChartIcon },
  { href: "/advice", label: "Советы", icon: AdviceIcon },
  { href: "/profile", label: "Профиль", icon: ProfileIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  // Hostname rewrite keeps an internal `/healthy-life` prefix in the App Router path.
  const path = pathname.replace(/^\/healthy-life(?=\/|$)/, "") || "/";

  if (path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/auth")) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-2">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? path === "/"
              : path.startsWith(item.href) ||
                (item.href === "/progress" && path.startsWith("/weight"));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-medium transition",
                  active ? "text-[var(--accent)]" : "text-[var(--muted)]",
                )}
              >
                <item.icon active={active} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DayIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MealIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5c0-2.5 2.5-4.5 8-4.5s8 2 8 4.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <path d="M8 8.5V6.5M12 8V5.5M16 8.5V6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19h16M7 16V9M12 16V5M17 16v-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={0}
      />
      {active ? (
        <path d="M7 16V9h0M12 16V5h0M17 16v-4h0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      ) : null}
    </svg>
  );
}

function AdviceIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 18.5 4.5 21V7.5A2.5 2.5 0 0 1 7 5h10a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 17 18H7.8"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <path d="M9 9.5h6M9 13h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="9"
        r="3.2"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.15 : 0}
      />
      <path
        d="M5.5 19.2c1.6-3 4-4.5 6.5-4.5s4.9 1.5 6.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
