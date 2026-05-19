"use client";

import { useEffect, useRef, useState } from "react";
import { downloadPdfReceipt, isPdfReceiptUrl } from "@/lib/tickets/receipt-url";

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
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const url = src?.trim() ?? "";
  const hasReceipt = Boolean(url);
  const isPdf = isPdfReceiptUrl(url);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function onReceiptClick() {
    if (isPdf) {
      if (pdfDownloading) return;
      setPdfDownloading(true);
      try {
        await downloadPdfReceipt(url);
      } finally {
        setPdfDownloading(false);
      }
      return;
    }
    setOpen(true);
  }

  return (
    <>
      {hasReceipt ? (
        <button
          type="button"
          onClick={() => void onReceiptClick()}
          disabled={isPdf && pdfDownloading}
          className={`group overflow-hidden rounded-lg border border-slate-200 bg-white disabled:opacity-60 ${className}`}
          title={isPdf ? "Скачать чек (PDF)" : "Открыть чек"}
        >
          <span className="flex h-24 w-24 items-center justify-center bg-slate-50 p-1">
            {isPdf ? (
              <span className="flex h-full w-full flex-col items-center justify-center gap-1 rounded bg-red-50 text-red-700">
                <span className="text-[10px] font-bold uppercase tracking-wide">PDF</span>
                <span className="px-1 text-center text-[10px] leading-tight">
                  {pdfDownloading ? "…" : "Скачать"}
                </span>
              </span>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={url}
                alt={alt}
                className="h-full w-full object-contain transition group-hover:scale-105"
                loading="lazy"
              />
            )}
          </span>
        </button>
      ) : (
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 text-center text-[11px] leading-tight text-slate-500 ${className}`}
        >
          {placeholderText}
        </div>
      )}
      {open && hasReceipt && !isPdf ? (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[92vh] max-w-[96vw] overflow-auto rounded-lg bg-white p-2 shadow-lg sm:max-w-4xl"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              touchStartY.current = e.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={(e) => {
              const start = touchStartY.current;
              const end = e.changedTouches[0]?.clientY ?? null;
              touchStartY.current = null;
              if (start == null || end == null) return;
              if (Math.abs(end - start) >= 90) setOpen(false);
            }}
            style={{ touchAction: "pinch-zoom pan-x pan-y" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={alt}
              className="mx-auto h-auto w-auto max-h-full max-w-full rounded bg-white"
              style={{ touchAction: "pinch-zoom" }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
