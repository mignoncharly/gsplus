# Time-limited dependency exception — React Router RSC mode

Exception ID: GSP-DEP-2026-07-25-RR-RSC
Status: RISK-ACCEPTED
Approved by: Golden Studio Plus website owner through the 2026-07-25 instruction to complete the non-legal readiness work
Technical owner: website maintenance owner
Opened: 2026-07-25
Review frequency: weekly dependency audit and immediately after any React Router release
Expiry: 2026-08-25

## Advisory and affected release

- Advisory: GHSA-qwww-vcr4-c8h2 — RSC Mode CSRF bypass can execute an action before a 400 response.
- Installed direct package: `react-router-dom@7.18.1`.
- Installed transitive package: `react-router@7.18.1`.
- Published affected range reported by npm: `react-router >=7.12.0 <8.3.0`.
- Refreshed production audit: two high package entries representing this single advisory and dependency path.
- npm suggests 7.11.0 as a downgrade; there is no forward-compatible fixed 7.x release. An unreviewed downgrade or forced audit rewrite is not accepted.

## Proof the vulnerable path is absent

Golden Studio Plus is a Vite-built client-side React application. It does not install React Router framework/server packages, expose React Server Components, define server actions, or execute React Router action endpoints. All business mutations are ordinary calls to the separate Express API and are protected there by validation, authentication where required, CSRF/origin controls, rate limiting, and idempotency.

`npm run check:client-only` recursively rejects:

- `"use server"` directives;
- `.server.*` source modules;
- React Router server/RSC subpath imports;
- React Server DOM imports;
- `@react-router/dev`, `@react-router/node`, or React Server DOM dependencies.

The guard runs before every production frontend build, so the compensating assumption cannot silently change.

## Compensating controls and closure action

- Keep the application client-only and the Express API separate.
- Run production and full `npm audit` during every release.
- Run unit, route, booking, admin, CSP, local browser, and production browser regression suites before deployment.
- Upgrade to the first forward-compatible fixed React Router release after changelog review and complete regression testing.
- Close this exception immediately if RSC/framework mode or server actions are proposed; those changes require a separate security review before merge.

This exception covers only GHSA-qwww-vcr4-c8h2 and only while the client-only assertion remains passing. It does not waive unrelated future advisories.
