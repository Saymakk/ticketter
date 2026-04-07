/** Открытие сканера из панели — показываем «К панели». Прямой заход / логин — без параметра. */
export const SCANNER_FROM_PANEL_PARAM = "from";
export const SCANNER_FROM_PANEL_VALUE = "panel";

export function isScannerFromPanelParam(value: string | null | undefined): boolean {
  return value === SCANNER_FROM_PANEL_VALUE;
}

export function scannerListHref(fromPanel: boolean): string {
  return fromPanel
    ? `/scanner?${SCANNER_FROM_PANEL_PARAM}=${SCANNER_FROM_PANEL_VALUE}`
    : "/scanner";
}

/** Открывает модалку билета на `/scanner` (без ухода со страницы — сохраняется вкладка и выбор мероприятия). */
export function scannerConfirmHref(eventId: string, uuid: string, fromPanel: boolean): string {
  const q = new URLSearchParams({
    eventId,
    uuid,
  });
  if (fromPanel) q.set(SCANNER_FROM_PANEL_PARAM, SCANNER_FROM_PANEL_VALUE);
  return `/scanner?${q.toString()}`;
}
