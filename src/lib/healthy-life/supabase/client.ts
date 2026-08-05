import { createBrowserClient } from "@supabase/ssr";
import { getHealthyLifeSupabaseAnonKey, getHealthyLifeSupabaseUrl } from "@/lib/healthy-life/config";
import {
  HL_REMEMBER_MAX_AGE,
  HL_SESSION_MAX_AGE,
  readRememberMePreference,
} from "@/lib/healthy-life/auth-prefs";

export function createClient(options?: { rememberMe?: boolean }) {
  const rememberMe = options?.rememberMe ?? readRememberMePreference();

  return createBrowserClient(getHealthyLifeSupabaseUrl(), getHealthyLifeSupabaseAnonKey(), {
    // Prefer a fresh client when cookie lifetime changes with "remember me".
    isSingleton: false,
    cookieOptions: {
      maxAge: rememberMe ? HL_REMEMBER_MAX_AGE : HL_SESSION_MAX_AGE,
      path: "/",
      sameSite: "lax",
    },
  });
}
