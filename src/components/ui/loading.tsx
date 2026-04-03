import type { ReactNode } from "react";

/** Круговой индикатор (спиннер) */
export function CircularProgress({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim =
    size === "sm"
      ? "h-5 w-5 border-2"
      : size === "lg"
        ? "h-11 w-11 border-[3px]"
        : "h-8 w-8 border-2";
  return (
    <div
      className={`shrink-0 rounded-full border-slate-200 border-t-teal-600 animate-spin ${dim} ${className}`}
      role="status"
      aria-busy="true"
      aria-live="polite"
    />
  );
}

/** Центрированный спиннер при подгрузке списка / данных */
export function ListLoading({
  label,
  className = "",
}: {
  label?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-10 text-sm text-slate-600 ${className}`}
    >
      <CircularProgress size="md" />
      {label ? <span className="max-w-xs text-center">{label}</span> : null}
    </div>
  );
}
