const nativeFetch = globalThis.fetch.bind(globalThis);

let inFlight = 0;
/** Операции без fetch (Supabase и т.д.), для которых нужен тот же глобальный спиннер */
let manualDepth = 0;

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Подписка для useSyncExternalStore / оверлея загрузки */
export function subscribeTrackedFetch(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function getGlobalRequestLoadingActive(): boolean {
  return inFlight > 0 || manualDepth > 0;
}

/** Начать «тяжёлую» операцию (показать глобальный спиннер). Парный вызов endTrackedOperation в finally. */
export function beginTrackedOperation(): void {
  manualDepth += 1;
  emit();
}

export function endTrackedOperation(): void {
  manualDepth = Math.max(0, manualDepth - 1);
  emit();
}

/**
 * Обёртка над fetch: увеличивает счётчик активных запросов (глобальный спиннер).
 * Использовать в клиентских компонентах вместо fetch для запросов к API.
 */
export async function trackedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  inFlight += 1;
  emit();
  try {
    return await nativeFetch(input, init);
  } finally {
    inFlight -= 1;
    emit();
  }
}
