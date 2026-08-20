# Golden Studio Plus — release-level acceptance ledger

Candidate: `GSP-RC-2026-08-20-P0`

Base revision: `7059faf1b4a42764f00d7fbc2584186d7c746bb8` plus reviewed patch set

Production revision: **unknown**

Rule: an item remains open or awaiting proof until both its automated and production evidence are attached. Blank sign-off is not approval.

| Report ID | Candidate disposition | Migration | Automated evidence at Phase 0 | Production evidence | Owner sign-off | Rollback note |
|---|---|---|---|---|---|---|
| `MAIL-01` | Implemented locally; awaiting deployment proof | `add_contact_locale` pending | Backend 176/176; frontend 95/95; translation audit passed Chromium/WebKit | Missing: deployed revision, 32/32 migrations, FR/EN journey replay | Pending | Roll back app first; retain locale columns/evidence |
| `MAIL-02` | Open: internal reasons still reach client templates | Future Phase 1 migration expected for explicit copy fields | No boundary/leakage matrix yet | None | Pending | Preserve historical internal audit fields; never rewrite transitions |
| `MAIL-03` | Open: initial cancellation can announce refund work prematurely | None currently | Existing financial tests pass, but neutral-copy assertions absent | None | Pending | Template-only rollback must not alter financial state |
| `MAIL-04` | Open editorial formatting | Possibly lead-reference migration in Phase 4 | Existing mail suites pass; required FR/EN snapshots absent | None | Pending | Keep raw codes in structured logs, not human copy |
| `CAL-01` | Partially implemented locally; product meaning unresolved | Possible proposal-kind migration in Phase 2 | Retention, stale-response, and explicit error-state cases pass both engines | None | Pending | Do not convert a custom proposal into a confirmed blocking slot |
| `CAL-02` | Implemented locally; awaiting stronger browser and production proof | Existing reschedule migration already in baseline | Backend suite passes; no edit-submit-refresh Playwright test found | Missing accepted/rejected reschedule and old/new Cal.com inspection | Pending | Preserve current slot until accepted; use versioned/idempotent calendar rollback |
| `CAL-03` | Open calendar presentation | None expected unless audit fields change | Calendar integration suite included in backend pass | Missing provider capability check and live event inspection | Pending | Revert unsupported provider payload fields; never send internal notes |
| `HAPPY-HOURS-06` | Server enforcement implemented; concurrency proof missing | None | General backend suite passes; required raced seventh-attempt case absent | None | Pending | Preserve booking-day lock and release capacity on reschedule/expiry |
| `TAR-01` | Open authoritative taxonomy | Future taxonomy/localisation migrations | Catalogue unit and browser workflow pass current heuristic model only | None | Pending | Version taxonomy; do not rewrite historical package snapshots |
| `TAR-02` | Open catalogue/CTA divergence | Coupled to Phase 3 catalogue schema | Current catalogue tests pass but do not prove eight-section authoritative projection | None | Pending | Archive versions; do not auto-publish or mutate approved historical versions |
| `PAY-01` | Backend lifecycle present; admin queue open | FinancialTask migration already in baseline; assignment may require additive migration | Financial backend suites included in 176/176 | Missing owner queue and paid-cancellation production proof | Pending | No generic mark-done path; evidence remains immutable |
| `ADMIN-LINK-01` | Open: e-mail query links do not resolve/focus records | Durable lead reference likely required | No authenticated/expired-session deep-link browser matrix | None | Pending | Preserve destination across login; old links need graceful stale handling |
| `LEAD-LABEL-01` | Open aggregated “Demandes B2B” label | None | No exact label/query contract evidence | None | Pending | Label-only rollback; do not change counts silently |
| `UI-01` | Open shared WhatsApp consent readability | `add_whatsapp_marketing_consent` pending for consent semantics | Broad axe fails; dedicated four-form FR/EN contrast matrix absent | None | Pending | Keep consent off by default and transactional/marketing purposes separate |
| `UI-02` | Contrast defect remediated locally; broader Phase 5 token work remains | None | Accessible light-surface gold is at least 5.26:1; broad public/reservation axe cases pass Chromium/WebKit | Missing direct-route and authenticated governance production scans | Pending | Keep semantic light/dark tokens separate; avoid route-local style dependency |
| `UI-03` | Implemented locally; awaiting production replay | None | WhatsApp FAB viewport/collision tests pass in both engines | Missing deployed revision and device/keyboard production matrix | Pending | Feature-gate external channel independently of FAB |
| `A11Y-TARGET-01` | Open 44 px filter targets | None | Responsive suite passes; no computed target-size assertion | None | Pending | CSS-only rollback should retain keyboard/focus behaviour |
| `A11Y-HEADING-01` | Open H1-to-H3 structure | None | Broad axe does not replace explicit heading-order assertions | None | Pending | Add semantic H2s without changing visible hierarchy unnecessarily |
| `DATE-01` | Open locale-stable date control | None expected | Existing dates do not prove browser/OS-independent English controls | None | Pending | Store ISO/Douala instant; never parse display text into business time |
| `LEGAL-COPY-01` | Open literal `OWNER` phrase in English notices | None | Translation audit passes its current token list but plan identifies literal phrase | None | Pending | Source-driven wording; French remains authoritative |
| `SEO-I18N-01` | Open distinct locale URLs/canonicals/hreflang | None | Current prerender passes 11 single-canonical public routes; LEG-06 detects `gsp.locale` storage | None | Pending | Ship redirects/compatibility route; keep `/admin` unprefixed/noindex |
| `WA-E2E-01` | Operationally blocked: provider not configured/proven | Consent migration pending | Backend consent/outbox tests pass locally; no external delivery proof | Missing Meta configuration, consent/no-consent delivery, retry/no-duplicate proof | Pending | Keep delivery feature-gated off until credentials and proof exist |

## Release-wide evidence

| Evidence | Status | Reference |
|---|---|---|
| Reviewed patch boundary | In progress | `GOLDEN_STUDIO_PLUS_PHASE_0_WORKSPACE_CHANGE_CATALOGUE_2026-08-20.md` |
| Immutable candidate revision | Missing | No commit created |
| Database migration proof | Failed | Configured target is 30/32; two pending |
| Backend unit/integration/build | Passed | 176/176 across 23 files; TypeScript build green |
| Frontend unit/lint/build | Passed | 95/95; ESLint, Vite, prerender, budgets, tracker audit green |
| Local browser campaign | Passed with documented endurance flakes | Initial 114/138; post-remediation 135/138 plus unchanged isolated reruns 3/3 |
| Production frontend identity | Partial | Current `index-DM1CXvtx.js`, SHA-256 recorded in manifest |
| Production backend identity | Missing | Process start known; commit/release marker absent |
| External e-mail/Cal.com/WhatsApp proof | Missing for this candidate | Must be produced after an authorised deployment |

## Sign-off rule

Owner sign-off must name the deployed commit, deployment timestamp, 32/32 migration result, linked automated run, linked production evidence, and the chosen rollback point. “Implemented locally” and “previously validated in production” are not closure states for this candidate.
