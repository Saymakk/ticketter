import { redirect } from "next/navigation";

/** Общая панель — /admin; разделы суперадмина открываются оттуда (например /super-admin/admins). */
export default function SuperAdminIndexPage() {
  redirect("/admin");
}
