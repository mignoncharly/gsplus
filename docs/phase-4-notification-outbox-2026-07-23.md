# Phase 4 — Transactional notification outbox and consent

Date: 2026-07-23  
Canonical origin: https://gsplus.vip  
Status: complete; deployed and verified in production

## Acceptance contract completed

- C-03: booking, payment and lead notifications are queued in an idempotent database outbox instead of being sent synchronously during public or admin requests.
- C-03: workers claim due events atomically, recover stale locks, apply bounded exponential backoff and cannot redeliver an event already marked sent.
- C-03: provider failures are reduced to bounded operational codes; SMTP/provider details and credentials are not exposed in stored errors or API responses.
- H-06: WhatsApp Business delivery is feature flagged and implements template delivery, E.164 normalization, explicit transactional consent, provider message IDs, HMAC-verified webhooks, delivery receipts and the same retry controls.
- H-06: WhatsApp payloads contain only the customer first name, booking reference and formatted appointment time required by the template.
- M-11: legal text has a minimum content requirement, cannot be approved without text or with a future date, and any text change clears its previous approval until reviewed again.

## Backend and database

Migration `20260723161000_phase_4_notification_outbox` adds:

- `PROCESSING` to `NotificationStatus`;
- `Reservation.whatsappConsentAt` and `Lead.whatsappConsentAt`;
- `NotificationEvent.lockedAt` and `lastWebhookAt`;
- an index supporting stale-lock recovery.

Notification behavior:

- deterministic unique keys make booking, status, payment and lead queue operations idempotent;
- SMTP uses a deterministic message ID based on the outbox key;
- one atomic `PENDING` to `PROCESSING` claim gates delivery;
- failures retry after 1, 2, 4, 8 minutes, capped at one hour and bounded by `maxAttempts`;
- in-progress and delivered records are protected from resend; terminal failures require an explicit audited manual retry;
- authenticated manual retry writes an `AuditLog` record;
- the worker starts and stops with the backend process and does not overlap its own polling cycles.

WhatsApp webhook endpoints:

```text
GET  /api/webhooks/whatsapp
POST /api/webhooks/whatsapp
```

The POST endpoint verifies `X-Hub-Signature-256` against the unmodified request body before accepting provider state. Unknown provider IDs are ignored safely.

## Frontend

- Reservation, contact, B2B and quote forms expose a separate optional transaction-only WhatsApp consent control.
- Contact accepts an optional phone number and requires it only if WhatsApp consent is selected.
- Public phone numbers are normalized and validated as E.164 by the server.
- Admin notification history now shows channel, state, attempt count, next retry, safe error and failed-event retry action.
- The admin copy covers both e-mail and WhatsApp rather than describing every event as an e-mail.

## Safe production configuration

The following delivery flags default to false and were not activated:

```text
EMAIL_DELIVERY_ENABLED=false
WHATSAPP_DELIVERY_ENABLED=false
```

The environment example documents worker settings, SMTP settings, WhatsApp Graph API settings and four empty template-name inputs. No credential, provider identifier, webhook secret or template name was invented, changed or rotated.

## Verification evidence

- Prisma schema formatting and client generation: pass.
- Backend TypeScript production build: pass.
- Backend Vitest suites: 33/33 tests passed across 2 files.
- Frontend ESLint: pass with zero warnings.
- Frontend Vite production build: pass.
- Idempotent double queue and concurrent delivery claim: pass; one adapter invocation and one sent record.
- Safe provider error, scheduled backoff and later successful retry: pass.
- Local Cameroon phone normalization and explicit consent timestamp: pass.
- Missing/future legal approval rejection and approval invalidation after text change: pass.
- Authenticated retry gating and audit logging: pass.
- WhatsApp HMAC signature and provider delivery receipt update: pass.

## Production rollout and smoke checks

- Additive production migration applied successfully; six migrations are recorded and no migration is pending.
- Backend restarted successfully at 2026-07-23 18:22:01 UTC under systemd.
- Service startup log reports the API listening on port 4000 with no startup error.
- Local and canonical API health checks returned HTTP 200.
- Unconfigured WhatsApp webhook verification returned HTTP 403.
- Unauthenticated notification administration returned HTTP 401.
- Production frontend bundle: `assets/index-Cs-Sjq5u.js`.
- Canonical and local bundle SHA-256: `6348f7ebcc12ed6a2b930412c4570326c28a335ab6839d83018efdb19b4c7b64`.

## Recovery assets

Protected directory:

```text
/var/www/goldenstudioplus/.phase0-backups/20260722-204951/
```

- `database-pre-phase4.dump`
- `frontend-dist-pre-phase4.tar.gz`

Both files are mode 0600, readable by their native tools, present in `SHA256SUMS`, and the complete manifest verifies successfully.

## Deferred inputs

SMTP credentials, WhatsApp Business credentials/provider identifier, webhook verification values and approved template names remain deferred until after Phase 11. Delivery flags must remain false until those inputs are supplied and a provider-specific staging test succeeds.
