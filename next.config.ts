import type { NextConfig } from "next";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const defaultCache = require("next-pwa/cache") as Array<{
  urlPattern: unknown;
  handler: string;
  method?: string;
  options?: Record<string, unknown>;
}>;

const withPWA = require("next-pwa")({
  dest: "public",
  disable:
    process.env.NODE_ENV === "development" ||
    process.env.SKIP_PWA_BUILD === "1",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith("/api/"),
      handler: "NetworkOnly",
    },
    ...defaultCache,
  ],
}) as (config: NextConfig) => NextConfig;

const skipBuildChecks = process.env.SKIP_TYPECHECK === "1";

const nextConfig: NextConfig = {
  // Нужно для production-образа Docker (см. Dockerfile)
  output: "standalone",
  // На слабом VPS `next build` часто «зависает» на Running TypeScript — отключаем в Docker.
  typescript: {
    ignoreBuildErrors: skipBuildChecks,
  },
  eslint: {
    ignoreDuringBuilds: skipBuildChecks,
  },
};

export default withPWA(nextConfig);
