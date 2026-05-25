import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type ProfileAuthRow = {
  role: string;
  full_name?: string | null;
  phone?: string | null;
  company_id?: string | null;
  can_edit_tickets?: boolean | null;
  locale?: string | null;
  managed_password?: string | null;
};

export async function loadProfileByUserId(
  userId: string,
  columns = "role"
): Promise<{ profile: ProfileAuthRow | null; error: string | null }> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("profiles")
    .select(columns)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { profile: null, error: error.message };
  }

  return { profile: (data as ProfileAuthRow | null) ?? null, error: null };
}
