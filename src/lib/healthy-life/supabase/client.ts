import { createBrowserClient } from "@supabase/ssr";
import { getHealthyLifeSupabaseAnonKey, getHealthyLifeSupabaseUrl } from "@/lib/healthy-life/config";

export function createClient() {
  return createBrowserClient(getHealthyLifeSupabaseUrl(), getHealthyLifeSupabaseAnonKey());
}
