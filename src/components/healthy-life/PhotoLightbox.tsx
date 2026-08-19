"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/healthy-life/i18n";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const STEP = 0.25;

function clampScale(n: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, +n.toFixed(3)));
}

function touchDistance(a: Touch, b: Touch) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

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
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const scaleRef = useRef(1);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    pinchRef.current = null;
    dragRef.current = null;
  }, []);

  useEffect(() => {
    if (open) resetView();
  }, [open, src, resetView]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setScale((s) => clampScale(s + STEP));
      if (e.key === "-" || e.key === "_") {
        setScale((s) => {
          const next = clampScale(s - STEP);
          if (next <= 1) setOffset({ x: 0, y: 0 });
          return next;
        });
      }
    }
    const scrollY = window.scrollY;
    const prevPos = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.position = prevPos;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      window.scrollTo(0, scrollY);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const el = stageRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setScale((s) => clampScale(s + STEP));
      } else {
        setScale((s) => {
          const next = clampScale(s - STEP);
          if (next <= 1) setOffset({ x: 0, y: 0 });
          return next;
        });
      }
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        dragRef.current = null;
        setDragging(false);
        pinchRef.current = {
          dist: touchDistance(e.touches[0], e.touches[1]),
          scale: scaleRef.current,
        };
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dist = touchDistance(e.touches[0], e.touches[1]);
        if (pinchRef.current.dist <= 0) return;
        const next = clampScale(pinchRef.current.scale * (dist / pinchRef.current.dist));
        setScale(next);
        if (next <= 1) setOffset({ x: 0, y: 0 });
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        pinchRef.current = null;
      }
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [open, src]);

  if (!open || !src) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks -- guard above
  const portal = typeof document !== "undefined";

  function zoomIn() {
    setScale((s) => clampScale(s + STEP));
  }

  function zoomOut() {
    setScale((s) => {
      const next = clampScale(s - STEP);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (pinchRef.current || scale <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (pinchRef.current) return;
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

  const pct = Math.round(scale * 100);

  const lightbox = (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/85"
      role="dialog"
      aria-modal="true"
      aria-label={alt || t("photo.viewer")}
      onClick={onClose}
    >
      <div
        className="relative z-20 flex shrink-0 items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 rounded-2xl bg-black/55 p-1.5 backdrop-blur-sm">
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
            {pct}%
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
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-xl text-white backdrop-blur-sm touch-manipulation"
          aria-label={t("close")}
          title={t("close")}
        >
          ✕
        </button>
      </div>

      <div
        ref={stageRef}
        className="relative flex min-h-0 flex-1 items-start justify-center overflow-hidden px-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="mt-2 max-h-[min(78dvh,100%)] max-w-[min(96vw,100%)] origin-top select-none object-contain touch-none"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "default",
            transition: dragging || pinchRef.current ? undefined : "transform 120ms ease-out",
          }}
        />
      </div>
    </div>
  );

  return portal ? createPortal(lightbox, document.body) : lightbox;
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
