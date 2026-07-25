# Phase 5 — Safe rescheduling and calendar reliability

Date: 2026-07-24  
Canonical origin: https://gsplus.vip  
Status: complete; deployed and verified in production

## Acceptance contract completed

- Rescheduling is an explicit authenticated admin operation and is limited to `PENDING_CONFIRMATION` and `CONFIRMED` reservations.
- Every reschedule requires a reason, rechecks business hours, availability blocks, active reservation overlap and temporary holds, and preserves the package-version duration.
- The schedule update is serializable, protected by the booking-window advisory lock and an optimistic reservation-version check.
- The reservation transition ledger records actor, reason, old start/end, new start/end and `RESCHEDULE` metadata without changing the business status.
- Rescheduling queues a versioned customer notification; WhatsApp remains consent-gated and provider activation remains deferred.
- Calendar/provider failure is visible and retryable and never rolls back or silently rewrites reservation status.

## Backend and database

Migration `20260723190000_phase_5_calendar_reliability` extends `CalendarSyncLog` with:

- operation action and a unique deterministic idempotency key;
- provider status and bounded safe error storage;
- attempt count, maximum attempts, last-attempt time and stale-lock time;
- update time plus indexes for reservation history and claim recovery;
- normalized uppercase states for legacy rows.

The authenticated endpoint is:

```text
PATCH /api/admin/reservations/:id/reschedule
```

The calendar workflow now:

- creates one operation per reservation version and calendar action;
- atomically claims `PENDING`, `FAILED` or `SKIPPED` work and recovers stale `PROCESSING` locks;
- safely resolves concurrent first-time inserts after a real unique-key race was detected by the regression suite;
- reuses the same failed ledger row for an explicit retry instead of creating duplicate provider work;
- creates, reschedules or cancels Cal.com bookings according to reservation status and the prior external event ID;
- stores bounded operational codes rather than raw provider response bodies;
- treats obsolete operations as superseded instead of applying stale state;
- leaves the reservation transaction committed when the provider is unavailable and returns the visible sync result to the admin.

The Cal.com API version remains configurable. Its compatibility default is `2024-06-14`, matching the production integration that was already active. No provider credential, event type or production environment value was changed or rotated.

## Frontend

- Active reservations expose a guarded `Déplacer le créneau` action using Douala local time and a mandatory reason.
- The reservation detail displays the latest calendar state, action, attempt count, last attempt, external event ID and translated safe error.
- The full calendar ledger is visible in reverse chronological order.
- Failed or skipped operations expose `Réessayer la synchronisation`; an in-progress operation disables duplicate submission.
- Reservation history displays the old and new appointment times for reschedules.
- Calendar actions are restricted to statuses that have a defined provider action.

## Verification evidence

- Prisma schema formatting and typed-client generation: pass.
- Phase 5 migration against the isolated test database: pass.
- Backend TypeScript production build: pass.
- Backend Vitest suites: 38/38 tests passed across 2 files.
- Reschedule success, immutable duration, history, audit and notification: pass.
- Collision rollback and terminal-state protection: pass.
- Concurrent calendar delivery deduplication: pass with one adapter call and one ledger row.
- Failed-operation retry in the same row: pass.
- Raw provider-error privacy and configurable API-version header: pass.
- Frontend ESLint: pass with zero warnings.
- Frontend Vite production build: pass.

## Production rollout and smoke checks

- Protected pre-rollout database and frontend backups were created and verified before migration.
- Additive production migration applied successfully; seven migrations are recorded and none is pending.
- Backend restarted successfully at 2026-07-24 08:00:57 UTC under systemd.
- The service remained active after startup and reported the API listening on port 4000 without an error.
- Local and canonical API health checks returned HTTP 200.
- Unauthenticated access to the reschedule endpoint returned HTTP 401.
- Live Cal.com health returned `ok: true`, configured, event type `5733625` found and API version `2024-06-14`.
- Production frontend bundle: `assets/index-B_2ETv_t.js`.
- Canonical and local bundle SHA-256: `998ea134f65e269416473fe435f3c8a727093c1b5155ad2171e94b2503d3e038`.

## Recovery assets

Protected directory:

```text
/var/www/goldenstudioplus/.phase0-backups/20260722-204951/
```

- `database-pre-phase5.dump`
- `frontend-dist-pre-phase5.tar.gz`

Both files and `SHA256SUMS` are mode 0600. The database archive is readable by `pg_restore`, the frontend archive is readable by `tar`, and the complete checksum manifest verifies successfully.

## Deferred inputs

SMTP credentials, WhatsApp Business credentials and templates, official social URLs, complete legal company particulars and final supplied-image approval remain deferred until after Phase 11, as requested. No deferred value was invented or activated in Phase 5.
