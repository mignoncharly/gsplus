# Golden Studio Plus — Phase 0 release manifest

Manifest ID: `GSP-RC-2026-08-20-P0`

Recorded: 20 August 2026 (UTC)

Plan: `GOLDEN_STUDIO_PLUS_IMPLEMENTATION_PLAN_2026-08-19.md`

Disposition: **deployed; Phase 0 release gate passed with documented browser endurance flakes**

## Revision and artifact identity

| Item | Recorded value | Status |
|---|---|---|
| Repository branch | `main` | Informational |
| Repository `HEAD` | `7059faf1b4a42764f00d7fbc2584186d7c746bb8` (`Publish official French catalogue`, 9 August 2026) | Named base revision |
| Candidate patch | Dirty working tree on the named base; initial Phase 0 tracked unstaged binary-diff SHA-256 `cada6ce1df337716036e141f40b0a0aead0a9bfeaf8cdc6546b104c205b3b1fa`; post-remediation SHA-256 `6f68e93576e8d5f54a8552b462935dbf2754c46eb4598b6de385f4c73aa8e163`; staged binary-diff SHA-256 `28bd42705d2930f32acae13b7659adb8314eeb84a2c16eefeb8d061b0b6d2599` | Not reproducible from `HEAD` alone; use the reviewed change catalogue |
| Production commit SHA | `c3888fa5606fc9a159f12a8e5c5ace04bd06fcfd` | Pushed to `origin/codex/phase0-release-20260820` and deployed on 20 August 2026 |
| Backend process | systemd main PID `3803932`, active since `2026-08-20 10:45:27 UTC`; Node child started from the committed `backend/dist` build | Deployed backend revision |
| Built backend entry | `backend/dist/server.js`, SHA-256 `cbc956120c678812a00b0078ee85fca0e687f51a485d05897aba94d578a9fe8d` | Rebuilt on 20 August; the backend service was restarted from this build after migration deployment |
| Served frontend entry | Pre-remediation `/assets/index-BX1UaP0b.js`; current `/assets/index-DM1CXvtx.js`, SHA-256 `b75fd774b7cd23d27fafda9517f848d14ea2c7c22d676026bd47e6a9a9dbdf26` | HTTPS loopback check returned the current asset after accessibility remediation |
| Frontend HTML | `frontend/dist/index.html`, SHA-256 `a1aedcc8c159ad23872406e0b7becaa02212ce8b54494c6738b261726889f13c` | Build gate refreshed the Nginx-served artifact on 20 August |
| Deployment evidence | Commit `c3888fa5606fc9a159f12a8e5c5ace04bd06fcfd`; migration 32/32; backend active timestamp `2026-08-20 10:45:27 UTC`; frontend entry `index-DM1CXvtx.js` | Commit-to-deployment mapping established |
| Production health | `/` HTTP 200 and `/api/health` returned `{"status":"ok","service":"golden-studio-plus-api"}` over the local production virtual host | Health only; not revision proof |

The application code deployed in production is mapped to commit `c3888fa5606fc9a159f12a8e5c5ace04bd06fcfd`. The follow-up deployment-evidence commit changes documentation and the production-only test locator only; it does not change the deployed runtime bundles.

## Database migration baseline

`npx prisma migrate status` was run against the configured PostgreSQL target at `127.0.0.1:5432` without modifying it.

| Measure | Result |
|---|---|
| Migrations present in repository | 32 |
| Migrations applied to configured target | 32 |
| Pending migrations | 0 |
| Target schema gate | **Passed: database schema is up to date** |

### Required post-report migration set

| Migration | Target status | Release decision | Compatibility and rollback note |
|---|---|---|---|
| `20260811110000_post_04_qa_notification_override` | Applied | Include. Required by the current schema and notification-override service | Additive table/indexes/FKs. Roll back only after disabling the override service and exporting any audit rows; dropping it destroys override audit history |
| `20260812123000_add_contact_locale` | Applied 20 August 2026 | Included before the backend restart | Additive non-null `locale` columns defaulting historical rows to `fr`, with `fr/en` checks. Old code is forward-compatible. Rollback requires first removing all code reads/writes, then dropping constraints and columns; locale evidence would be lost |
| `20260814170000_add_whatsapp_marketing_consent` | Applied 20 August 2026 | Included before the backend restart | Additive consent fields defaulting prior snapshots to no promotional consent. Old code is forward-compatible. Rollback requires first removing code reads/writes; dropping the columns destroys consent evidence and therefore is not the preferred operational rollback |

Deployment followed the required order: encrypted verified backup, `prisma migrate deploy`, confirmation of 32/32, backend build/restart, then health and browser acceptance checks. Backup: `.phase0-backups/20260820T103700Z-pre-phase0-release/database.dump.enc`, SHA-256 `2c7920991f0ef679035b5e2598219943203776a511e80b613ef116e401b8ea4d`, 247,103 decrypted bytes and 312 restore-catalogue entries.

## Workspace release boundary

The authoritative inventory is `GOLDEN_STUDIO_PLUS_PHASE_0_WORKSPACE_CHANGE_CATALOGUE_2026-08-20.md`.

- Candidate application set: backend/frontend source, tests, configuration examples, three migrations, and active release evidence listed in the catalogue, reviewed and committed as the Phase 0 runtime patch series.
- Excluded by default: every pre-existing deletion, binary owner/source material, superseded reports, local backup material, generated output, secrets, `.env` files, and Playwright traces.
- Runtime/evidence scope was committed as `c3888fa`, pushed to the isolated remote branch, and deployed. The two additive migrations were applied and the backend was restarted through its systemd `Restart=always` policy. No external message or production business-data mutation was initiated by the deployment procedure.
- The required validation builds write generated files under ignored `backend/dist` and the Nginx-served `frontend/dist`. The remediation build therefore refreshed the live static directory in place and changed the served entry from `index-BX1UaP0b.js` to `index-DM1CXvtx.js`. The backend was subsequently restarted after the migration gate passed. Future validation should build into an isolated staging directory before deployment.

## Validation evidence

| Gate | Result | Evidence |
|---|---|---|
| Backend tests | **Pass** | 23 files, 176/176 tests |
| Backend TypeScript build | **Pass** | `tsc` completed without error |
| Frontend tests | **Pass** | 95/95 tests |
| Frontend lint | **Pass** | ESLint completed without error |
| Frontend production build | **Pass** | Vite build, 11 public prerenders, 3 private prerenders, performance budgets, and tracker build audit passed |
| Frontend tracker build audit | **Pass** | 3 inventory entries, 2 external origins, 0 optional trackers, 0 browser-storage APIs found statically |
| Local Playwright initial full suite | **Fail** | 114 passed, 24 failed across Chromium and WebKit (138 total; 18.3 min) |
| Local Playwright targeted remediation | **Pass with one runner retry** | 27/28 in the combined run; the sole WebKit browser-process closure passed unchanged in isolation, giving 28/28 scenario evidence |
| Local Playwright post-remediation full suite | **Pass with isolated flake recovery** | 135/138 in one 14.1-minute endurance run; the three residual cases passed unchanged 3/3 in immediate isolated reruns. No reproducible assertion failure remains |
| Production targeted browser suite | **Pass** | 50/50 scenario evidence across Chromium and WebKit after correcting one stale typographic-apostrophe locator |
| Production accessibility | **Pass** | Dedicated public-route/form and reservation-step axe scans 2/2 |
| Production health/catalogue | **Pass** | HTTPS health 200; 35 published packages |
| Configured target migration status | **Pass** | 32/32 applied; schema up to date |
| Production revision mapping | **Pass** | Runtime commit `c3888fa5606fc9a159f12a8e5c5ace04bd06fcfd` |

### Browser remediation disposition

| Area | Observation | Phase implication |
|---|---|---|
| Contrast / axe | Added `--c-gold-text-on-light: #8A651F` and used it for light-surface labels, prices, and testimonial metadata. The prior examples improved from 2.69/2.76:1 to at least 5.26:1 | Broad public-route and reservation-step axe cases pass in Chromium and WebKit |
| Consent/legal assertions | Updated LEG-04 to the current four-choice consent contract and LEG-06 to allow only the inventoried `gsp.locale=fr` preference | Both cases pass in Chromium and WebKit; locale storage remains an explicit Phase 6 architecture item |
| Proposal error states | Updated the assertion to accept the source’s typographic apostrophe without changing product copy | Retention, stale-response, and all error-state cases pass in both engines; product meaning remains a Phase 2 decision |
| Reduced motion | Wait for the asynchronously mounted header before computing styles | Passes in both engines |
| Reservation/legal locators | Updated stale separate-consent, casing, and typographic-apostrophe locators to the current source-driven contract | Affected reservation, legal, contact, and validation cases pass in both engines |
| Mobile menu focus | Reordered the mobile heading controls so the close button is first in DOM focus order; Shift+Tab wraps to the final booking action | Focus, Escape, inert background, scroll lock, and restoration pass in both engines |
| Endurance flakes | One Chromium LEG-07 refresh race and two WebKit footer batches failed only in the long run; each passed unchanged in isolation. A separate WebKit axe process closure also passed unchanged under diagnostic rerun | Retain traces; no product failure reproduced. A future CI retry policy may classify browser-process exits separately without retrying assertion failures |
| Reschedule/block persistence | No local Playwright scenario directly edits, submits, refreshes, and verifies a reschedule or availability block | Required browser evidence is absent; Phase 2 must add it |

Retained Playwright traces and error contexts live under ignored `frontend/test-results/` and are diagnostic artifacts, not release inputs.

## Phase 0 exit gate

| Requirement | Verdict |
|---|---|
| Reproducible from a named revision or reviewed patch set | **Met** — committed and pushed as `c3888fa5606fc9a159f12a8e5c5ace04bd06fcfd`; excluded deletions remain outside the commit |
| No pending Prisma migration in target | **Met** — 32/32 applied |
| Unit, integration, build, lint | **Met locally** |
| Selected browser suites green | **Met with documented endurance flakes** — all affected cases pass in both engines; full run 135/138 plus unchanged isolated reruns 3/3 |
| Locally implemented findings remain awaiting production proof | **Met in the ledger** |

**Release verdict: GO — PHASE 0 COMPLETE.** The reviewed runtime scope is committed, pushed, deployed, migrated, healthy, and covered by local and production evidence. Report findings that require Phase 1–7 behavior or external provider/owner proof remain open in the acceptance ledger; this Phase 0 verdict does not close them prematurely.
