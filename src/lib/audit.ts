import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AuditPayload = {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  path?: string | null;
  method?: string | null;
  metadata?: Record<string, unknown> | null;
  request?: Request | null;
};

/**
 * Запись в журнал аудита (через service role). Ошибки логирования не ломают основной ответ API.
 */
export async function writeAuditLog(payload: AuditPayload): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();
    const headers = payload.request?.headers;
    const xf = headers?.get("x-forwarded-for");
    const ip =
      (xf ? xf.split(",")[0]?.trim() : null) ??
      headers?.get("x-real-ip") ??
      null;
    const userAgent = headers?.get("user-agent") ?? null;
    let path = payload.path ?? null;
    if (!path && payload.request?.url) {
      try {
        path = new URL(payload.request.url).pathname;
      } catch {
        path = null;
      }
    }

    await admin.from("audit_logs").insert({
      actor_id: payload.actorId,
      action: payload.action,
      resource_type: payload.resourceType,
      resource_id: payload.resourceId ?? null,
      path,
      method: payload.method ?? null,
      metadata: payload.metadata ?? null,
      ip,
      user_agent: userAgent,
    });
  } catch {
    /* не блокируем основной сценарий */
  }
}
