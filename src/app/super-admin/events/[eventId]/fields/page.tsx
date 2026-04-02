import { redirect } from "next/navigation";

type Props = { params: Promise<{ eventId: string }> };

export default async function SuperAdminEventFieldsRedirect({ params }: Props) {
  const { eventId } = await params;
  redirect(`/admin/manage/events/${eventId}/fields`);
}
