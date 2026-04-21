/** Сообщение для API при блокировке после даты мероприятия */
export const EVENT_ENDED_MESSAGE =
  "Мероприятие завершено: нельзя создавать билеты и изменять поля билета";

/** Редактирование карточки мероприятия после даты */
export const EVENT_MANAGEMENT_LOCKED_MESSAGE =
  "Мероприятие завершено: редактирование недоступно";

/** Назначение / смена доступа к завершённому мероприятию */
export const EVENT_ASSIGNMENTS_LOCKED_MESSAGE =
  "Мероприятие завершено: нельзя назначать или менять доступ";

/** Изменение / удаление билетов завершённого мероприятия */
export const EVENT_TICKETS_LOCKED_MESSAGE =
  "Мероприятие завершено: нельзя изменять или удалять билеты";

/** Сканер: пробивка и действие билета после даты мероприятия */
export const SCAN_EVENT_ENDED_TICKET_INVALID =
  "Мероприятие завершено. Билет недействителен.";

/**
 * Дата мероприятия в прошлом (строго раньше сегодняшнего календарного дня UTC).
 * Сравнение строк YYYY-MM-DD совпадает с логикой сканера (api/scanner/events).
 */
export function isEventPastByDateString(eventDate: string | null | undefined): boolean {
  if (!eventDate || typeof eventDate !== "string" || eventDate.length < 10) return false;
  const d = eventDate.slice(0, 10);
  const todayUtc = new Date().toISOString().slice(0, 10);
  return d < todayUtc;
}

/** Дата и опциональное время (HH:MM) в одной строке */
export function formatEventDateTimeLine(
  eventDate: string | null | undefined,
  eventTime: string | null | undefined
): string {
  const d = eventDate?.slice(0, 10) ?? "";
  const t = eventTime?.trim();
  if (!t) return d;
  return d ? `${d} ${t}` : t;
}

export function isValidOptionalEventTime(s: string | null | undefined): boolean {
  if (s == null || s === "") return true;
  return /^\d{2}:\d{2}$/.test(s.trim());
}

function addDaysUtc(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function defaultTicketValidUntilDate(eventDate: string | null | undefined): string | null {
  const d = eventDate?.slice(0, 10);
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return addDaysUtc(d, 1);
}

export function isTicketValidUntilAllowed(
  eventDate: string | null | undefined,
  ticketValidUntil: string | null | undefined
): boolean {
  const ev = eventDate?.slice(0, 10);
  const vu = ticketValidUntil?.slice(0, 10);
  if (!ev || !vu) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ev) || !/^\d{4}-\d{2}-\d{2}$/.test(vu)) return false;
  return vu > ev;
}

export function isTicketExpiredByDateString(
  ticketValidUntil: string | null | undefined
): boolean {
  const d = ticketValidUntil?.slice(0, 10);
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const todayUtc = new Date().toISOString().slice(0, 10);
  return d < todayUtc;
}

/**
 * Unix-время (сек), до которого действует публичная ссылка на PNG QR:
 * конец календарного дня UTC на «день после даты мероприятия» (включительно).
 * Согласовано со сравнением дат как строк YYYY-MM-DD в UTC.
 * Если дата не задана или некорректна — запасной срок 7 суток от текущего момента.
 */
export function qrPublicLinkExpiryUnixUtc(eventDate: string | null | undefined): number {
  const d = eventDate?.slice(0, 10);
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  }
  const [y, mo, da] = d.split("-").map(Number);
  const expMs = Date.UTC(y, mo - 1, da + 1, 23, 59, 59, 999);
  return Math.floor(expMs / 1000);
}
