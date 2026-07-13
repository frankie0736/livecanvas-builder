# Cloudflare Production Handoff

Last updated: 2026-07-13 08:06 +08.

## Invariant

- Production uses Markyan Cloudflare resources only.
- Production OAuth credentials are distinct from staging credentials.
- D1 is application state truth; R2 stores the copied media objects.
- Secrets and copied data remain only in ignored private files and Cloudflare secret storage.

## Deployed Resources

- Account: Markyan (`d1da6c26f60e13fb006a3d4b5dae3f09`)
- Worker: `livecanvas-builder`
  - production URL: `https://lc.xunpanziyou.com`
  - version: `08ae2ca5-68ea-4a62-aad7-cf4595436400`
- D1: `livecanvas-builder`
  - database id: `5f822d4a-17b7-4fba-9b57-0b04412081cb`
- R2: `livecanvas-builder-assets`
- Workflow binding: `CHAT_GENERATION` -> `livecanvas-builder-chat`

The deployed Worker binding summary confirms `DB`, `ASSETS`, `CHAT_GENERATION`, and `NODE_ENV=production` all target the production environment.

## Data And Verification

- D1 migrations and the ignored private D1 import completed against the production database.
- All 454 manifest-referenced R2 objects were serially imported.
- Full remote verification passed: every object matched its archived byte size and SHA-256, and the D1 media-reference mapping was complete.
- `PRODUCTION_BASE_URL=https://lc.xunpanziyou.com bun run verify:production` passed all 5 HTTP boundary checks.

## Secrets

The Worker received production-only `AUTH_SECRET`, Google and Discord provider credentials, `TASK_PAYLOAD_KEY`, and `AUTH_BASE_URL` from ignored `.production.vars`.

`AUTH_GOOGLE_SECRET` was checked against the staging value before upload and is different. Do not copy staging OAuth credentials to production or print either value.

## Domain And OAuth

`lc.xunpanziyou.com` is bound to the production Worker as a Cloudflare custom domain. The route is declared in `env.production.routes` with `custom_domain: true`.

Cloudflare disables `workers.dev` for this Worker when the custom domain route is configured. Use `https://lc.xunpanziyou.com` for all production checks and OAuth callbacks.

The production Google OAuth client must include this redirect URI:

```text
https://lc.xunpanziyou.com/api/auth/callback/google
```

Use the production Google client whose secret is in the ignored production environment file, not the staging client.

## Repeatable Checks

```sh
bun test && bun run typecheck && bun run check && bun run cf:dry-run:production
PRODUCTION_BASE_URL=https://lc.xunpanziyou.com bun run verify:production
bun run migration:verify-media-production
```

Remote R2 writes run serially. Concurrent Wrangler writes were observed producing partial objects during restoration; preserve serial writes unless that behavior is independently disproven and the migration path is reverified.
