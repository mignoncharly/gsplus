# Phase 0 — July 2026 Audit Remediation Baseline

## Decisions

- Canonical origin: https://gsplus.vip
- Business timezone: Africa/Douala
- Acceptance contract: docs/audit-acceptance-matrix-2026-07-22.md
- Provider, LinkedIn, legal-identity and final image-approval inputs are deferred until after Phase 11. Dependent features remain safely disabled/non-production until configured.
- Supplied media will be normalized, optimized and curated in Phase 8; masters remain unchanged in docs/images_logos.

## Baseline verification

Executed before implementation on 2026-07-22 UTC:

| Check | Result |
|---|---|
| Frontend ESLint | Pass |
| Frontend Vite production build | Pass |
| Backend TypeScript build | Pass |
| Backend Vitest | 13/13 pass across 2 files |
| Repository-owned browser/E2E suite | Missing |

Frontend build baseline:

- JavaScript: 492.17 kB raw / 147.01 kB gzip
- CSS: 64.34 kB raw / 11.42 kB gzip
- Current tests omit notification delivery, real timezone boundaries, public browser flows, accessibility and responsive layouts.
- A legacy test expects payment verification to confirm a reservation; it must be replaced because that rule is no longer valid.

## Pre-change backup

- Backup ID: 20260722-204951
- Private location: /var/www/goldenstudioplus/.phase0-backups/20260722-204951
- Directory mode: 0700
- Contents: PostgreSQL custom dump, source/audit archive, uploads archive, protected runtime configuration archive, integrity manifest and admin credential receipt.
- .phase0-backups is excluded from source archives/version control.
- Nginx serves frontend/dist, so this directory is not publicly routed.

The runbook location /var/backups/goldenstudioplus could not be created because this deployment account requires an interactive sudo password. The private project-local directory is the durable fallback for this remediation.

## Rollback order

1. Stop or isolate write traffic.
2. Restore the pre-change source archive.
3. Restore the PostgreSQL custom dump.
4. Restore uploads and protected configuration.
5. Deploy matching Prisma client/build artifacts.
6. Validate Nginx, restart the backend and run API/admin/public smoke tests.

No later migration may begin until all archives pass listing and checksum verification.

## Credential hardening

- The sole active OWNER password was replaced with a generated high-entropy password.
- The new password was verified through the local production login endpoint without printing it.
- The protected credential receipt is stored at .phase0-backups/20260722-204951/admin-credential.txt with mode 0600.
- ADMIN_SESSION_SECRET was rotated in backend/.env and that file was tightened from mode 0664 to 0600.
- The database records an ADMIN_CREDENTIAL_ROTATED audit event.
- Canonical API health remained OK after password rotation.

The backend was restarted successfully at 2026-07-22 21:25:19 UTC. Its working directory is backend, where application startup loads backend/.env; that file was modified before the restart. Post-restart service state is active/running, canonical API health passes and the rotated admin login returns HTTP 200 with a session cookie. Pre-rotation session cookies are therefore invalidated.

The separate docs/keys_deploy.md file remains unmodified at mode 0664 per the owner's explicit instruction not to rotate or change additional secrets. It contains plaintext production credentials; this risk is recorded but no action is authorized in Phase 0.

## Repository state limitation

This deployed tree has no usable .git repository. Immutable Phase 0 archives are therefore the rollback boundary. Changes must stay small, reviewable and individually verified until repository history is restored.

## Existing behavior to preserve

- Transactional reservation overlap protection
- Required public form checks
- Manual payments remain pending until admin action
- Backend Helmet and API rate limiting
- Backend availability considers reservations and availability blocks

These require expanded tests because timezone/UI boundaries can still defeat the intended behavior.
