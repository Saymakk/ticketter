import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth/api-guards";
import { loadProfileByUserId } from "@/lib/auth/load-profile";
import { isEventManagerRole } from "@/lib/auth/roles";

export async function GET() {
  const auth = await getAuthedProfile();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const role = auth.ctx.profile.role;

  let canEditTickets = true;
  if (!isEventManagerRole(role)) {
    const { profile: row } = await loadProfileByUserId(
      auth.ctx.user.id,
      "can_edit_tickets"
    );
    canEditTickets = row?.can_edit_tickets !== false;
  }

  return NextResponse.json({
    role,
    userId: auth.ctx.user.id,
    canEditTickets,
  });
}
