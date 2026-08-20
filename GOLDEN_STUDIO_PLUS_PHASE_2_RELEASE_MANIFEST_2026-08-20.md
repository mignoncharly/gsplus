# Golden Studio Plus — Phase 2 production release manifest

Date: 20 August 2026 (UTC)

Runtime revision: `16c933302ec17b8b230f7a3b24df05e60c85731c`

Branch: `codex/phase2-scheduling-20260820`

Disposition: **deployed; Phase 2 scheduling gate passed with documented WebKit endurance crashes recovered unchanged**

## Released scope

- Explicit `STANDARD_HOLD` and `CUSTOM_PROPOSAL` schedule states across reservation intents, reservations, and immutable snapshots.
- Custom date/time proposals persist their requested Douala start/end/time zone but neither reserve a slot nor consume availability or Happy Hours quota.
- Studio confirmation of a custom proposal locks the booking window and reruns the authoritative conflict, opening-hour, eligibility, and package-quota checks inside the confirming transaction; only a successful confirmation converts it to a blocking standard schedule.
- Public copy consistently describes custom times as requested and unconfirmed. The admin list and dossier distinguish non-blocking proposals and explain the confirmation-time revalidation.
- Durable two-step reschedule behavior remains intact, with browser proof for date-time persistence through focus changes, API refresh, and full reload.
- Availability-block creation and editing now have equivalent persistence proof.
- Two stale Phase 1 browser contracts were aligned with the deployed private `internalReason` boundary; the LEG-05 native-details interaction now synchronizes on its governance API for WebKit stability.

## Immutable data and rollback evidence

- Pre-migration encrypted PostgreSQL backup: `.phase2-backups/20260820T154914Z-pre-phase2-release/database.dump.enc`.
- SHA-256: `e250ff121cdfbe1e79f98f561eced9919ad17ced2c3144723aa793a61cffbe1d`.
- Protection: AES-256-CBC, PBKDF2 200,000 iterations, mode `0600`; decrypted restore catalogue verified successfully and the temporary plaintext copy securely removed.
- Additive migration `20260820133000_phase_2_schedule_proposals` applied successfully; production is 34/34 with no pending migration.
- Application rollback point: `2794a08bd9da173899cdc08a67056eaaa8f50d8e` (Phase 1 runtime). Retain the additive schedule columns, enum values, requested-time evidence, and immutable snapshot evidence during an application rollback.
- No production reservation, lead, payment, notification, availability block, or external calendar event was created by release validation. Production browser API journeys were intercepted in-browser and stateful only inside each test.

## Automated evidence

- Backend: 24 files, 178/178 tests; TypeScript build passed.
- Phase 2 integration: non-blocking proposal over a blocked window; confirmation rejected while conflicted and accepted only after release; immutable custom snapshot retained.
- Happy Hours: six active holds consume the daily quota; concurrent overflow attempts receive `PACKAGE_DAILY_QUOTA_REACHED`; another eligible day remains available; expired intents are excluded; rescheduling away releases the prior day; availability display and enforcement agree.
- Calendar invariant: the existing event is updated on reschedule, the returned replacement event ID becomes authoritative, cancellation targets that current ID, and three versioned sync records are retained without creating a second usable current event.
- Frontend: 98/98 tests; ESLint, client-only assertion, Vite build, 11 public/3 private prerenders, performance budgets, and tracker audit passed.
- Local Phase 2 and changed-contract browser matrix: 22 scenarios across Chromium/WebKit, with the only WebKit click race hardened; final Phase 2 persistence rerun passed 4/4.
- Full local browser endurance: Chromium 75/75; combined run 148/150. The LEG-03 WebKit page-process failure passed unchanged in a focused run; LEG-05 exposed a native-click synchronization weakness in the test, was hardened to wait on its governance API and details state, then passed 2/2. All changed contracts subsequently passed in both engines. No reproducible product assertion remains.

## Production evidence

- Migration `20260820133000_phase_2_schedule_proposals` applied at 15:50 UTC; Prisma reports 34 migrations and an up-to-date schema.
- Backend restarted from the release build at `2026-08-20 15:51:24 UTC`; systemd is active/running with main PID `85566`.
- `https://gsplus.vip/api/health` returned HTTP 200 with `{"status":"ok","service":"golden-studio-plus-api"}`.
- Nginx serves frontend asset `assets/index-BPOPpDtQ.js`; SHA-256 `9bf2853893f699bca32d527194cda71076f7faeb3fe3f27427fe858847a0b307`, with the hardened CSP/HSTS response set.
- Phase 2 production browser proof: Chromium 5/5; WebKit 4/5 in the combined invocation, where the final page crashed at engine level during a reload after create/edit assertions; that exact case passed unchanged 1/1 in a fresh WebKit process.

## Phase 2 exit gate

| Requirement | Verdict |
|---|---|
| Custom proposal is unambiguous and non-blocking | **Met** — persisted kind/time zone, public/admin copy, availability exclusion, and acceptance-time lock are covered |
| Admin reschedule and block edits persist after refresh | **Met** — Chromium/WebKit browser cases edit, blur/focus, submit, API-refresh, fully reload, and verify |
| Confirmed reschedule keeps one authoritative calendar event | **Met** — update uses the original ID, stores the replacement ID, and later cancellation targets only the replacement |
| Seventh Happy Hours booking is rejected by the server | **Met** — concurrency integration proves the daily quota error and display/enforcement agreement |
| Production schema, runtime, health, and browser proof | **Met** — 34/34, service restarted, HTTPS health 200, production Chromium/WebKit proof complete |
