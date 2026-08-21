# Golden Studio Plus — Phase 4 release manifest

**Release date:** 21 August 2026
**Branch:** `codex/phase4-finance-admin-20260820`
**Implementation revisions:** `476e145`, `fe53974`
**Production host:** `https://gsplus.vip`

## Released scope

- Owner-authorised, paginated financial-task queue with status, overdue, reservation-reference, and operator filters.
- Financial-task detail and evidenced refund progression through the existing refund command; no bypassing generic completion endpoint was added.
- Stable reservation, lead, and finance administration destinations, including destination restoration after authentication and explicit stale/not-found states.
- Durable, unique lead references populated by migration `20260820200000_phase_4_lead_reference`.
- Localised subjects, business-facing payment/status labels, locale-aware duration text, optional-organisation suppression, and corrected dashboard lead labelling.
- Nginx SPA fallback for read-only `/admin/*` routes while retaining method restrictions and `noindex` administration markup.

## Production safety and database evidence

- Encrypted pre-release database backup: `.phase4-backups/20260821T063936Z-pre-phase4-release/database.dump.enc`.
- Backup SHA-256: `2ddefd4d460dd7d073cccf7ddb15ae997d5ead10d13bcf3028a1a82577ee8e1b`.
- Backup format: AES-256-CBC, PBKDF2 (200,000 iterations); decrypted catalogue and restore readability verified before plaintext was shredded.
- Migration state after deploy: `36/36` migrations applied.
- Lead backfill result: 13 of 13 leads referenced, with 13 distinct references.
- Backend restarted under systemd and reported healthy locally and publicly.
- Deployed frontend entry `assets/index-hVh5N15O.js` matched the local release SHA-256 `56428b8da45ba7c65e5572a274bbd2564d177b388332eaeb085753cf23e94240`.

## Verification evidence

- Backend test suite: 26 files, 187 tests passed.
- Frontend test suite: 101 tests passed.
- Phase 4 Chromium browser tests: 2 tests passed.
- Backend and frontend production builds passed.
- Lint and tracker audit passed.
- Performance budgets passed: entry 267,418 bytes; admin chunk 56,986/57,000 bytes; CSS 84,966/85,000 bytes.
- Nginx security/fallback contract: 4 tests passed; live Nginx configuration validated and service active.
- Authenticated production smoke proved reservation `GSP-260816-P5P7`, lead `DEVIS-ED02D790D5`, and the owner financial-task list/detail contract.
- Live direct-route checks returned HTTP 200, `text/html`, the administration shell, and `noindex` for:
  - `/admin/reservations/GSP-260816-P5P7`
  - `/admin/leads/DEVIS-ED02D790D5`
  - `/admin/finance/task-stale-proof`

## Exit gate

| Requirement | Production evidence | Result |
| --- | --- | --- |
| Every open financial task is visible and actionable by an authorised owner | Authenticated API smoke plus queue/detail/action integration and browser coverage | Passed |
| Client notification occurs only after evidenced initiation/completion | Existing versioned refund command retained; dedupe and evidence tests passed | Passed |
| Every internal e-mail link opens its intended record | Stable-reference routing tests and live direct-route checks passed | Passed |
| No placeholder or raw enum appears in human-facing e-mail copy | FR/EN editorial formatter and template tests passed | Passed |

Phase 4 is closed in production. Phase 5 may proceed from revision `fe53974` plus this release-record commit.
