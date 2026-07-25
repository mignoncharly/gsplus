# Phase 18 — Final non-legal readiness

Date: 2026-07-25 UTC
Exact frontend `dist/index.html` SHA-256: `6a4688217476c02c9ec36b0c93848ff6feafeea73a2c0b11c2accd2479b694bd`
Social card SHA-256: `baefcaca6f2f844836ee147097a21119f2b0d8564f0ff9e12aae4dde48ff1c01`

## Passed matrix

- Backend TypeScript build: PASS.
- Backend integration tests: 49/49 PASS.
- Backend production dependency audit: 0 vulnerabilities.
- Production runtime excludes Prisma CLI, TypeScript, tsx, Vitest, Hono, Valibot and `@prisma/dev`.
- Frontend unit tests: 37/37 PASS.
- Frontend lint: PASS.
- Client-only/RSC assertion: PASS across 34 source modules.
- Frontend production build, 14 prerendered documents and performance budgets: PASS.
- Local Playwright Chromium/WebKit matrix: 32/32 PASS.
- Production Playwright Chromium/WebKit matrix: 22/22 PASS.
- Production axe matrix with browser-only CSP bypass: 2/2 PASS.
- Production social metadata: canonical URL-specific Open Graph tags, secure 1200×630 JPEG and `summary_large_image` Twitter metadata PASS.
- Official Facebook and Instagram links: PASS; LinkedIn placeholder absent; native share/copy action present.
- Nginx, PostgreSQL and backend services: active.
- Backend local and public health: PASS after production-only restart.
- Phase 17 cleanup reconciliation: PASS with zero pending notification, block or external QA calendar event.

## Reviewed exception

`GHSA-qwww-vcr4-c8h2` affects React Router RSC/server-action mode. This application is client-only, has no RSC/server actions, and a CI assertion prevents their introduction. The time-limited review is documented in `risk-acceptance-react-router-rsc-2026-07-25.md` and expires 2026-08-25. No forced downgrade or blind `npm audit fix --force` was used.

## Required deployment action

The versioned Nginx file contains the current JSON-LD hash, but the active root-owned Nginx file still contains the prior hash. The site and all browser tests pass, but the configuration must be synchronized before an unconditional sign-off:

```sh
sudo cp /var/www/goldenstudioplus/docs/goldenstudioplus-nginx-phase11.conf /etc/nginx/sites-available/goldenstudioplus
sudo cp /var/www/goldenstudioplus/docs/goldenstudioplus-nginx-phase11.conf /etc/nginx/sites-enabled/goldenstudioplus
sudo nginx -t
sudo systemctl reload nginx
```

Expected current JSON-LD hash: `sha256-qOCPlG8yA0E2Jlvrk8PYcdHOpii4QSscG+skJV5Yq6M=`. This session cannot modify root-owned Nginx configuration because no privileged credential is available.

## Remaining external evidence

Excluding owner-deferred legal and WhatsApp work, two external proofs remain:

- Owner confirmation that the provider-accepted QA messages arrived in the configured mailbox.
- An operator sandbox or owner-authorized real mobile-money transaction, followed by Cal.com create/update/delete and reconciliation evidence.

Therefore, the code, content, media, security, indexing, dependency, e-mail outbox and safely testable business flows are complete. The exact phrase “100% of non-legal audit findings closed” must wait for the Nginx sync and the two external proofs above.
