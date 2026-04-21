"use client";

import { useState } from "react";

type Props = {
  src: string | null | undefined;
  alt?: string;
  placeholderText?: string;
  className?: string;
};

export function TicketReceiptPreview({
  src,
  alt = "Чек",
  placeholderText = "Здесь мог бы быть ваш билет",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const hasImage = Boolean(src?.trim());

  return (
    <>
      {hasImage ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`group overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}
          title="Открыть чек"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src!}
            alt={alt}
            className="h-24 w-24 object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        </button>
      ) : (
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 text-center text-[11px] leading-tight text-slate-500 ${className}`}
        >
          {placeholderText}
        </div>
      )}
      {open && hasImage ? (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="max-h-[90vh] max-w-[95vw] overflow-auto" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src!} alt={alt} className="h-auto max-w-[95vw] rounded-lg bg-white" />
          </div>
        </div>
      ) : null}
    </>
  );
}
