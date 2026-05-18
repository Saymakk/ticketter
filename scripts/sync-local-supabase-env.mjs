import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const envPath = resolve(projectRoot, ".env.local");

function runSupabaseStatusEnv() {
  try {
    return execSync("npx supabase status -o env", {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String(error.stderr || "")
        : "";
    throw new Error(
      `Cannot read local Supabase status. Start Docker and run "npx supabase start".\n${stderr}`.trim()
    );
  }
}

function parseEnvOutput(raw) {
  const vars = {};
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    vars[key] = value;
  }
  return vars;
}

function pick(obj, ...candidates) {
  for (const key of candidates) {
    if (obj[key]) return obj[key];
  }
  return undefined;
}

function upsertEnv(content, key, value) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped}=.*$`, "m");
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`);
  }
  const suffix = content.endsWith("\n") ? "" : "\n";
  return `${content}${suffix}${key}=${value}\n`;
}

function main() {
  if (!existsSync(envPath)) {
    throw new Error(`.env.local not found at ${envPath}`);
  }

  const statusEnv = runSupabaseStatusEnv();
  const statusVars = parseEnvOutput(statusEnv);

  const localUrl = pick(
    statusVars,
    "API_URL",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "ANON_URL"
  );
  const localAnon = pick(
    statusVars,
    "ANON_KEY",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  const localServiceRole = pick(
    statusVars,
    "SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  );

  if (!localUrl || !localAnon || !localServiceRole) {
    throw new Error(
      "Cannot map required values from supabase status. Expected URL/ANON_KEY/SERVICE_ROLE_KEY."
    );
  }

  let envContent = readFileSync(envPath, "utf8");
  envContent = upsertEnv(envContent, "NEXT_PUBLIC_SUPABASE_URL_LOCAL", localUrl);
  envContent = upsertEnv(envContent, "NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL", localAnon);
  envContent = upsertEnv(envContent, "SUPABASE_SERVICE_ROLE_KEY_LOCAL", localServiceRole);

  writeFileSync(envPath, envContent, "utf8");

  console.log("Updated .env.local with local Supabase credentials:");
  console.log("- NEXT_PUBLIC_SUPABASE_URL_LOCAL");
  console.log("- NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL");
  console.log("- SUPABASE_SERVICE_ROLE_KEY_LOCAL");
}

main();
