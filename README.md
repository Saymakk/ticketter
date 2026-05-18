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
