import type { NextConfig } from "next";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const skipBuildChecks = process.env.SKIP_TYPECHECK === "1";
const skipPwa = process.env.SKIP_PWA_BUILD === "1";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: skipBuildChecks,
  },
};

function withPwa(config: NextConfig): NextConfig {
  const defaultCache = require("next-pwa/cache") as Array<{
    urlPattern: unknown;
    handler: string;
    method?: string;
    options?: Record<string, unknown>;
  }>;

  const withPWA = require("next-pwa")({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
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

  return withPWA(config);
}

export default skipPwa ? nextConfig : withPwa(nextConfig);
