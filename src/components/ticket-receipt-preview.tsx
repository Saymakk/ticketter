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
          <span className="flex h-24 w-24 items-center justify-center bg-slate-50 p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src!}
            alt={alt}
            className="h-full w-full object-contain transition group-hover:scale-105"
            loading="lazy"
          />
          </span>
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
          <div
            className="h-[92vh] w-[96vw] max-w-3xl overflow-auto rounded-lg bg-black/30 p-2 sm:h-auto sm:w-auto sm:max-h-[90vh] sm:max-w-[95vw]"
            style={{ touchAction: "pinch-zoom pan-x pan-y" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src!}
              alt={alt}
              className="mx-auto h-auto w-auto max-h-full max-w-full rounded-lg bg-white"
              style={{ touchAction: "pinch-zoom" }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
