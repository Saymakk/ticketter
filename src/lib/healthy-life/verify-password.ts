import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { phoneAuthEmailCandidates } from "@/lib/auth/phone";
import { getHealthyLifeSupabaseAnonKey, getHealthyLifeSupabaseUrl } from "@/lib/healthy-life/config";

let anonClient: SupabaseClient | null = null;

function getAnonClient() {
  if (!anonClient) {
    anonClient = createClient(getHealthyLifeSupabaseUrl(), getHealthyLifeSupabaseAnonKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return anonClient;
}

/** Verify password without affecting the caller's session. */
export async function verifyAuthPassword(
  userId: string,
  email: string | undefined,
  phone: string | null | undefined,
  password: string,
): Promise<boolean> {
  const client = getAnonClient();
  const emails = new Set<string>();
  if (email) emails.add(email);
  if (phone) {
    for (const candidate of phoneAuthEmailCandidates(phone)) emails.add(candidate);
  }
  for (const candidate of emails) {
    const { data, error } = await client.auth.signInWithPassword({ email: candidate, password });
    if (!error && data.user?.id === userId) return true;
  }
  return false;
}
