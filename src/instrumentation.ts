/**
 * In-process reminder ticker so Web Push / Telegram cron runs even without
 * an external scheduler. Deduped via PushReminderSent unique keys.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const g = globalThis as typeof globalThis & { __hlReminderLoop?: boolean };
  if (g.__hlReminderLoop) return;
  g.__hlReminderLoop = true;

  const { runHealthyLifeReminders } = await import("@/lib/healthy-life/reminders");
  const tick = () => {
    runHealthyLifeReminders().catch((error) => {
      console.error("healthy-life reminder tick failed", error);
    });
  };

  setTimeout(tick, 20_000);
  setInterval(tick, 30_000);
}
