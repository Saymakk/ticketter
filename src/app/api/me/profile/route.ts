import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth/api-guards";
import { loadProfileByUserId } from "@/lib/auth/load-profile";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await getAuthedProfile();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { profile, error } = await loadProfileByUserId(
    auth.ctx.user.id,
    "full_name,phone,company_id"
  );
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Профиль не найден" }, { status: 403 });
  }

  let companyName: string | null = null;
  let companyImageUrl: string | null = null;
  if (profile.company_id) {
    const admin = createAdminSupabaseClient();
    const { data: company } = await admin
      .from("companies")
      .select("name,image_url")
      .eq("id", profile.company_id)
      .maybeSingle();
    companyName = company?.name ?? null;
    companyImageUrl = company?.image_url ?? null;
  }

  const {
    data: { user },
  } = await auth.ctx.supabase.auth.getUser();

  return NextResponse.json({
    email: user?.email ?? null,
    fullName: profile.full_name ?? null,
    phone: profile.phone ?? null,
    companyId: profile.company_id ?? null,
    companyName,
    companyImageUrl,
  });
}
