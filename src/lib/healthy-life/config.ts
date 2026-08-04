/** Healthy Life uses its own Supabase project + Prisma DB, isolated from Ticketter's. */

export function getHealthyLifeSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_URL не задан");
  return url;
}

export function getHealthyLifeSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_ANON_KEY не задан");
  return key;
}

/** Server-only key (Storage uploads). Prefer new secret key, fallback to legacy service_role JWT. */
export function getHealthyLifeSupabaseServerKey(): string {
  const key =
    process.env.HEALTHY_LIFE_SUPABASE_SECRET_KEY ||
    process.env.HEALTHY_LIFE_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Задайте HEALTHY_LIFE_SUPABASE_SECRET_KEY (или HEALTHY_LIFE_SUPABASE_SERVICE_ROLE_KEY) в .env"
    );
  }
  return key;
}

export function getHealthyLifeMealPhotosBucket(): string {
  return process.env.HEALTHY_LIFE_SUPABASE_MEAL_PHOTOS_BUCKET || "meal-photos";
}

export function getHealthyLifeOpenAiKey(): string | undefined {
  return process.env.HEALTHY_LIFE_OPENAI_API_KEY;
}

export function getHealthyLifeOpenAiModel(): string {
  return process.env.HEALTHY_LIFE_OPENAI_MODEL || "gpt-4o-mini";
}
