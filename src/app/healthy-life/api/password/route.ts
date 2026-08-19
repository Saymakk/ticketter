import { NextResponse } from "next/server";
import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { jsonError } from "@/lib/healthy-life/api-error";
import { getOrCreateProfile, requireUser } from "@/lib/healthy-life/prisma";
import { getSupabaseAdmin } from "@/lib/healthy-life/supabase-admin";
import { verifyAuthPassword } from "@/lib/healthy-life/verify-password";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH),
  confirmPassword: z.string().min(MIN_PASSWORD_LENGTH),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await request.json());

    if (body.newPassword !== body.confirmPassword) {
      return NextResponse.json({ error: "PASSWORDS_MISMATCH" }, { status: 400 });
    }

    const profile = await getOrCreateProfile();
    const ok = await verifyAuthPassword(user.id, user.email, profile.phone, body.currentPassword);
    if (!ok) {
      return NextResponse.json({ error: "WRONG_PASSWORD" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: body.newPassword });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "PASSWORD_TOO_SHORT" }, { status: 400 });
    }
    return jsonError(error);
  }
}
