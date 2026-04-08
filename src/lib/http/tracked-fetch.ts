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
 * Обёртка над fetch.
 * По умолчанию глобальный спиннер включается только для не-GET/HEAD запросов.
 * Для чтения данных можно явно включить/выключить через trackGlobalLoading.
 */
export async function trackedFetch(
  input: RequestInfo | URL,
  init?: (RequestInit & { trackGlobalLoading?: boolean })
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const defaultTrack = method !== "GET" && method !== "HEAD";
  const shouldTrack = init?.trackGlobalLoading ?? defaultTrack;
  if (shouldTrack) {
    inFlight += 1;
    emit();
  }
  const requestInit: RequestInit | undefined = init
    ? (({ trackGlobalLoading, ...rest }) => rest)(init)
    : undefined;
  try {
    return await nativeFetch(input, requestInit);
  } finally {
    if (shouldTrack) {
      inFlight -= 1;
      emit();
    }
  }
}
