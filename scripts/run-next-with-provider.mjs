import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");

const [, , provider, mode] = process.argv;

if (!provider || !mode) {
  console.error(
    "Usage: node ./scripts/run-next-with-provider.mjs <cloud|local> <dev|build|start>"
  );
  process.exit(1);
}

if (!["cloud", "local"].includes(provider)) {
  console.error(`Unknown provider "${provider}". Use cloud or local.`);
  process.exit(1);
}

if (!["dev", "build", "start"].includes(mode)) {
  console.error(`Unknown mode "${mode}". Use dev, build or start.`);
  process.exit(1);
}

const projectRoot = resolve(process.cwd());
loadEnvConfig(projectRoot);

function pickProviderEnv(cloudKey, localKey, fallbackKey) {
  const cloud = process.env[cloudKey];
  const local = process.env[localKey];
  const fallback = process.env[fallbackKey];
  return provider === "local" ? local ?? fallback : cloud ?? fallback;
}

const supabaseUrl = pickProviderEnv(
  "NEXT_PUBLIC_SUPABASE_URL_CLOUD",
  "NEXT_PUBLIC_SUPABASE_URL_LOCAL",
  "NEXT_PUBLIC_SUPABASE_URL"
);
const supabaseAnonKey = pickProviderEnv(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY_CLOUD",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
);

if (!supabaseUrl || !supabaseAnonKey) {
  const suffix = provider === "local" ? "LOCAL" : "CLOUD";
  console.error(
    `Missing Supabase env for provider "${provider}". Set NEXT_PUBLIC_SUPABASE_URL_${suffix} and NEXT_PUBLIC_SUPABASE_ANON_KEY_${suffix}, or the fallback NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.`
  );
  if (provider === "local") {
    console.error('Run "npm run supabase:sync-local-env" after "npx supabase start".');
  }
  process.exit(1);
}

const nextArgs = [mode];
if (mode === "dev" || mode === "build") {
  nextArgs.push("--webpack");
}

const child = spawn("next", nextArgs, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    SUPABASE_PROVIDER: provider,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
