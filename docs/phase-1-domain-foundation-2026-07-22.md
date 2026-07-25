# Phase 1 — Domain and Migration Foundation

Date: 2026-07-22
Canonical origin: https://gsplus.vip
Migration: 20260722214000_phase_1_domain_foundation
Status: complete; deployed and verified in production

## Implemented contract

- Reservation statuses: PENDING_CONFIRMATION, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW, REJECTED and EXPIRED.
- Payment statuses: PENDING, VERIFIED, REJECTED, FAILED, EXPIRED, REFUND_PENDING and REFUNDED.
- Reservation and payment status transitions are independent. Payment verification never confirms a reservation.
- Server-side transition matrices reject invalid transitions.
- Cancellation, rejection, expiration, no-show, restoration and refund-related transitions require a reason.
- Optimistic version fields prevent silent concurrent status overwrites.
- ReservationTransition and PaymentTransition preserve actors, reasons, timestamps and state history.
- Rescheduling history columns preserve old/new appointment instants for Phase 3 workflows.
- Payments record normalized transaction references, verification actor/time, refund amount/time and status reason.
- A unique constraint on payment method plus normalized transaction reference prevents duplicates.
- Tariffs support currency, delivery/legal/options fields, version, archive state and approval timestamp.
- PackageVersion provides immutable price/content snapshots; every reservation references the tariff version it booked.
- Notification records support idempotency keys, provider IDs/status, attempt counters, retry timing, delivery time, metadata and update time.
- Public availability and package endpoints ignore archived tariffs.
- Admin package edits create a new immutable version.
- Existing admin cancel/reject buttons collect the mandatory reason until the fuller Phase 3 interface replaces the temporary prompt.

## Production-data rehearsal

A fresh production snapshot was restored into the dedicated test database and the migration was applied successfully.

Verified backfill:

- 22 packages -> 22 initial package versions
- 4 reservations -> 4 required package-version links
- 4 reservations -> 4 initial transition-history records
- 4 payments -> 4 initial payment-history records
- 4 existing payment references -> 4 normalized references
- 14 notification events preserved with non-null updatedAt
- Legacy reservation statuses mapped to:
  - CANCELLED: 1
  - CONFIRMED: 1
  - PENDING_CONFIRMATION: 2
- Existing payment statuses preserved:
  - PENDING: 2
  - REJECTED: 1
  - VERIFIED: 1

The removed PENDING and PAYMENT_PENDING reservation enum values are absent from the migrated schema.

## Verification

- Prisma schema format/generation: pass
- Backend production build: pass
- Backend integration tests: 17/17 pass
- Frontend lint: pass
- Frontend production build: pass
- Exact production-data migration rehearsal: pass
- Legacy status source scan: pass
- Patch artifact scan: pass
- Production migration status: pass (database schema up to date; 4 migrations)
- Production backend service and canonical health endpoint: pass
- Production admin authentication/session creation: pass
- Production public package catalog: pass (22/22 active, unarchived and versioned)
- Production backfill and relational integrity checks: pass (zero inconsistencies)

New regression coverage proves:

- payment verification leaves reservation PENDING_CONFIRMATION;
- payment and reservation histories are created;
- rejection requires a reason;
- invalid reservation transitions return 409;
- normalized duplicate payment references return 409;
- tariff edits create a new version without modifying an existing reservation snapshot.

## Rollback

Fresh pre-migration snapshot:

/var/www/goldenstudioplus/.phase0-backups/20260722-204951/database-pre-phase1.dump

The file is mode 0600 and is included in the verified SHA256SUMS manifest.

## Production rollout

Migration `20260722214000_phase_1_domain_foundation` was applied successfully and `goldenstudioplus-backend` was restarted at 2026-07-22 22:21:35 UTC.

Post-deployment verification confirmed:

- the service is active/running and `https://gsplus.vip/api/health` returns HTTP 200;
- admin authentication succeeds and creates a session;
- all 22 public-eligible packages are returned by the canonical API;
- all 22 packages have a current immutable package version;
- all 4 reservations reference a matching package version and have transition history;
- all 4 payments have transition history and normalized transaction references;
- all 14 notification events have the required update timestamp;
- no duplicate normalized payment reference or migrated relational mismatch exists;
- reservation and payment enum labels exactly match the Phase 1 contract.
