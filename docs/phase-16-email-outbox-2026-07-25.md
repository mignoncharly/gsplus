# Phase 16 — Email outbox closure

Date: 2026-07-25 UTC
Status: COMPLETE for e-mail; WhatsApp DEFERRED BY OWNER
QA run: `QA-GSP-20260725-001`

## Implemented

- Added explicit dead-letter disposition fields: `resolution`, `resolutionNote`, `resolvedAt`, `resolvedBy`, and `replacementEventId`.
- Added an authenticated resolution endpoint and admin controls.
- Resolved events cannot be retried unless explicitly marked `ACTIONABLE_REVIEW_REQUIRED`; an explicit retry clears that disposition and remains audited.
- Added migration `20260725143000_phase_16_dead_letter_resolution` and applied it after a verified production database dump.
- Normalized unsafe historical provider errors to stable, non-secret error codes.
- Added dry-run-first classification and exactly-once e-mail QA scripts.

## Historical failures

The exact 14 historical failed e-mail events were reviewed without bulk resend:

- 6 obsolete events tied to cancelled or archived records: `OBSOLETE`.
- 8 potentially relevant events: `ACTIONABLE_REVIEW_REQUIRED` for individual owner review.
- No historical event was requeued or sent by the classification.

Calendar history was normalized separately: four legacy failures now use `CALENDAR_LEGACY_PROVIDER_FAILURE`; two skipped events retain their explicit safe reason. No `[object Object]` error remains.

## Controlled delivery

One idempotent e-mail event was generated for `QA-GSP-20260725-001`:

- Lead ID: `cms0gri860000qauu80ppc573` (final status `ARCHIVED`).
- Notification ID: `cms0gri8m0001qauu4j3i8mrp`.
- State: `SENT`; attempt count: 1; provider status: `accepted`.
- Provider message ID: `<lead:cms0gri860000qauu80ppc573:created:email:admin@notifications.gsplus.vip>`.
- Reprocessing returned `skipped`; exactly one event exists for the idempotency key.

The later Phase 17 run also produced six distinct intended e-mails, all `SENT`, attempt count 1, provider status `accepted`, with zero pending notification globally after cleanup.

## Evidence and limits

- Pre-migration dump: `.phase0-backups/20260725-143000-pre-phase16/database-pre-phase16.dump`.
- SHA-256: `cf9f5787ed1f1f43848391a772bb67d19f8024e556cf163400a0acf9b01c4357`.
- `pg_restore -l` validated the catalog.
- Application/provider acceptance is proven. Final human mailbox receipt remains `OWNER_CONFIRMATION_REQUIRED` because this session has no mailbox access.
- WhatsApp remains disabled and deferred by the owner. No WhatsApp credential was invented or changed.
