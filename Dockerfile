# Сборка Next.js в режиме standalone (next.config.ts: output: "standalone")
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* вшиваются в бандл на этапе `next build` — передайте через docker-compose build.args
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_URL
ARG NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_URL=$NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_URL
ENV NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_ANON_KEY=$NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_ANON_KEY

ENV NEXT_TELEMETRY_DISABLED=1
# Слабый VPS: без swap сборка часто «висит» на TypeScript (нехватка RAM).
# SKIP_PWA_BUILD=1 — не подключать next-pwa/workbox (быстрее и меньше RAM).
# Не задавайте NEXT_FONT_GOOGLE_MOCKED_RESPONSES=1 — ломает сборку (Cannot find module '1').
ENV NODE_OPTIONS=--max-old-space-size=2048
ENV SKIP_TYPECHECK=1
ENV SKIP_PWA_BUILD=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma's generated client + query engine binary (used by the Healthy Life module) —
# standalone's file tracer doesn't reliably bundle the native engine, copy it explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
