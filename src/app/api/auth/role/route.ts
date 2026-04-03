import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth/api-guards";

export async function GET() {
  const auth = await getAuthedProfile();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  return NextResponse.json({
    role: auth.ctx.profile.role,
    userId: auth.ctx.user.id,
  });
}
