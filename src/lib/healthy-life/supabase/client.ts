import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHealthyLifeSupabaseAnonKey, getHealthyLifeSupabaseUrl } from "@/lib/healthy-life/config";
import {
  HL_REMEMBER_MAX_AGE,
  HL_SESSION_MAX_AGE,
  readRememberMePreference,
  writeRememberMePreference,
} from "@/lib/healthy-life/auth-prefs";

/** App-managed singleton — avoids Multiple GoTrueClient warnings from isSingleton:false. */
let browserClient: SupabaseClient | null = null;

function buildClient(rememberMe: boolean): SupabaseClient {
  return createBrowserClient(getHealthyLifeSupabaseUrl(), getHealthyLifeSupabaseAnonKey(), {
    // We own the singleton below; disable the library cache so resetAuthClient can replace it.
    isSingleton: false,
    cookieOptions: {
      maxAge: rememberMe ? HL_REMEMBER_MAX_AGE : HL_SESSION_MAX_AGE,
      path: "/",
      sameSite: "lax",
    },
  });
}

/** Shared browser client for Healthy Life (one instance per tab). */
export function createClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = buildClient(readRememberMePreference());
  }
  return browserClient;
}

/**
 * Recreate the singleton right before sign-in / sign-up so cookie maxAge
 * matches the current "remember me" choice.
 */
export function resetAuthClient(rememberMe: boolean): SupabaseClient {
  writeRememberMePreference(rememberMe);
  browserClient = buildClient(rememberMe);
  return browserClient;
}
