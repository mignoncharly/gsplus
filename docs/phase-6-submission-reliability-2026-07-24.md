# Phase 6 — Submission reliability and stale-state protection

Date: 2026-07-24  
Canonical origin: https://gsplus.vip  
Status: complete; deployed and verified in production

## Acceptance contract completed

- Contact, B2B and quote submissions capture their form before asynchronous work, reset only after confirmed success and cannot show a false failure caused by a cleared React event target.
- A synchronous in-flight guard prevents rapid repeat clicks; retries reuse the same submission key, while a completed submission receives a new key.
- The server stores at most one lead and queues at most one notification for a submission key, including concurrent requests.
- Portfolio create/upload forms use the same success-only reset behavior and do not replace a successful result with a reset exception.
- Proposed-time availability requests are version-gated. Changing mode or day invalidates pending work, so a stale response cannot restore an old slot or clear a newer loading state.
- Phase 6 forms now expose associated labels, names, autocomplete metadata, described errors and live success/error regions. The global axe and keyboard acceptance checks remain assigned to Phase 7 under H-03.

## Backend and database

Migration `20260724100000_phase_6_lead_submission_safety` adds an optional, uniquely indexed `Lead.submissionKey`. The migration is additive and leaves existing rows valid.

The contact, corporate and quote endpoints now use one shared lead-submission service. Client keys are namespaced by lead source, and both normal retries and concurrent unique-key races resolve to the original lead. Notification outbox enqueueing also resolves a concurrent unique-key race to the existing notification rather than producing a second queued delivery or an error.

Request validation requires a UUID submission key for these three current public clients. No credential, provider setting or production configuration was changed.

## Frontend

- `lead-submission.js` owns stable retry keys, the synchronous repeat guard, captured-form handling and success-only reset behavior.
- Contact, corporate and both quote entry points use this controller and surface accessible busy, success and error state.
- Portfolio block and media forms reset through the tested success-only helper.
- `latest-request.js` protects reservation availability state from out-of-order responses and explicitly invalidates prior work on mode/day changes.
- A reusable visually-hidden label class supports compact quote controls without removing their accessible names.

## Verification evidence

- Prisma schema formatting and typed-client generation: pass.
- Phase 6 migration against the isolated test database: pass.
- Backend TypeScript production build: pass.
- Backend Vitest suites: 40/40 tests passed across 2 files.
- Concurrent contact and B2B submissions: pass with one lead ID, one database lead and one notification.
- Frontend Node regression suites: 5/5 tests passed.
- Async form-target reset, retry-key reuse, rapid repeat guarding and portfolio reset regression tests: pass.
- Stale reservation request invalidation and newest-request ownership tests: pass.
- Frontend ESLint: pass with zero warnings.
- Isolated frontend Vite production build: pass.

Vite continues to report that the primary bundle is above its 500 kB advisory threshold. Route splitting and the broader performance budget remain explicit later-phase obligations in the acceptance matrix.

## Production rollout and smoke checks

- Protected pre-rollout database and frontend backups were created and verified before migration and publication.
- Additive production migration applied successfully; eight migrations are recorded and none is pending.
- The isolated verified frontend output was published with exact deletion semantics only after backup, tests, lint and build passed.
- Backend restarted successfully at 2026-07-24 11:31:05 UTC under systemd and remained active.
- Local and canonical API health checks returned HTTP 200.
- Canonical `/contact` returned HTTP 200 and served `assets/index-14Nmqubo.js` plus `assets/index-UczE9D3a.css`.
- An intentionally invalid canonical contact request returned HTTP 400 and could not create production data.
- Canonical and local JavaScript bundle SHA-256: `7c51d05415d3ecec96c33e58d950482a1060d30854cc878480ef4c6d829c3d66`.

## Recovery assets

Protected directory:

```text
/var/www/goldenstudioplus/.phase0-backups/20260722-204951/
```

- `database-pre-phase6.dump`
- `frontend-dist-pre-phase6.tar.gz`

Both files and `SHA256SUMS` are mode 0600. The database archive is readable by `pg_restore`, the frontend archive is readable by `tar`, and the complete checksum manifest verifies successfully.

Recorded checksums:

- database: `67b00124f08312b421ae71fa2b648b72b8c125ac95474cab87cbe90ece7dbdc6`
- frontend: `368db2d797a92d034a79f42171376968f98d9b7bc8ab3f93c96ea85a1ff9c378`

## Deferred scope

- H-03 remains open through Phase 7 for the global axe and keyboard acceptance pass.
- M-08's reset/false-failure defect is complete; Phase 8 still owns portfolio curation and media coverage.
- Route splitting and broader performance safeguards remain later-phase obligations.
- SMTP credentials, WhatsApp Business credentials and templates, official social URLs, complete legal company particulars and final supplied-image approval remain deferred until after Phase 11, as requested. No deferred value was invented or activated in Phase 6.
