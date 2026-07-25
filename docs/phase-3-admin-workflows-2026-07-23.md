# Phase 3 — Admin workflows and tariff lifecycle

Date: 2026-07-23  
Canonical origin: https://gsplus.vip  
Status: complete; deployed and verified in production

## Acceptance contract completed

- M-01: admin payment verification now requires an operator reference, applies the Phase 2 method-specific validation/normalization rules, and leaves verification manual.
- M-06: reservation, payment, lead, notification, calendar and actor states are presented in French; administrative state changes require confirmation and mandatory reasons where applicable.
- M-06: reservation and payment histories display the previous state, new state, reason, timestamp and responsible administrator/system actor.
- M-07: loading and action state are keyed by tab/action; feedback is scoped to the active tab, cleared on navigation, announced accessibly and receives focus.
- M-07/M-08 safeguard: availability and media forms reset only after a successful action and retain their values after failure.
- M-11: tariff administration supports create, duplicate, preview, full content/price editing, ordering, activation, deactivation, archive/restore and protected deletion.
- M-11: every create, duplicate and edit operation creates an immutable package version; referenced packages return `PACKAGE_IN_USE` and must be archived instead of deleted.

## Backend

Added authenticated endpoints:

```text
POST   /api/admin/packages
POST   /api/admin/packages/:id/duplicate
DELETE /api/admin/packages/:id
```

Expanded behavior:

- `GET /api/admin/packages` returns reservation and reservation-intent reference counts.
- Package create/duplicate/update operations write immutable `PackageVersion` snapshots.
- Slugs, currencies, durations, prices, legal fields, JSON options, archive state and sort order are server validated.
- Destructive package deletion is transactionally rejected when any reservation or reservation intent references the package.
- Reservation detail responses include administrator identity on reservation and payment transitions.
- Package lifecycle actions are recorded in the audit log.

No database migration was required in Phase 3; the Phase 1 schema already contained the necessary domain and history fields.

## Frontend

- Added French labels for all admin-visible workflow states.
- Reservation controls are derived from the server transition contract, including restoration paths.
- Invalid transitions are not offered by the interface.
- Payment verification prompts for the real transaction reference before the server validates it.
- Reservation and payment histories expose actor, old/new state, reason and time.
- Package controls cover the full lifecycle and disable destructive deletion when reference counts are non-zero.
- Package preview includes price, duration, delivery, publication state, version and legal text.
- Feedback and progress no longer leak between tabs.

## Verification evidence

- Backend TypeScript production build: pass.
- Backend Vitest suites: 26/26 tests passed across 2 files.
- Frontend ESLint: pass with zero warnings.
- Frontend Vite production build: pass.
- Focused French-label, restoration-action, actor-label and reference-count assertions: pass.
- Package create, duplicate, versioned edit, unreferenced delete, referenced-delete rejection and archive integration test: pass.
- Admin invalid-reference rejection preserves `PENDING` payment state: pass.
- Actor/old/new/reason reservation-history integration test: pass.
- Unauthenticated new package route returns HTTP 401 in production.
- Authenticated read-only production smoke: 22 packages and 4 reservations; reference counts and actor-aware history shapes present.

## Production rollout

- Backend restarted successfully at 2026-07-23 15:44:46 UTC.
- Local and canonical API health checks returned HTTP 200.
- Production frontend bundle: `assets/index-BbPnbayr.js`.
- Canonical host serves the staged JavaScript bundle byte-for-byte.
- Admin smoke session was logged out immediately after verification.
- No credentials or secrets were changed or rotated.

## Rollback

Protected directory:

```text
/var/www/goldenstudioplus/.phase0-backups/20260722-204951/
```

Rollback assets:

- `database-pre-phase3.dump`
- `frontend-dist-pre-phase3.tar.gz`

Both files are mode 0600, readable by their native tools, and included in the fully verified `SHA256SUMS` manifest.

## Deferred inputs

Provider credentials, final legal/company approvals, official social URLs and final image approval remain deferred until after Phase 11 as requested. Phase 3 did not invent or approve any missing legal fact.
