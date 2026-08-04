import { redirect } from "next/navigation";

export default function SuperAdminEventsRedirectPage() {
  redirect("/admin/manage/events");
}
