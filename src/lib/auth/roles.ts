/** Роли приложения: пользователь → админ → суперадмин */

export type AppRole = "user" | "admin" | "super_admin";

export function isStaffRole(role: string | null | undefined): role is AppRole {
  return role === "user" || role === "admin" || role === "super_admin";
}

/** Доступ к мероприятиям (все), пользователям, назначениям */
export function isEventManagerRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === "super_admin";
}
