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

const nextConfig: NextConfig = {
  // Нужно для production-образа Docker (см. Dockerfile)
  output: "standalone",
};

export default withPWA(nextConfig);
