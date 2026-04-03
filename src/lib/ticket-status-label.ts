/** Локализованная подпись статуса билета (значения из БД: new, checked_in). */
export function ticketStatusLabel(
  status: string,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  switch (status) {
    case "new":
      return t("admin.tickets.statusNew");
    case "checked_in":
      return t("admin.tickets.statusCheckedIn");
    default:
      return status;
  }
}
