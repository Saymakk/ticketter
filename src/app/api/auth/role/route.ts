import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth/api-guards";
import { isEventManagerRole } from "@/lib/auth/roles";

export async function GET() {
  const auth = await getAuthedProfile();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const role = auth.ctx.profile.role;

  let canEditTickets = true;
  if (!isEventManagerRole(role)) {
    const { data: row, error } = await auth.ctx.supabase
      .from("profiles")
      .select("can_edit_tickets")
      .eq("id", auth.ctx.user.id)
      .maybeSingle();
    if (error) {
      canEditTickets = true;
    } else {
      canEditTickets = row?.can_edit_tickets !== false;
    }
  }

  return NextResponse.json({
    role,
    userId: auth.ctx.user.id,
    canEditTickets,
  });
}
