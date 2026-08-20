# Golden Studio Plus — Phase 1 production release manifest

Date: 20 August 2026 (UTC)

Runtime revision: `2794a08bd9da173899cdc08a67056eaaa8f50d8e`

Branch: `codex/phase1-communication-20260820`

## Released scope

- Strict persistence boundary between mandatory private operational reasons and approved FR/EN customer copy for adverse reservation, payment, reschedule, withdrawal, cancellation, and expiry decisions.
- Authenticated, side-effect-free customer-message preview rendered by the same backend template path used by the outbox; admin mutation requires a fresh matching preview where customer delivery applies.
- Financially neutral studio-cancellation and paid-rejection copy; E-20 and E-21 remain gated by their persisted payment, financial-task, channel, reference, and completion-evidence states.
- One semantic `TransactionalWhatsAppConsent` component across Services, Corporate, Contact, and Creative Services, with shared high-contrast tokens, visible focus, 44 px target, and help/error associations.

## Immutable data and rollback evidence

- Pre-migration encrypted PostgreSQL backup: `.phase1-backups/20260820T124455Z-pre-phase1-release/database.dump.enc`.
- SHA-256: `dadd5e35f9c8107c3d6f20755fc6a98d066bddc79bab864a0e74f4bf32d9f7d2`.
- Protection: mode `0600`; decrypted restore catalogue verified at 312 entries; temporary plaintext removed.
- Additive migration `20260820120000_phase_1_customer_copy_boundary` applied successfully; production is 33/33 with no pending migration.
- Application rollback point: `c3888fa5606fc9a159f12a8e5c5ace04bd06fcfd`. Retain the additive Phase 1 columns and historical transition evidence during an application rollback.

## Automated evidence

- Backend: 23 files, 176/176 tests; TypeScript build passed.
- Frontend: 98/98 tests; ESLint, Vite production build, prerender, performance budgets, client-only assertion, and tracker audit passed.
- Confidentiality sentinel: `TEST-AUDIT`, `paiement simulé`, and the private instruction are absent from subject, preheader, text, HTML, WhatsApp events, and persisted customer-visible copy; preview and stored notification render are byte-for-byte equal in the tested paid-rejection journey.
- Neutral finance/state evidence: initial adverse copy contains no amount or refund promise; E-20/E-21 tests reject missing prerequisite state/evidence and allow their proper persisted states.
- Local browser matrix: 8/8 in Chromium/WebKit across FR/EN and 1280 × 900 / 390 × 844; all four forms are exercised per case.

## Production evidence

- Backend unit restarted from the release build at `2026-08-20 12:46:46 UTC`; service active/running.
- `https://gsplus.vip/api/health` returned HTTP 200 with `{"status":"ok","service":"golden-studio-plus-api"}`.
- Frontend asset `assets/index-DKrVNJJc.js` served with HTTP 200 and the hardened CSP/HSTS header set.
- Phase 1 production browser matrix passed 8/8 in Chromium/WebKit. Axe injection used Playwright's test-only `bypassCSP`; the production CSP was not changed.

## Acceptance ledger

| Finding | Disposition | Evidence still required |
|---|---|---|
| `MAIL-01` | Locale is derived from immutable snapshots and covered by FR/EN rendering tests | Human receipt proof for representative external FR/EN journeys |
| `MAIL-02` | Released; no customer renderer reads an internal-reason field | Owner sign-off after an authorised representative external journey |
| `MAIL-03` | Released; initial copy is neutral and E-20/E-21 are state-gated | Authorised live paid-cancellation journey, including provider receipt |
| `UI-01` | Released; four-form local and production matrices passed | Owner visual sign-off remains optional release governance evidence |

Meta/WhatsApp delivery remains feature-gated and unconfigured. This release proves consent semantics and outbox isolation, not external WhatsApp delivery.
