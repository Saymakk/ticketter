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
  variant?: "primary" | "secondary" | "ghost" | "danger" | "med" | "med-secondary";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 touch-manipulation",
        variant === "primary" && "bg-[var(--accent)] text-white shadow-[0_12px_28px_-16px_var(--accent)]",
        variant === "secondary" && "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
        variant === "ghost" && "bg-transparent text-[var(--ink)]",
        variant === "danger" && "bg-[#f3d9d4] text-[#8a3b2f]",
        variant === "med" && "bg-[var(--med-accent)] text-white shadow-[0_12px_28px_-16px_var(--med-accent)]",
        variant === "med-secondary" && "bg-[var(--med-soft)] text-[var(--med-accent-ink)]",
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

export const medInputClass =
  "w-full rounded-2xl border border-[var(--med-line)] bg-[var(--med-surface)] px-3 py-3 text-base text-[var(--ink)] outline-none transition focus:border-[var(--med-accent)]";

export function Modal({
  open,
  onClose,
  title,
  children,
  tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  tone?: "default" | "med";
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border shadow-2xl animate-rise sm:rounded-[1.75rem]",
          tone === "med"
            ? "border-[var(--med-line)] bg-[var(--med-surface)]"
            : "border-[var(--line)] bg-[var(--surface)]",
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-transparent px-4 pt-4 pb-3">
          <h2
            className={cn(
              "font-display text-2xl leading-tight",
              tone === "med" ? "text-[var(--med-accent-ink)]" : "text-[var(--ink)]",
            )}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-2 py-1 text-sm text-[var(--muted)]"
          >
            ✕
          </button>
        </div>
        <div
          className={cn(
            "hl-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
            tone === "med" && "hl-modal-scroll--med",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
