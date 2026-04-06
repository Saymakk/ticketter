"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  beginTrackedOperation,
  endTrackedOperation,
} from "@/lib/http/tracked-fetch";

const IDLE_MS = 30 * 60 * 1000;

export default function IdleTracker() {
    useEffect(() => {
        const supabase = createClient();

        const markActivity = () => {
            const now = Date.now();
            localStorage.setItem("last_activity_at", String(now));
            document.cookie = `last_activity_at=${now}; Path=/; Max-Age=2592000; SameSite=Lax`;
        };

        markActivity();

        const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
        events.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));

        const timer = setInterval(async () => {
            const raw = localStorage.getItem("last_activity_at");
            const last = raw ? Number(raw) : 0;
            if (!last) return;

            if (Date.now() - last > IDLE_MS) {
                beginTrackedOperation();
                try {
                    await supabase.auth.signOut();
                    window.location.href = "/login?reason=idle";
                } finally {
                    endTrackedOperation();
                }
            }
        }, 60_000);

        return () => {
            clearInterval(timer);
            events.forEach((ev) => window.removeEventListener(ev, markActivity));
        };
    }, []);

    return null;
}