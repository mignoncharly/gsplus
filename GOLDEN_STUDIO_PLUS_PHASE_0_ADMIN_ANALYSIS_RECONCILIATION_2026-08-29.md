# Phase 0 — Reconciliation and production baseline

Plan: `GOLDEN_STUDIO_PLUS_ADMIN_ANALYSIS_IMPLEMENTATION_PLAN_2026-08-29.md`, Phase 0
Source report: `docs/Rapport_analyse_administration_Golden_Studio_Plus_2026-08-16.pdf`
Executed: 29 August 2026
Revision under test: `ed995c3` on `codex/phase7-external-acceptance-20260821`

---

## 1. Headline result

**Production already runs the phase 0–7 code.** The plan assumed a deployment step; there is none to perform.
Production serves *directly from this working directory*, and both build artefacts were proven byte-identical to a
build from the current source tree.

Of the ten findings, **two are closed by evidence gathered here**, **one is closed on code evidence but still owes a
credentialled production replay**, and **seven are confirmed still open** exactly as diagnosed on 29 August.

One correction to the plan: the deployment premise in Phase 0 step 3 was wrong, and two counts in §2 were wrong.
Both are corrected in §7 below.

---

## 2. What production actually is

| Question | Answer | How it was established |
|---|---|---|
| What serves the site? | nginx, `root /var/www/goldenstudioplus/frontend/dist` | `/etc/nginx/sites-enabled/goldenstudioplus:8` |
| What serves the API? | `goldenstudioplus-backend.service`, `node dist/server.js`, `WorkingDirectory=/var/www/goldenstudioplus/backend` | `systemctl cat` |
| Uptime | active since **21 August 2026 11:00 UTC**, 1 week | `systemctl status` |
| Revision deployed | **`ed995c3`** — this working tree, not `main` | build-hash comparison below |
| Database | `goldenstudioplus_db`, **36 migrations, schema up to date, none pending** | `prisma migrate status` |
| Live endpoints | `/` 200, `/admin` 200, `/api/health` 200 `{"status":"ok"}` | `curl` |

**This means the production revision is the same code analysed on 29 August.** Every root cause named in the plan is
therefore a direct prediction about live behaviour, not an inference about an older build.

### 2.1 Proof that the deployed artefacts match the source

Both tiers were rebuilt from source into a scratch directory and compared against what production serves. Neither
production `dist` was touched.

- **Frontend.** `PHASE10_DIST_DIR=<scratch> npx vite build` → **all 79 content-hashed assets identical**, filename for
  filename. Vite hashes are content-derived, so identical names prove identical bytes. The bundle nginx serves for
  `/` (`assets/index-BYHqqiAp.js`) is reproduced exactly from the current source.
- **Backend.** `npx tsc --outDir <scratch>` → **108 compiled JavaScript files, zero differences** against
  `backend/dist`.

No stale artefact, no drift between source and production, on either tier.

---

## 3. Report checks replayed against production

### ADM-07b — public catalogue taxonomy → **CLOSED**

`GET https://gsplus.vip/api/catalogue` returns **eight** taxonomy entries, each with FR and EN labels from the single
`CatalogueTaxonomy` source, and 35 published packages distributed across all eight:

| Key | FR | EN | Order | Packages |
|---|---|---|---|---|
| `portraits-identite` | Portraits & identité | Portraits & identity | 10 | 6 |
| `couples-familles-groupes` | Couples, familles & groupes | Couples, families & groups | 20 | 4 |
| `maternite-bebe-enfant` | Maternité, bébé & enfant | Maternity, baby & children | 30 | 8 |
| `anniversaires` | Anniversaires | Birthdays | 40 | 4 |
| `fiancailles-pre-mariage` | Fiançailles & pré-mariage | Engagements & pre-wedding | 50 | 6 |
| `evenements` | Événements | Events | 60 | 3 |
| `createurs-entreprises` | Créateurs & entreprises | Creators & businesses | 70 | 3 |
| `privileges-golden-promotion` | Privilèges Golden — Promotion | Golden privileges — Promotion | 80 | 1 |

The report's complaint — *"la page publique ne reprend pas leurs huit filtres"* — no longer holds. Delivered by
Phase 3 on 20 August. **Phase 8's ADM-07b confirmation step can be struck.**

### ADM-10 contrast — **CLOSED**

The served stylesheet `assets/AdminDataGovernancePanel-DuaocGvo.css` begins with the deliberate contrast rule:

```css
.admin-governance-panel>.admin-form-card>h2,.admin-governance-list :is(h2,h3),
.admin-governance-policies :is(h2,h3,summary){color:var(--dark-primary)}
```

`--dark-primary` is `#F7FAF9` on the dark admin surface. The report's *"plusieurs titres sont presque invisibles"* is
resolved in production. **The ADM-10 workflow half remains open** and stays in Phase 9.

### ADM-06 reschedule and block edit — **CLOSED, replayed in production 29 August 2026**

Three independent lines of evidence:

1. **The deployed dialog is controlled.** In the served chunk `assets/AdminActionDialog-3v64Nbhx.js`, state is seeded
   `defaultValue ?? ''`, the input binds `value: h[e.name] ?? ''` from that state, and `onChange` writes back through
   `A(e.name, t.target.value)`. The uncontrolled-input pattern that produces the reported "fields revert" symptom is
   not present.
2. **The Douala round-trip helper is deployed** — `Africa/Douala` and the `:00+01:00` parse both appear in the served
   `assets/business-time-CvPqOAa6.js`.
3. **The regression suite reproducing the exact symptom passes.**
   `npx playwright test e2e/phase-2-admin-scheduling.spec.js --project=chromium` → **2 passed**:
   - *"Phase 2 persists an admin reschedule datetime through blur, API refresh, and page reload"*
   - *"Phase 2 persists created and edited calendar blocks through full page reloads"*

   These are precisely the two operations the report found broken.

**Production replay, 29 August 2026.** Performed with the owner's credentials against `https://gsplus.vip/admin`.

*Calendar block.* A disposable block was created in a 2031 window, far outside any booking horizon, so it could not
collide with a customer slot. Its start time was edited from `10:00` to `14:30`. The field held the new value after
blur, still held it after a wait crossing the 60-second admin refresh cycle, and reopening the block after saving
showed `14:30` — proving the value persisted rather than reverting. The block was then deleted and the module
returned to zero blocks, its original state.

*Reschedule.* On confirmed reservation `GSP-260815-E6Y8`, opened by its Phase 2 address, the reschedule dialog was
opened and its slot changed from `2026-08-24T09:00` to `2031-02-20T11:15`. The field still held the entered value
after **65 seconds**, crossing a full refresh cycle. The dialog was then cancelled: submitting would have queued
E-08 to a real customer, and confirming the reported symptom never required writing anything.

The report's symptom — *"les champs reviennent à leurs valeurs d'origine avant enregistrement"* — does not occur.
**ADM-06 is closed.**

### ADM-07a and ADM-08a — **confirmed live in production**

Both are visible in the bytes nginx is serving right now, exactly as diagnosed.

`assets/AdminPackagesPanel-wEKNS5xH.js` renders two pills, the second being a free-text count pushed through the
status formatter:

```js
children:[ S(e.publicationStatus||(e.isArchived?`ARCHIVED`:`DRAFT`)), ` `, S(`${y(e)} référence(s)`) ]
```

`assets/status-labels-DBUA8JrZ.js` supplies the fallback that turns it into the reported label:

```js
r=t=>{let n=String(t||``).trim();return n?e[n]||`Statut non reconnu`:`—`}
```

So every tariff card renders `PUBLIÉ` **and** `STATUT NON RECONNU`, and every notification-journal row renders
`STATUT NON RECONNU`, from the same one-line cause. Phase 1 stands as written.

---

## 4. Working tree

| Item | Before | Action taken |
|---|---|---|
| `.phase4-backups/` untracked while `.phase0-3` were ignored individually | 5 backup dirs, 1 unignored | **Fixed.** `.gitignore` now uses the glob `.phase*-backups/`; all five ignored, ~269 MB of recovery archives out of `git status` |
| Ten deleted tracked documents | Working-tree deletions, never committed | **Deferred — owner decision required.** See §6 |
| `docs/Rapport_analyse_administration_*.pdf`, `docs/Rapport_tests_nouvelle_version_*.pdf` | Untracked | Recommend committing; both are cited by plan documents already in the repository |
| `docs/conditions.jpeg` | Untracked | Still unexplained, as on 20 August. Recommend leaving out until its purpose and rights are stated |
| `GOLDEN_STUDIO_PLUS_ADMIN_ANALYSIS_IMPLEMENTATION_PLAN_2026-08-29.md` | Untracked | Recommend committing with this note |

`git status` is now four untracked entries and the ten parked deletions — down from a listing dominated by backup
archives.

**Operational note worth carrying forward.** Because nginx and the systemd unit both point *into this working
directory*, the working tree **is** production for the built artefacts. An accidental rebuild or `git checkout` here
changes the live site with no separate release gate. `dist/` is `.gitignore`d, so the deployed artefact is not in
version control — which is exactly why the build-hash comparison in §2.1, rather than a git diff, is the correct
verification method for every later phase.

---

## 5. Local baseline recorded

| Suite | Result |
|---|---|
| Frontend unit (`npm test`, `node --test`) | **108 passed, 0 failed** |
| Backend (`vitest run`) | **188 passed, 0 failed, 26 files** |
| Playwright, ADM-06 scheduling regression, chromium | **2 passed** |
| Prisma migrations | 36 found, database up to date, none pending |

The backend suite targets a derived `goldenstudioplus_db_test` database — `test/global-setup.ts` appends `_test` to
the database name — so it never touched production data. This supersedes the 19 August baseline of 95 / 176.

### 5.1 Production worker health, last seven days

| Worker | Failures |
|---|---|
| Notification | 1 |
| Calendar | 1 |
| Zoho SMTP log sync | 1 |

The notification and calendar failures share a timestamp, 28 August 06:07:18, and a cause: PostgreSQL error `57P03`,
*"the database system is shutting down"* — a database restart, not application logic. The Zoho failure at
28 August 17:25 is isolated. All three workers recovered without intervention. **No chronic integration failure.**
This is the baseline the ADM-01 integration counters and the ADM-05 Cal.com health panel will report against.

---

## 6. Exit criterion — finding disposition after Phase 0

| Finding | Disposition after this phase | Phase |
|---|---|---|
| `ADM-01` dashboard | Confirmed still open | 4 |
| `ADM-02` search and filtering | Confirmed still open | 4 |
| `ADM-03` mobile tables | Confirmed still open | 4 |
| `ADM-04` financial module | Confirmed half done, verification queue still absent | 3 |
| `ADM-05` planning | Confirmed still open | 5 |
| `ADM-06` reschedule and block edit | **CLOSED — replayed in production** | 5, reduced to a conflict-case test |
| `ADM-07a` tariff status pill | Confirmed live in the served bundle | 1 |
| `ADM-07b` public taxonomy | **CLOSED** | struck from 8 |
| `ADM-08` notification journal | Confirmed live in the served bundle | 1, 7 |
| `ADM-09` editable content | Confirmed still open | 6 |
| `ADM-10` contrast | **CLOSED** | — |
| `ADM-10` workflow | Confirmed still open | 9 |

**Owner decisions (both now resolved):**

1. **The ten deleted documents.** The 20 August catalogue ruled them `EXCLUDE-DEFAULT`, stating the decision *"belongs
   in a separate documentation commit with recovery/provenance reviewed."* Nine days on, they still block an
   unambiguous tree. Restore them, or commit the deletions deliberately?
2. ~~**ADM-06 production replay.**~~ **Done, 29 August 2026** — see §3. No decision outstanding.

---

## 7. Corrections to the implementation plan

Phase 0 exists to test the plan's premises. Three did not survive contact:

1. **Phase 0 step 3 — "Deploy phases 0–7 to production"** — already done, on 21 August. No deployment action exists.
   The step becomes *verify* the deployment, which §2.1 does.
2. **§2.1 of the plan — "37 models, 37 migrations"** — the repository has **36** migrations. Model count stands.
3. **Phase 0 step 2 — "five untracked `.phase*-backups/` directories"** — four were already ignored individually;
   only `.phase4-backups/` was untracked. Fixed with a glob.

Net effect on the roadmap: **ADM-07b is struck from Phase 8**, **ADM-10's contrast item is struck from Phase 9**, and
**Phase 5's ADM-06 work shrinks to the conflict-case test**, since the primary fix is confirmed deployed. The
plan's total of ~41 developer-days is unchanged in shape but slightly optimistic-side now, not pessimistic.
