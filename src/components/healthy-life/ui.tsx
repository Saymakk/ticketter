import { cn } from "@/lib/healthy-life/format";

export function Shell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto min-h-dvh w-full max-w-lg px-4 pb-28 pt-6", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-3">
      <div>
        <p className="brand-mark mb-1 text-sm tracking-[0.18em] text-[var(--accent)] uppercase">
          Healthy Life
        </p>
        <h1 className="font-display text-3xl leading-tight text-[var(--ink)]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_10px_40px_-28px_rgba(28,55,42,0.45)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 touch-manipulation",
        variant === "primary" && "bg-[var(--accent)] text-white shadow-[0_12px_28px_-16px_var(--accent)]",
        variant === "secondary" && "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
        variant === "ghost" && "bg-transparent text-[var(--ink)]",
        variant === "danger" && "bg-[#f3d9d4] text-[#8a3b2f]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-3 text-base text-[var(--ink)] outline-none transition focus:border-[var(--accent)]";
