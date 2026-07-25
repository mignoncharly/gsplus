# Phase 11 — Security hardening

Status: Complete, deployed and production-verified on 2026-07-24 UTC.

Canonical production origin: `https://gsplus.vip`

## Outcome

Phase 11 closes the final audit remediation phase without activating any deferred provider or content input. The backend now listens only on `127.0.0.1:4000`, trusts forwarding metadata only from the local Nginx proxy, rejects disallowed browser origins, returns safe request/parser errors, and enforces authenticated session revocation on logout. Nginx supplies one coherent production security-header policy, overwrites untrusted forwarding headers and prevents write methods against static content.

The existing booking, payment, media, legal, accessibility, metadata and performance contracts from Phases 0–10 remain intact.

## Implemented controls

### Network and proxy boundary

- Production `HOST=127.0.0.1`; the Node service is not bound to a public or IPv6 interface.
- Express trusts only the loopback reverse proxy when `TRUST_PROXY=true`.
- Nginx replaces `X-Forwarded-For` with its observed remote address instead of appending caller-supplied values.
- The production CORS allowlist contains only `https://gsplus.vip` and `https://www.gsplus.vip`; insecure IP origins are absent.
- Disallowed origins receive a safe `403 ORIGIN_NOT_ALLOWED` response with no access-control allow-origin header.

### Browser and HTTP policy

- Nginx emits the security header set with `always`, including HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options`, Referrer Policy, Permissions Policy, COOP, CORP and Origin-Agent-Cluster.
- Upstream duplicates are hidden so successful and error responses carry exactly one coherent CSP and frame policy.
- CSP has no `unsafe-inline` or `unsafe-eval` in `script-src`. The sole inline JSON-LD block is allowed by its exact SHA-256 hash.
- Server version disclosure is disabled.
- Static and upload locations accept only `GET` and `HEAD`; upload directory listing is disabled.
- Private media masters remain unreachable through public routes.

### Authentication and request controls

- Production admin sessions use a `__Host-` cookie with `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, no `Domain`, and an eight-hour lifetime.
- Admin JWTs are constrained to HS256 with issuer, audience, subject, expiry and a database-backed session version.
- Logout requires authentication, records an audit event, increments the session version and invalidates replay of the old token.
- The general API limit remains 300 requests per 15 minutes, public writes remain 20 per 10 minutes, and admin login remains five failed attempts per 15 minutes with successful attempts excluded.
- All five public write endpoints retain honeypot protection; bot-field rejection cannot create records.
- JSON syntax errors, oversized request bodies, upload errors and not-found responses expose safe structured messages without stack traces.
- Application request bodies are capped at 1 MB. Portfolio uploads retain the exact 8 MB application limit, with Nginx allowing 9 MB for multipart overhead.

### Database

The additive migration `20260724211000_phase_11_admin_session_revocation` adds `AdminUser.sessionVersion` with a default of zero. All ten production migrations are applied and Prisma reports the schema up to date.

## Automated verification

- Backend test suite: 48/48 passed.
- Frontend Node suite: 28/28 passed.
- Frontend ESLint: passed with zero warnings.
- Frontend build and Phase 10 performance budgets: passed.
- Local Chromium and WebKit regression suite: 30 passed, with 14 production-only cases intentionally skipped.
- Production Chromium and WebKit security/regression suite: 20/20 passed.
- Production browser CSP violations on the home, portfolio, contact and admin-login routes: none.

The backend suite covers proxy spoofing, headers, CORS, safe parser errors, cookie/JWT constraints, revocation, expiry, rate-limit values and login success exclusion, all five honeypots, and the exact upload limit. The browser suites preserve accessibility, navigation, responsive, media, legal, metadata and performance behavior.

Two test-discovered regressions were corrected before the clean run: a transient opacity animation caused WebKit to scan a low-contrast intermediate state, and a lazy-image assertion raced the mocked portfolio response. Text remains fully opaque during motion, and the test now waits for the stable seven-item gallery.

## Production evidence

- `goldenstudioplus-backend` and `nginx` are active.
- Nginx configuration syntax validation passed before reload.
- Backend logs confirm listening on `127.0.0.1:4000`; socket inspection shows no public or IPv6 backend listener.
- Direct access to `178.105.50.226:4000` is refused.
- Root, API, 404, 401 and 403 responses carry one CSP and one frame policy; the server header does not disclose an Nginx version.
- Health and real-not-found paths return their expected `200` and `404` responses.
- Public access to private masters returns `404`; upload directory indexing and static POST requests are denied.
- Spoofed forwarding values produced the same observed rate-limit partition, confirming Nginx replacement at the trusted boundary.
- The canonical www origin receives the expected credentialed CORS response; an attacker origin receives `403` without an allow-origin header.
- The deployed Nginx file exactly matches the reviewed Phase 11 configuration, SHA-256 `5c619ce679f72849fe003a75c373f5b5ab30f46b5f782853661e624ddf3f3bee`.

The exact released frontend entry is `assets/index-BHeaMA6e.js` at 373,517 bytes (118,957 gzip), still 30.9% below the Phase 9 entry. The largest public route, admin route and CSS remain within the enforced Phase 10 budgets.

## Dependency review

`npm audit --omit=dev --audit-level=moderate` reports four moderate backend findings in Prisma CLI/Studio transitive packages. The cited Hono static-file and Valibot record-flattening paths are not imported by the production Express application, and Prisma Studio is not a production service. A forced breaking update was not applied.

The frontend audit reports two high findings for React Router's unstable React Server Components APIs. This application is a client-only Vite build served as static files and does not import or run the affected RSC server/action APIs. The available remediation is a major-version change, so the advisory is documented for monitoring rather than forced into this release.

These applicability decisions do not dismiss the advisories: dependency updates should be retested when compatible non-breaking releases or relevant runtime changes become available.

## Recovery and rollback

The protected directory `.phase0-backups/20260722-204951` remains mode `0700`. Its Phase 11 files are mode `0600`, and the complete `SHA256SUMS` manifest verifies:

| Asset | SHA-256 |
|---|---|
| `database-pre-phase11.dump` | `2f7d98353596d8ee133dec2689813fa4c5d5fae111b539c776cddafbbe7d89cb` |
| `frontend-dist-pre-phase11.tar.gz` | `31b105d9cbc179b5a88c554ebc030dcb8db0b4542ad98c4c8aad4d3c0d0d5c74` |
| `nginx-site-pre-phase11.conf` | `e07c0b96527163ca4bdea1349d6bf35cd76b4292b58eba76a28accb9228bafe5` |
| `backend-env-pre-phase11` | `a018811a9290b8e205a005439852bad43484e1540a8017c59d4dbc52486e7a28` |
| `phase11-code-preimage.tar.gz` | `deafcc6980bcbc0a447296237d9d9ce9f699d76ac063fc654edcb8a99d947bac` |

The database dump has a valid `pg_restore` catalog and predates the migration. A coherent full rollback restores the protected code, environment, database, frontend and Nginx artifacts together, then rebuilds generated backend output and restarts the service. No rollback action was required.

## Deferred inputs

SMTP and WhatsApp production activation, Turnstile credentials, the official LinkedIn URL, complete legal company particulars and final supplied-image publication approval remain disabled or pending. No credential, provider identifier, legal fact or publication approval was invented or changed. The pending kernel upgrade also remains outside this audit and requires separately authorized maintenance.

Phases 0–11 are now complete. Any subsequent work begins only after the owner supplies and explicitly approves the relevant deferred inputs.
