import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getHealthyLifeMealPhotosBucket,
  getHealthyLifeSupabaseServerKey,
  getHealthyLifeSupabaseUrl,
} from "@/lib/healthy-life/config";

let adminClient: SupabaseClient | null = null;

/** Server-only client (Storage uploads) for the Healthy Life Supabase project. */
export function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  adminClient = createClient(getHealthyLifeSupabaseUrl(), getHealthyLifeSupabaseServerKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}

export function getMealPhotosBucket() {
  return getHealthyLifeMealPhotosBucket();
}
