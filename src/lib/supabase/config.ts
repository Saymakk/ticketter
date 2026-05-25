type SupabaseProvider = "cloud" | "local";

function getProvider(): SupabaseProvider {
  const raw = process.env.SUPABASE_PROVIDER?.toLowerCase();
  return raw === "local" ? "local" : "cloud";
}

function requireEnv(
  value: string | undefined,
  cloudName: string,
  localName: string,
  fallbackName: string
): string {
  if (value) return value;
  const provider = getProvider().toUpperCase();
  const providerName = provider === "LOCAL" ? localName : cloudName;
  throw new Error(
    `Missing Supabase env: set ${providerName} or ${fallbackName}`
  );
}

export function getSupabaseUrl(): string {
  const provider = getProvider();
  const value =
    provider === "local"
      ? process.env.NEXT_PUBLIC_SUPABASE_URL_LOCAL ??
        process.env.NEXT_PUBLIC_SUPABASE_URL
      : process.env.NEXT_PUBLIC_SUPABASE_URL ??
        process.env.NEXT_PUBLIC_SUPABASE_URL_CLOUD;
  return requireEnv(
    value,
    "NEXT_PUBLIC_SUPABASE_URL_CLOUD",
    "NEXT_PUBLIC_SUPABASE_URL_LOCAL",
    "NEXT_PUBLIC_SUPABASE_URL"
  );
}

export function getSupabaseAnonKey(): string {
  const provider = getProvider();
  const value =
    provider === "local"
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_CLOUD;
  return requireEnv(
    value,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY_CLOUD",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

export function getSupabaseServiceRoleKey(): string {
  const provider = getProvider();
  const value =
    provider === "local"
      ? process.env.SUPABASE_SERVICE_ROLE_KEY_LOCAL ??
        process.env.SUPABASE_SERVICE_ROLE_KEY
      : process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.SUPABASE_SERVICE_ROLE_KEY_CLOUD;
  return requireEnv(
    value,
    "SUPABASE_SERVICE_ROLE_KEY_CLOUD",
    "SUPABASE_SERVICE_ROLE_KEY_LOCAL",
    "SUPABASE_SERVICE_ROLE_KEY"
  );
}

export function getSupabaseProvider(): SupabaseProvider {
  return getProvider();
}
