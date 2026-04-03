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
