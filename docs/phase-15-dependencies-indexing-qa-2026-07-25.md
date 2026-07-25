# Phase 15 — Dependencies, indexing and repeatable QA

Date: 2026-07-25
Status: local acceptance complete; production verification pending deployment

## Dependency remediation

### Backend

Prisma, the client, and the PostgreSQL adapter were upgraded from 7.8.0 to 7.9.0. Prisma 7.9's development package initially resolved vulnerable `find-my-way@9.6.0` and `valibot@1.2.0`; package overrides pin the compatible patched releases 9.7.0 and 1.4.2.

Evidence:

- Prisma Client generation: passed.
- TypeScript build: passed.
- Vitest: 48 passed, 0 failed.
- Full backend `npm audit`: 0 vulnerabilities.
- Isolated production-tree audit: 0 vulnerabilities.

Because npm installs Prisma and TypeScript as optional peers of `@prisma/client` even when Prisma is declared only in development dependencies, `npm run install:production` performs the tested sequence: install without development dependencies/lifecycle scripts, then remove the optional Prisma and TypeScript peers without reifying development packages. The isolated proof showed Prisma, `@prisma/dev`, Hono tooling, Valibot, TypeScript, Vitest and tsx absent while Sharp and its native Linux runtime binaries remained installed.

### Frontend tooling

ESLint was upgraded from 9.39.4 to 10.8.0, `@eslint/js` to 10.0.1, react-hooks to 7.1.1, and react-refresh to 0.5.3. This removes the development-only brace-expansion/minimatch chain. The stricter lint found one dead initial assignment in the reservation slot title; it was replaced by an equivalent immutable conditional expression.

### React Router exception

The refreshed production audit contains two high package entries representing one advisory, GHSA-qwww-vcr4-c8h2. The affected behavior is React Router RSC action handling, which this Vite client-only application does not use. No forward-compatible fixed 7.x release exists; npm's automated suggestion is a downgrade to 7.11.0.

The bounded exception is `docs/risk-acceptance-react-router-rsc-2026-07-25.md`, expires 2026-08-25, and is enforced by `npm run check:client-only` before every production build. The guard passed across 34 source modules and rejects server-action directives, server modules, RSC/server imports, and server-framework dependencies.

## Indexing

`robots.txt` no longer disallows `/admin` or `/admin/`. This allows crawlers to observe the raw `noindex, nofollow` HTML policy. `/api/` and `/uploads/` remain excluded as an indexing policy only; their security comes from API authentication/authorization and Nginx access controls.

Raw admin prerenders have no canonical link or LocalBusiness schema and retain `noindex, nofollow`. Admin data endpoints remain authentication protected. Security headers continue to be tested independently.

## QA harness separation

- `playwright.local.config.js`: starts only the local Vite server and ignores production specs.
- `playwright.production.config.js`: requires an explicit `PLAYWRIGHT_BASE_URL`, never starts a local server, and selects only production specs.
- `playwright.production-a11y.config.js`: requires an explicit production origin, selects only the two axe cases, and uses Playwright's browser-context `bypassCSP: true`. Production CSP is not weakened.

Package commands are `test:e2e:local`, `test:e2e:production`, and `test:a11y:production`. Discovery proves 32 local cases, 20 production cases, and 2 production accessibility cases with no overlap caused by configuration mode.

## Local acceptance

- Frontend unit/security/media tests: 37 passed, 0 failed.
- ESLint 10: passed.
- Client-only guard: passed.
- Production build/prerender/performance budgets: passed.
- Local browser regression: 32 passed across Chromium and WebKit.
- Backend generation/build/tests: passed; 48 tests.
- Backend full audit: 0.
- Frontend audit: only the documented RSC-only advisory path remains.

The CSP JSON-LD hash in the versioned Nginx configuration was updated because the LocalBusiness social-image URL changed. The active Nginx configuration must receive that exact tested hash during deployment before the new HTML is activated.
