import type { ReactNode } from "react";
import Link from "next/link";

export { CircularProgress, ListLoading } from "./loading";

/** Фон страницы: мягкий градиент */
export function AppShell({
  children,
  className = "",
  maxWidth = "max-w-3xl",
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}) {
  return (
    <div
      className={`min-h-full bg-gradient-to-br from-slate-100 via-white to-teal-50/40 ${className}`}
    >
      <div className={`mx-auto px-4 py-8 sm:px-6 lg:py-10 ${maxWidth}`}>
        {children}
      </div>
    </div>
  );
}

/** Центрированный экран (логин) */
export function AppShellCenter({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-100 via-white to-teal-50/50 px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

/** Белая карточка с тенью */
export function AppCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6 ${className}`}
    >
      {(title || subtitle) && (
        <header className="mb-5 border-b border-slate-100 pb-4">
          {title && (
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{subtitle}</p>
          )}
        </header>
      )}
      {children}
    </div>
  );
}

/** Секция внутри страницы */
export function AppSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-teal-800/90">
        {title}
      </h2>
      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 sm:p-4">
        {children}
      </div>
    </section>
  );
}

export const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

export const labelClass = "block text-sm font-medium text-slate-700";

export const selectClass = inputClass;

export const btnPrimary =
  "inline-flex shrink-0 items-center justify-center rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondary =
  "inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50";

export const btnDanger =
  "inline-flex shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200";

export const linkClass =
  "font-medium text-teal-700 underline decoration-teal-700/30 underline-offset-2 transition hover:text-teal-800 hover:decoration-teal-800";

/** Плитка-ссылка на главных панелях (админ / суперадмин) */
export const panelNavTileClass =
  "block rounded-lg border border-slate-100 bg-slate-50/80 p-4 no-underline transition hover:border-teal-200 hover:bg-teal-50/50";

/**
 * Колонка формы: ограниченная ширина, кнопки по ширине контента (не на всю строку).
 * fullWidth — на всю ширину карточки (редко).
 */
export function FormStack({
  children,
  className = "",
  fullWidth = false,
}: {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3.5 [&_button]:self-start ${fullWidth ? "w-full" : "w-full max-w-md"} ${className}`}
    >
      {children}
    </div>
  );
}

/** Явная ссылка на родительский экран (предпочтительнее history.back). */
export function BackNav({
  href,
  children = "Назад",
}: {
  href: string;
  children?: ReactNode;
}) {
  return (
    <nav className="mb-5">
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      >
        <span aria-hidden>←</span>
        {children}
      </Link>
    </nav>
  );
}

/** Заголовок экрана в одной строке с BackNav (единый стиль с экраном «Мероприятия»). */
export function PageHeaderWithBack({
  backHref,
  backLabel,
  title,
  description,
}: {
  backHref: string;
  backLabel: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-2 border-b border-slate-100 pb-5 [&_nav]:mb-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <BackNav href={backHref}>{backLabel}</BackNav>
        <h1 className="min-w-0 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h1>
      </div>
      {description != null ? (
        <div className="text-sm leading-relaxed text-slate-600">{description}</div>
      ) : null}
    </header>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap gap-2">{children}</div>;
}
