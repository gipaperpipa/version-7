# Feasibility OS

Feasibility OS is a Sprint 1 internal alpha for residential development feasibility. The current thin product path is:

`/` -> demo workspace -> parcels -> parcel detail -> planning -> scenario builder -> readiness -> run -> result

The frontend is intentionally productized, but the backend scope remains narrow and explicit. Parcel geometry and area are expected to be source-derived in the real product. Manual parcel entry remains a fallback for demo and source-gap testing.

## Local startup
1. Install dependencies
   `pnpm install`
2. Set env files
   Copy `apps/api/.env.example` to `apps/api/.env`
   Copy `apps/web/.env.example` to `apps/web/.env.local`
3. Generate Prisma client
   `pnpm prisma:generate`
4. Run migrations
   `pnpm prisma:migrate`
5. Seed demo data
   `pnpm prisma:seed`
6. Start everything
   `pnpm dev`

## Local entry
- Web entry:
  `http://localhost:3001/`
- Demo workspace:
  `http://localhost:3001/demo/parcels`
- Scenario studio:
  `http://localhost:3001/demo/scenarios`
- API docs:
  `http://localhost:4000/api/docs`
- API health:
  `http://localhost:4000/api/health`

## Demo fallback behavior
The public/demo workspace is seeded under slug `demo`.

- Web demo fallback:
  controlled by `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK`
- API demo fallback:
  controlled by `ENABLE_DEMO_FALLBACK`

Behavior:
- in non-production local development, demo fallback is enabled by default
- in hosted production, demo fallback is disabled unless you explicitly set those env vars to `true`
- when both flags are enabled and the seed has run, `/demo/...` works without pre-existing auth cookies

## Required environment variables

### Web (`apps/web/.env.local` or Vercel env)
- `NEXT_PUBLIC_API_URL`
  Example:
  `https://feasibility-os-api.onrender.com`
- `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK`
  Set to `true` for public demo/testing deployments

### API (`apps/api/.env` or Render env)
- `DATABASE_URL`
  Hosted PostgreSQL connection string
- `PORT`
  Render provides this automatically
- `API_PUBLIC_URL`
  Public API origin without `/api`
  Example:
  `https://feasibility-os-api.onrender.com`
- `ENABLE_DEMO_FALLBACK`
  Set to `true` for public demo/testing deployments

Redis configuration:
- preferred hosted option:
  `REDIS_URL`
  Example:
  `rediss://default:password@host:6379`
- host/port alternative:
  `REDIS_HOST`
  `REDIS_PORT`
  optional:
  `REDIS_USERNAME`
  `REDIS_PASSWORD`
  `REDIS_TLS`

Optional diagnostics flags:
- `DISABLE_SWAGGER`
- `DISABLE_BULL`

## Hosted infrastructure requirements

### Database
Use a hosted PostgreSQL database reachable from Render.

Requirements:
- PostgreSQL accessible from the API service
- PostGIS enabled
- Prisma migrations permitted

If you do not already have hosted Postgres with PostGIS:
1. provision hosted PostgreSQL
2. enable the `postgis` extension
3. set `DATABASE_URL`
4. run `pnpm prisma:migrate`
5. run `pnpm prisma:seed`

### Redis
Use a hosted Redis instance reachable from Render.

Supported configuration:
- `REDIS_URL`
- or host/port plus optional username/password/TLS env vars

Redis and Prisma failures are logged loudly during API startup and fail the process non-zero.

## Public deployment

### Web deployment on Vercel
Create a Vercel project from this repo.

Recommended settings:
1. Framework preset:
   `Next.js`
2. Root Directory:
   `apps/web`
3. Install Command:
   `pnpm install --frozen-lockfile`
4. Build Command:
   `pnpm build`

Required Vercel env vars:
- `NEXT_PUBLIC_API_URL=https://<render-domain>`
- `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true`

### API deployment on Render
Create a Render web service from this repo.

Recommended settings:
1. Root directory:
   repo root
2. Build Command:
   `pnpm install --frozen-lockfile && pnpm prisma:generate && pnpm --filter @repo/api build`
3. Start Command:
   `pnpm --filter @repo/api start`
4. Pre-Deploy Command:
   `pnpm prisma:migrate && pnpm prisma:seed`

Required Render env vars:
- `DATABASE_URL`
- `PORT`
- `API_PUBLIC_URL=https://<render-domain>`
- `ENABLE_DEMO_FALLBACK=true`
- `REDIS_URL=rediss://...`
  or
  `REDIS_HOST`, `REDIS_PORT`, optional `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS`

## Public testing URL pattern
Once deployed, the reviewer path is:

- Product entry:
  `https://<vercel-domain>/`
- Demo workspace:
  `https://<vercel-domain>/demo/parcels`
- Demo scenario studio:
  `https://<vercel-domain>/demo/scenarios`
- Parcel detail:
  `https://<vercel-domain>/demo/parcels/<parcelId>`
- Planning:
  `https://<vercel-domain>/demo/parcels/<parcelId>/planning`
- Scenario builder:
  `https://<vercel-domain>/demo/scenarios/<scenarioId>/builder`
- Result:
  `https://<vercel-domain>/demo/scenarios/<scenarioId>/results/<runId>`

API endpoints:
- Health:
  `https://<render-domain>/api/health`
- Docs:
  `https://<render-domain>/api/docs`

## Demo seed contents
The seed now creates:
- one demo organization at slug `demo`
- one demo user membership
- representative funding programs and variants for:
  - free financing
  - KfW
  - state subsidy
- one demo parcel
- planning inputs for that parcel, including a derived `BUILDABLE_WINDOW`
- one demo scenario linked to the parcel with starter funding-stack selection

This gives an external reviewer a usable workspace immediately after migration and seed.

## Health and diagnostics
- Health check:
  `pnpm verify:health`
- Health check against a public API:
  `pnpm verify:health -- https://<render-domain>/api/health`

Expected successful startup log line:
- `[startup] API listening on https://<render-domain>/api`

Also expect:
- `[startup] Prisma connected.`
- `[startup] Redis connected.`

Swagger/docs remains available at `/api/docs` unless `DISABLE_SWAGGER=true`.

## Common commands
- Start everything locally:
  `pnpm dev`
- Build everything:
  `pnpm build`
- Typecheck everything:
  `pnpm typecheck`
- Generate Prisma client:
  `pnpm prisma:generate`
- Deploy migrations:
  `pnpm prisma:migrate`
- Seed demo data:
  `pnpm prisma:seed`
- Check API health:
  `pnpm verify:health`
