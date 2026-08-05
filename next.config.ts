import type { NextConfig } from "next";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const skipBuildChecks = process.env.SKIP_TYPECHECK === "1";
const skipPwa = process.env.SKIP_PWA_BUILD === "1";

const nextConfig: NextConfig = {
  output: "standalone",
  // Prisma's query engine binary isn't picked up by the standalone file tracer by default.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/web-push/**/*",
      "./node_modules/asn1.js/**/*",
      "./node_modules/http_ece/**/*",
      "./node_modules/https-proxy-agent/**/*",
      "./node_modules/jws/**/*",
    ],
  },
  // Healthy Life module allows LAN testing from a phone during development.
  allowedDevOrigins: ["192.168.8.108", "localhost", "127.0.0.1"],
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
    disable: process.env.NODE_ENV === "development" && process.env.ENABLE_PWA_DEV !== "1",
    register: true,
    skipWaiting: true,
    importScripts: ["/hl-push-sw.js"],
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
