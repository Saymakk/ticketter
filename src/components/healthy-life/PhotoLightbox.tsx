"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/healthy-life/i18n";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const STEP = 0.25;

export function PhotoLightbox({
  src,
  alt = "",
  open,
  onClose,
}: {
  src: string | null;
  alt?: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (open) resetView();
  }, [open, src, resetView]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(MAX_SCALE, s + STEP));
      if (e.key === "-" || e.key === "_") setScale((s) => Math.max(MIN_SCALE, s - STEP));
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const el = imgRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setScale((s) => Math.min(MAX_SCALE, +(s + STEP).toFixed(2)));
      } else {
        setScale((s) => {
          const next = Math.max(MIN_SCALE, +(s - STEP).toFixed(2));
          if (next <= 1) setOffset({ x: 0, y: 0 });
          return next;
        });
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, src]);

  if (!open || !src) return null;

  function zoomIn() {
    setScale((s) => Math.min(MAX_SCALE, +(s + STEP).toFixed(2)));
  }

  function zoomOut() {
    setScale((s) => {
      const next = Math.max(MIN_SCALE, +(s - STEP).toFixed(2));
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (scale <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setOffset({
      x: d.ox + (e.clientX - d.x),
      y: d.oy + (e.clientY - d.y),
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85"
      role="dialog"
      aria-modal="true"
      aria-label={alt || t("photo.viewer")}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-xl text-white backdrop-blur-sm touch-manipulation"
        aria-label={t("close")}
        title={t("close")}
      >
        ✕
      </button>

      <div
        className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-black/55 p-1.5 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={zoomOut}
          disabled={scale <= MIN_SCALE}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl font-semibold text-white disabled:opacity-40 touch-manipulation"
          aria-label={t("photo.zoomOut")}
          title={t("photo.zoomOut")}
        >
          −
        </button>
        <span className="min-w-14 text-center text-sm font-semibold text-white tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          disabled={scale >= MAX_SCALE}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl font-semibold text-white disabled:opacity-40 touch-manipulation"
          aria-label={t("photo.zoomIn")}
          title={t("photo.zoomIn")}
        >
          +
        </button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="max-h-[min(92dvh,100%)] max-w-[min(96vw,100%)] select-none object-contain touch-none"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "default",
          transition: dragging ? undefined : "transform 120ms ease-out",
        }}
      />
    </div>
  );
}

/** Thumbnail that opens PhotoLightbox on tap. */
export function OpenablePhoto({
  src,
  alt = "",
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();

  return (
    <>
      <button
        type="button"
        className="block w-full overflow-hidden rounded-2xl p-0 text-left touch-manipulation"
        onClick={() => setOpen(true)}
        aria-label={t("photo.open")}
        title={t("photo.open")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
      </button>
      <PhotoLightbox src={src} alt={alt} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
