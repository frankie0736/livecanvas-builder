# Cloudflare Staging Handoff

Last updated: 2026-07-11 12:57 +08.

## Invariant

- UI and user-visible behavior must stay unchanged.
- Frankie Cloudflare account is staging only.
- Markyan Cloudflare account is prod only and must remain untouched until staging is accepted.
- D1 is application state source of truth; R2 stores media.
- Secrets and copied production data must stay out of git, logs, CST evidence, and chat output.

## Current Branch

- Repo: `/Users/fx/yansircc/livecanvas-builder`
- Branch: `refactor/tanstack-start-cloudflare`
- No commit has been made for this staging work.

Current changed files:

- `.cst/events.jsonl`
- `wrangler.jsonc`
- `package.json`
- `scripts/migration/media.ts`
- `scripts/verify-local.ts`
- `scripts/verify-http.ts`
- `scripts/verify-staging.ts`
- `docs/cloudflare-staging-handoff.md`

Ignored/private state remains under:

- `.env.prod`
- `.dev.vars`
- `.migration/private/`
- `dist/`
- `.wrangler/`

## CST State

- Existing migration root #1 was already completed before staging work began.
- New staging goal: #16 `Deploy Cloudflare staging on Frankie account`
- Task #19 `Create Frankie Cloudflare staging resources, deploy worker, import copied data, and verify public boundaries` is complete. CST acceptance evidence records both declared checks.
- Task #19 acceptance:
  - local: `bun test && bun run typecheck && bun run check && bun run cf:dry-run:staging`
  - remote: `bun run verify:staging`

Next session should start with:

```sh
cst --store /Users/fx/yansircc/livecanvas-builder next
```

## Cloudflare Account Boundary

Wrangler is logged in as `frankiexu32@gmail.com`.

Visible accounts from `wrangler whoami`:

- Frankie account id: `c924dde93190ddb1f5d551fb1c42e1db`
- Markyan account id: `d1da6c26f60e13fb006a3d4b5dae3f09`

All staging commands must explicitly target Frankie. Use either the staging env in `wrangler.jsonc` or:

```sh
CLOUDFLARE_ACCOUNT_ID=c924dde93190ddb1f5d551fb1c42e1db
```

Do not run production resource commands against Markyan in the next session.

## Deployed Staging

Frankie account now hosts the complete staging surface:

- D1 database: `livecanvas-builder-staging`
  - database id: `afbdd3f0-ee48-48dd-8505-5f85dc147d01`
  - creation output reported region `WNAM`
- R2 bucket: `livecanvas-builder-assets-staging`
- Worker: `livecanvas-builder-staging`
  - URL: `https://livecanvas-builder-staging.frankiexu32.workers.dev`
  - Workflow binding created: `livecanvas-builder-chat-staging`
- D1 migration and the ignored private import have been applied to staging.
- R2 import and verification passed for all 454 database-referenced media objects. Byte size, SHA-256, and remote D1 media-reference coverage matched the private manifest.
- Worker secrets uploaded without printing their values: `AUTH_SECRET`, Google/Discord provider credentials, `TASK_PAYLOAD_KEY`, and `AUTH_BASE_URL`.
- `bun run verify:staging` passed all 5 public HTTP checks.

## Config Changes Already Made

`wrangler.jsonc` now has `env.staging`:

- `account_id`: Frankie account id
- Worker name: `livecanvas-builder-staging`
- D1 binding: `DB` -> `livecanvas-builder-staging`
- R2 binding: `ASSETS` -> `livecanvas-builder-assets-staging`
- Workflow binding: `CHAT_GENERATION` -> `livecanvas-builder-chat-staging`
- `NODE_ENV=production`

Binding names are intentionally unchanged. The code should not branch on staging vs prod.

Remote media import and verification commands now exist:

```sh
bun run migration:import-media-staging
bun run migration:verify-media-staging
```

They read the `ASSETS` bucket from `wrangler.jsonc`, use the existing manifest as the only media mapping source, and invoke Wrangler's direct R2 object operations. The direct path is necessary because `getPlatformProxy` remote R2 operations stalled under this account's OAuth session. Remote writes are serialized because concurrent Wrangler writes produced partial objects during production restoration; remote reads are bounded to two concurrent operations. Each Wrangler command has a 60-second timeout and three idempotent retries; diagnostics remain under the ignored environment-specific `.migration/private/<env>-logs/` directory.

## Important Build Boundary

Cloudflare Vite plugin redirects deploys to `dist/server/wrangler.json`.

Failure discovered:

- Running `wrangler deploy --env staging --dry-run` after a normal build still used local bindings from `dist/server/wrangler.json`.
- The generated deploy config only switched to staging when the build itself ran with `CLOUDFLARE_ENV=staging`.

Minimal fix already added:

- `build:staging`: `CLOUDFLARE_ENV=staging vite build`
- `cf:dry-run:staging`: `CLOUDFLARE_ENV=staging bun run build && wrangler deploy --env staging --dry-run`
- `cf:deploy:staging`: `CLOUDFLARE_ENV=staging bun run build && wrangler deploy --env staging`

Before real deploy, inspect `dist/server/wrangler.json` after `bun run build:staging` and confirm:

- `targetEnvironment` is `staging`
- `name` is `livecanvas-builder-staging`
- `DB` points at database id `afbdd3f0-ee48-48dd-8505-5f85dc147d01`
- `ASSETS` points at `livecanvas-builder-assets-staging`
- `CHAT_GENERATION` points at `livecanvas-builder-chat-staging`

## Verification Scripts

Added shared HTTP verification:

- `scripts/verify-http.ts`
- `scripts/verify-local.ts`
- `scripts/verify-staging.ts`

`verify:staging` defaults to:

```text
https://livecanvas-builder-staging.frankiexu32.workers.dev
```

If deploy output shows a different workers.dev URL, set:

```sh
STAGING_BASE_URL=<actual-url> bun run verify:staging
```

## Secret Boundary

Never upload legacy runtime secrets that are no longer used by the Worker:

- Postgres `DATABASE_URL`
- Vercel Blob token
- Trigger.dev keys
- Vercel Edge Config

## Follow-up Order

1. Before any later Worker deploy, run:

```sh
bun test && bun run typecheck && bun run check && bun run cf:dry-run:staging
bun run verify:staging
```

2. Test Google and Discord sign-in callbacks against the staging URL before accepting this as a user-ready environment. Provider console callback entries may still be required.

## Known Risks

- The current `@cloudflare/vite-plugin` package declares peer `wrangler ^4.110.0`, while the project package currently pins `wrangler ^4.74.0` and executed `wrangler 4.83.0`. This mismatch did not block build, but keep it in mind if deploy config behavior changes.
- A staging build wrote a generated `dist/server/.dev.vars` artifact. `dist/` is ignored, but do not copy generated deploy artifacts into git or logs.
- OAuth callbacks have not been tested against staging. Google/Discord callback URLs may need staging entries in provider consoles.
