## Supabase Provider Switching

This project supports two providers:
- `cloud` - your hosted Supabase project
- `local` - local Supabase stack (usually started with `supabase start`)

The active provider is controlled by `SUPABASE_PROVIDER` and can be switched by scripts.

### Environment variables

Current `.env.local` contains fallback keys:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Provider-specific keys (recommended):
- `NEXT_PUBLIC_SUPABASE_URL_CLOUD`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY_CLOUD`
- `SUPABASE_SERVICE_ROLE_KEY_CLOUD`
- `NEXT_PUBLIC_SUPABASE_URL_LOCAL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL`
- `SUPABASE_SERVICE_ROLE_KEY_LOCAL`

When provider-specific variables exist, they have priority over fallback keys.

### Healthy Life module (healthy-life.myworkspace.su)

Healthy Life is a separate app merged into this same Next.js process, served under its
own hostname via `src/proxy.ts` (rewritten internally to `/healthy-life/*`). It uses its
own Supabase project (own users, own storage bucket) and Prisma for the database, kept
fully isolated from Ticketter's own Supabase project.

Required env vars (see `.env.local`):
- `NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_URL`
- `NEXT_PUBLIC_HEALTHY_LIFE_SUPABASE_ANON_KEY`
- `HEALTHY_LIFE_SUPABASE_SERVICE_ROLE_KEY`
- `HEALTHY_LIFE_SUPABASE_MEAL_PHOTOS_BUCKET`
- `HEALTHY_LIFE_DATABASE_URL` / `HEALTHY_LIFE_DIRECT_URL` (Prisma, pooled + direct connection)
- `HEALTHY_LIFE_OPENAI_API_KEY` / `HEALTHY_LIFE_OPENAI_MODEL`

Prisma commands (schema lives at `prisma/schema.prisma`):
```bash
npm run healthy-life:db:push      # push schema to the Healthy Life database
npm run healthy-life:db:migrate   # deploy migrations
npm run healthy-life:db:studio    # open Prisma Studio
```

`prisma generate` runs automatically via `postinstall` and before `next build`.

### Start commands

```bash
# cloud provider
npm run dev:cloud

# local provider
npm run dev:local
```

Build/start are also provider-aware:

```bash
npm run build:cloud
npm run build:local
npm run start:cloud
npm run start:local
```

### Local Supabase flow

```bash
# 1) start local Supabase services
npx supabase start

# 2) sync local keys into .env.local
npm run supabase:sync-local-env

# 3) apply migrations from supabase/migrations
npx supabase db reset

# 4) run app against local provider
npm run dev:local
```

`npm run supabase:sync-local-env` reads `npx supabase status -o env` and updates:
- `NEXT_PUBLIC_SUPABASE_URL_LOCAL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY_LOCAL`
- `SUPABASE_SERVICE_ROLE_KEY_LOCAL`
