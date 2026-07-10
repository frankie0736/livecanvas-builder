# Local Validation Report

Date: 2026-07-11 (Asia/Singapore)

## Runtime

- URL: `http://127.0.0.1:5173`
- PID: `76182`
- Runtime: TanStack Start on the local Cloudflare-compatible Vite runtime
- Online Cloudflare resources: not created or modified

## Commands

```bash
bun test
bun run typecheck
bun run check
bun run build
bunx wrangler deploy --dry-run
bun run test:e2e
bun run verify:local
```

## Results

- Full acceptance: passed in one combined run
- Bun tests: 77 passed, 0 failed, 219 assertions
- TypeScript: both application and Worker configurations passed
- Biome: 261 files checked, no fixes required
- Production build: passed
- Wrangler deploy dry-run: passed without creating resources
- Playwright: 3 scenarios passed
- HTTP boundary verifier: 5 checks passed
- Desktop viewport: `1440x900`
- Mobile viewport: `390x844`
- Mobile overflow assertion: primary routes allow at most 1 px horizontal overflow

## Artifacts

Artifacts are under the ignored `.migration/private/playwright/results/` path.

| Artifact | SHA-256 |
| --- | --- |
| `authenticated-desktop.png` | `470448910b038838eb4674f65b1db9b0de5e8718b6d359b34d3954d734dcf8b3` |
| `authenticated-mobile.png` | `c9636ae85b9ee3f07ae87381349d6e2370b81f9d1687b039c456fd67854e0c31` |
| `.last-run.json` | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |

## Known Risks

- External OAuth callbacks are configured but not exercised by local browser tests.
- AI generation calls are not sent to the external provider during local acceptance.
- Browser coverage asserts critical routes and workflows; it is not a pixel-by-pixel baseline comparison of every state.
- Production D1, R2, Workflow, secrets, domains, and routing remain unverified until online resources are explicitly approved.
