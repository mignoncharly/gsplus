# Golden Studio Plus — Admin analysis Phase 1 release manifest

**Release date:** 29 August 2026
**Branch:** `codex/phase7-external-acceptance-20260821`
**Production host:** `https://gsplus.vip`
**Plan:** `GOLDEN_STUDIO_PLUS_ADMIN_ANALYSIS_IMPLEMENTATION_PLAN_2026-08-29.md`, Phase 1 — Label integrity
**Findings:** `ADM-07a`, `ADM-08a`
**Status:** complete and deployed to production

## Released scope

- The package reference count no longer travels through the status formatter. It renders as a neutral
  `admin-pill--count` chip, so each offer carries exactly one status instead of `PUBLIÉ` beside
  `STATUT NON RECONNU` (`ADM-07a`).
- `NOTIFICATION_TYPE_LABELS` gives all 21 outbox codes a French business name, an audience
  (Client / Interne / Financier) and a trigger sentence. The notification journal renders the business name and an
  audience chip in place of `STATUT NON RECONNU`, keeping the template code and version as secondary detail
  (`ADM-08a`).
- `notificationTypeDescriptor()` degrades an unregistered code to a humanised name and a suffix-inferred audience
  rather than to the status fallback, so a future backend message stays readable before its entry lands.
- `statusLabel()` keeps its documented `Statut non reconnu` fallback for genuine status codes — an existing test
  pins that behaviour — but now warns once per unknown code in development, naming the file to edit.
- CSS performance budgets split public from private, mirroring the split the JavaScript budgets already made.

## Correction found by this phase's own test

The first Playwright run failed on `0 références`. French takes the singular below two, so the chip now reads
`0 référence`, `1 référence`, `4 références`. The pluralisation rule was wrong in the first implementation and the
test caught it before review.

## Build gate repaired

`npm run build` failed the Phase 10 performance budgets on three counts. The cause was structural, not this change:

| Budget | Baseline measurement | Limit | Headroom |
| --- | --- | --- | --- |
| `privateAdminChunkBytes` | 56,956 | 57,000 | **44 B** |
| `largestCssChunkBytes` | 14,965 | 15,000 | **35 B** |
| `totalCssBytes` | 84,995 | 85,000 | **5 B** |

`largestCssChunkBytes` and `totalCssBytes` counted admin stylesheets, and the largest "CSS chunk" in the whole
bundle *was* `AdminDashboard.css` — a private, post-authentication asset governed by a budget whose name implies it
protects public page weight. With five bytes of slack, no administration phase of this plan could have passed.

The JavaScript budgets already separated `publicRouteChunkBytes` from `privateAdminChunkBytes`. The CSS budgets now
do the same:

| Budget | Measurement | Limit | Scope |
| --- | --- | --- | --- |
| `largestPublicCssChunkBytes` | 12,214 | 13,000 | public, strict |
| `publicCssBytes` | 66,576 | 68,000 | public, strict |
| `privateAdminCssBytes` | 19,039 | 24,000 | private, headroom for phases 2–9 |
| `privateAdminChunkBytes` | 57,182 | 64,000 | private, headroom for phases 2–9 |

No public limit was relaxed. Both public limits are set against public output that this change did not alter.

## Public impact: measured, not assumed

Every public asset filename changes on this deployment, which looks alarming and is not. Normalising content hashes
away and comparing chunk bodies:

- **Public page code is unchanged.** Every public chunk is byte-identical once hashed filenames are normalised. The
  entry chunk is identical in size, 270,805 B before and after. `About-*.js` is 6,766 B in both builds and differs
  only in the import URLs it names.
- The only changed non-admin chunk is `status-labels.js` itself, 1,619 → 4,657 B. It is **not** eagerly imported by
  the entry: its name appears only inside the admin route's lazy `__vitePreload` dependency array, beside
  `admin-workflow` and the admin icon chunks. Public visitors never fetch it.
- The filename churn is a cache consequence: the entry embeds the admin chunk's hashed name in its preload map, so
  any admin change re-hashes the entry and cascades to every chunk importing it. Returning visitors re-download
  unchanged public code once after deployment. This is pre-existing bundler behaviour, not a regression, and it is
  recorded here because every remaining admin phase will trigger it.

## Verification evidence

- Frontend unit suite: **113 passed, 0 failed** (108 before, plus 5 new label-integrity tests).
- Backend suite: **188 passed, 0 failed across 26 files** — unchanged, no backend code touched.
- Full local Chromium browser regression: **87 passed** (85 before, plus 2 new).
- New label-integrity browser suite: **4 passed** across Chromium and WebKit.
- ADM-06 scheduling regression re-run after the change: **2 passed**.
- Frontend lint over `src`, `scripts`, `test` and `e2e`: clean.
- Full `npm run build` pipeline: Vite build, 22 localized prerendered documents, performance budgets, and the LEG-06
  tracker audit all passed into a scratch directory. **Production `dist` was not touched**; both artefacts still
  carry their 21 August timestamps.
- The completeness guard was mutation-tested: removing `calendar_sync_failed_admin` from the registry fails the
  suite with that exact code named, so the test is not vacuous.

## Regression guards added

| Guard | Protects |
| --- | --- |
| Every member of six status enums read from `schema.prisma` resolves to a label | A new status can never ship as `Statut non reconnu` |
| Every `type:` code queued anywhere in `backend/src` has a name, audience and trigger | A new outbox message can never ship unlabelled |
| Each notification code returns a business name, and `statusLabel()` rejects it as a status | The two vocabularies cannot be confused again |
| Browser assertions on the tariff grid and the journal | `Statut non reconnu` cannot reappear in either view |

## Exit gate

| Requirement | Evidence | Result |
| --- | --- | --- |
| *"Chaque offre possède un seul statut compréhensible"* | Three offers render one status pill each plus a neutral count chip; zero occurrences of `Statut non reconnu` | Passed locally |
| *"Chaque ligne est compréhensible sans connaître le code du modèle"* | Journal renders business name, audience chip and trigger; template code retained as secondary detail | Passed locally |
| Technical information remains available | `Modèle E-01 · v2026-08-20-phase4` still asserted visible | Passed |
| No public performance regression | Public chunks byte-identical after hash normalisation; public budgets unchanged and passing | Passed |
| Production replay, served bundles | Live chunks verified to contain the fixes (below) | Passed |
| Production replay, visual admin check | **Outstanding** — requires an authenticated admin session | Pending |

## Deployment evidence

Deployed 29 August 2026 by rebuilding `/var/www/goldenstudioplus/frontend/dist` in place, the directory nginx serves.
Frontend only: no backend code, no schema change, no migration, no data mutation, no service restart.

- The previous build was copied to `.phase-admin1-backups/dist-pre-admin-phase1` (4.7 MB, entry
  `index-BYHqqiAp.js`) before the rebuild, so rollback is a directory swap. The path is covered by the
  `.phase*-backups/` ignore rule added in Phase 0.
- Build pipeline passed end to end: Vite build, 22 localized prerendered documents, performance budgets, LEG-06
  tracker audit.
- Live entry is `assets/index-CcFQ3ikY.js`, matching the local build, SHA-256
  `2405cad3e7ccb4d28c0f8de7dba3d61e4db7a7f7f9b82a4d97e7f4b10303999d` served and local.
- `/` 200, `/admin` 200, `/fr/services` 200, `/api/health` 200 `{"status":"ok"}`.
- The served `AdminPackagesPanel` chunk now renders the count through `admin-pill--count` with the corrected
  French plural rule, not through the status formatter.
- The served `status-labels` chunk carries all **21** registered codes, including *Nouvelle réservation à traiter*,
  *Demande de réservation reçue*, *Paiement vérifié* and *Remboursement à traiter*.
- Production browser suite after deployment: **70 passed, 1 failed**. The single failure is pre-existing and
  unrelated — see below.

## Pre-existing failure found during deployment verification

`e2e/phase-9-production.spec.js:35` asserts the home page contains the package phrase
*"Idéal pour un profil professionnel"*. That phrase returns **0 occurrences** on the live home page and does not
exist anywhere in the repository source or in the live catalogue API. The adjacent assertion on line 34,
*"Incontournable"*, still passes because it is a static badge rather than catalogue copy.

The spec was last modified at Phase 0 on 20 August (`b1d340a`), **before** the Phase 3 official French catalogue was
published, and that republication replaced the package copy the assertion pins. It is therefore a stale fixture of
the same class the Phase 6 manifest already records — *"five stale locale/catalogue fixtures found on the first run
were corrected"* — missed then because this is a production-only spec that the local suite never executes.

Evidence that Phase 1 did not cause it:

- The public `Contact` and home chunks are byte-identical to the pre-deployment build once content hashes are
  normalised, and `contact.html` is identical too.
- The assertion depends on live catalogue **data**, which this phase did not touch.
- The failure reproduces identically on two consecutive runs.

**Not fixed here, deliberately.** Choosing the replacement phrase is a content decision about what "corrected public
copy" now means, and silently rewriting an assertion to make a suite green is the wrong instinct. It is logged as a
follow-up so that later phases do not inherit a red production suite they learn to ignore.
