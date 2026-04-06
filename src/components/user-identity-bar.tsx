"use client";

import { CircularProgress } from "@/components/ui/loading";
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
      <div
        className={`flex min-w-0 items-center gap-2 ${className}`}
        aria-hidden
      >
        <CircularProgress size="sm" />
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
