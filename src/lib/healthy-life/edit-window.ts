/** Entries (meals / medication intakes) can be edited only within this window after create. */
export const EDIT_WINDOW_MS = 60 * 60 * 1000;

export function isWithinEditWindow(createdAt: string | Date, now = Date.now()): boolean {
  const t = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t < EDIT_WINDOW_MS;
}

export function editWindowRemainingMs(createdAt: string | Date, now = Date.now()): number {
  const t = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  return Math.max(0, EDIT_WINDOW_MS - (now - t));
}
