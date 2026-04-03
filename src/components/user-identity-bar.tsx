"use client";

import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";

type Props = {
  className?: string;
  /** When false, skip fetching (e.g. parent already decided not to render). */
  enabled?: boolean;
};

export default function UserIdentityBar({ className = "", enabled = true }: Props) {
  const { email, fullName, phone, loading } = useCurrentUserProfile(enabled);

  if (!enabled) return null;

  if (loading) {
    return (
      <div className={`min-w-0 ${className}`} aria-hidden>
        <div className="h-4 max-w-[14rem] animate-pulse rounded bg-slate-200" />
        <div className="mt-1 h-3 max-w-[18rem] animate-pulse rounded bg-slate-100" />
      </div>
    );
  }

  const name = fullName?.trim() || "—";
  const phoneLine = phone?.trim() || "—";

  return (
    <div className={`min-w-0 text-xs text-slate-600 sm:text-sm ${className}`}>
      <div className="truncate font-medium text-slate-800">{name}</div>
      <div className="truncate">
        <span>{phoneLine}</span>
        <span className="mx-1.5 text-slate-300" aria-hidden>
          ·
        </span>
        <span className="text-slate-500">{email ?? "—"}</span>
      </div>
    </div>
  );
}
