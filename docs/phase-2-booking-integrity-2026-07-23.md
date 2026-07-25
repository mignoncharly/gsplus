# Phase 2 — Booking integrity and timezone consistency

Status: Complete and deployed to production on 2026-07-23 UTC.

Canonical host: `https://gsplus.vip`

## Scope completed

- C-01: all booking instants use canonical UTC storage and explicit `Africa/Douala` business-time formatting.
- C-02: the server issues one unique reservation reference before payment and reuses it idempotently.
- C-04: availability-block create, edit, and delete operations are transactionally locked and immediately affect public slots.
- H-07: calendar and free-proposal modes clear stale state; Continue requires the exact freshly verified selection.
- M-01: MTN MoMo and Orange Money transaction references are normalized, validated, and unique per method.

## Implementation

- Added short-lived `ReservationIntent` records with unique idempotency keys and references.
- Added migration `20260722230000_phase_2_booking_integrity`.
- Added PostgreSQL transaction advisory locks around booking and availability-block windows.
- Made active, unconsumed intents participate in public availability and overlap rejection.
- Final reservation creation consumes the intent and copies its reference and canonical slot atomically.
- Idempotent finalization returns the existing reservation and does not duplicate notifications.
- Added shared backend and frontend Douala-time helpers.
- Added admin availability-block editing and Douala-local datetime conversion.
- Added method-specific operator-reference normalization and validation while preserving manual verification.

## Verification evidence

- Backend integration and calendar suites: 23/23 tests passed.
- Backend TypeScript production build: passed.
- Frontend ESLint: passed.
- Frontend Vite production build: passed.
- Cross-timezone browser helper checks passed under UTC, Africa/Douala, and Europe/Berlin.
- Midnight case `2030-01-15T23:30:00.000Z` consistently rendered as 2030-01-16 00:30 Douala in every tested host timezone.
- Concurrent same-slot intent test produced exactly one accepted hold.
- Idempotent retry test produced one reservation, one reference, and no duplicate notifications.
- Availability-block create/edit/delete integration test immediately changed public slot results.
- Production-snapshot migration rehearsal succeeded in `goldenstudioplus_db_test`.

## Production rollout

- Pre-migration database snapshot created and verified.
- Production migration applied successfully; Prisma reports five migrations and an up-to-date schema.
- Backend restarted successfully at 2026-07-23 11:13:39 UTC.
- Backend health passed locally on port 4000 and through `https://gsplus.vip/api/health`.
- Phase 2 frontend bundle `assets/index-wbLk8eon.js` published and confirmed through the canonical host.
- Live frontend matches the staged bundle byte-for-byte.
- Read-only availability smoke check returned `Africa/Douala` and mapped 09:00 Douala to 08:00Z.
- Invalid empty intent request returned HTTP 400 and created no data.

## Rollback assets

Protected directory: `.phase0-backups/20260722-204951/`

- `database-pre-phase2.dump`
- `frontend-dist-pre-phase2.tar.gz`
- `SHA256SUMS`

All listed backup checksums and archive/dump readability checks passed. Files are owner-restricted where sensitive.

## Deferred inputs

Provider credentials, legal approvals, business content decisions, and the other owner-supplied inputs remain deferred until after Phase 11, as requested. No credentials were changed or rotated during Phase 2.
