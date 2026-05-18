import { createBrowserClient } from "@supabase/ssr";

function requirePublicEnv(
  value: string | undefined,
  name: string
): string {
  if (!value) {
    throw new Error(
      `Missing Supabase env: set ${name} (use npm run dev:cloud or npm run dev:local)`
    );
  }
  return value;
}

export function createClient() {
  const url = requirePublicEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL"
  );
  const anonKey = requirePublicEnv(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  return createBrowserClient(url, anonKey);
}
