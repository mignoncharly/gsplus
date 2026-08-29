# Golden Studio Plus — Admin analysis Phase 2 release manifest

**Release date:** 29 August 2026
**Branch:** `codex/phase7-external-acceptance-20260821`
**Production host:** `https://gsplus.vip`
**Plan:** `GOLDEN_STUDIO_PLUS_ADMIN_ANALYSIS_IMPLEMENTATION_PLAN_2026-08-29.md`, Phase 2
**Report sections:** §2.1 deep links, §3.1 target reservation record
**Status:** complete and deployed to production

## Released scope

### §2.1 — every view and every record has its own address

- `frontend/src/lib/admin-deep-links.js` becomes the single routing vocabulary: an `ADMIN_VIEWS` table mapping the
  internal view key to a permanent public slug, plus aliases.
- The dashboard no longer stores the active view. `activeTab` is derived from `location`, and selecting a view
  navigates. Reload and Back therefore land where the administrator was, not on the overview.
- Opening a reservation moves the address to `/admin/reservations/<reference>`; closing it, or pressing Back,
  returns to `/admin/reservations`. The open record is **derived** from the URL rather than synchronised to it, so
  there is no effect and no extra render.
- Signing in returns to the address that was requested before the login screen appeared.
- An unrecognised `/admin/...` path resolves to the dashboard instead of a blank view.

| View | Address | Also resolves |
| --- | --- | --- |
| Vue ensemble | `/admin/tableau-de-bord` | `/admin`, `/admin/overview` |
| Réservations | `/admin/reservations` | — |
| Leads | `/admin/demandes` | `/admin/leads` |
| Remboursements | `/admin/paiements` | `/admin/finance` |
| Tarifs | `/admin/offres` | `/admin/tarifs` |
| Disponibilités | `/admin/planning` | `/admin/availability` |
| Portfolio | `/admin/medias` | `/admin/portfolio` |
| Communications | `/admin/messages` | `/admin/notifications` |
| Données & droits | `/admin/conformite` | `/admin/governance` |
| Sécurité | `/admin/securite` | `/admin/account` |

Slugs anticipate the report's target menu so they never have to move again; the sidebar labels catch up in later
phases. Every internal key stays resolvable, so no link anyone has already constructed can 404.

**Permanence guarantee.** `/admin/reservations/:reference`, `/admin/leads/:reference` and `/admin/finance/:id` are
built by `backend/src/utils/admin-links.ts` and are embedded in **e-mails that have already been delivered** and in
Cal.com event descriptions. They can never stop resolving. A test reads that builder and asserts each shape still
resolves, so the guarantee is enforced rather than remembered.

### §3.1 — the target reservation record

Extracted from the dashboard into `frontend/src/components/AdminReservationRecord.jsx` and restructured:

- **Header** — reference, client, pack, Douala date/time, duration and general status.
- **Two independent blocks**, Paiement and Réservation, each with its own timestamped history, because a verified
  payment can sit on an undecided reservation and each state must be readable on its own.
- **Transaction detail** — code, operator, payer phone, expected amount from the frozen snapshot against the
  declared amount, with an explicit *Écart de montant* chip when they disagree, and the verification timestamp.
- **Frozen contact details and consents**, labelled as recorded at booking time and explicitly not following later
  profile edits.
- **One chronology** merging e-mail, WhatsApp and Cal.com events, newest first, with the retry action on a failed
  message, so "what has this customer actually received?" is one list rather than three panels.
- **Internal notes separated from customer wording** — `internalReason` and `customerReasonText` were both already
  stored by the Phase 1 communication boundary but never shown apart. They now carry distinct labels and colours.
- Actions kept **verbatim**: every guard, permission check, temporal-override rule and label was moved unchanged.

`AdminDashboard.jsx` went from **1,883 to 1,808 lines**, honouring the plan's rule that no phase may add net lines
to that file.

## Corrections found by this phase's own tests

1. **Duplicated consent.** The new frozen-contact block restated WhatsApp consent, which `AdminWhatsAppPanel`
   already owns together with the action it gates. The duplicate field was removed rather than the assertion
   adjusted; the remaining marketing consent was renamed to *Consentement marketing* so two labels no longer begin
   with the same words.
2. **A real accessibility regression, found and fixed.** Making admin views addressable woke `ScrollManager`, which
   moves focus to `#main-content` across three animation frames on every route change. Inside the administration
   that stole focus from the control just used, breaking the drawer's focus restore. The first fix — excluding
   `/admin` from `ScrollManager` entirely — was **too broad**: it also removed focus handling when arriving at
   `/admin` from the public footer, which `p2-05` correctly caught. The shipped fix skips scroll and focus handling
   only when a navigation **stays inside** `/admin`; entering or leaving it keeps the normal behaviour.

## Test contract updated, intent preserved

`e2e/p2-02.spec.js` asserted `page.url()` contained `/admin/dashboard` after a refresh. That was a proxy for "the
refresh reloaded nothing", written when the admin URL never changed. Opening Leads now legitimately changes the
address, so the assertion captures the URL immediately before the refresh and requires it to be unchanged. The
document-navigation counter, which is the test's real guard, is untouched. The check is now stricter: it would catch
a route change the old substring match would have allowed.

`test/phase-4-admin-deep-links.test.js` asserted the parser's exact return shape. The shape deliberately gained a
`tab` field, so the record assertions now compare the record half and a new case asserts each e-mail URL also
selects the view that displays it.

## Verification evidence

- Frontend unit suite: **118 passed, 0 failed** (113 before, plus 5 new routing tests).
- Backend suite: unchanged — no backend code was touched in this phase.
- New browser suite `e2e/adm-phase-2-admin-routing.spec.js`: **6 passed**, covering per-view addresses surviving a
  reload, record addressing with Back, the e-mail URL shapes, unknown-path fallback, the post-login return, and the
  full §3.1 record structure.
- Full local Chromium regression: **93 passed, 0 failed** (87 before, plus 6 new). Two regressions surfaced on the
  first full run — `p2-02` and `p2-05` — and both were fixed before this manifest was written; see *Corrections*.
- Frontend lint over `src`, `test`, `e2e` and `scripts`: clean.
- Full `npm run build` pipeline into a scratch directory: Vite build, 22 localized prerendered documents,
  performance budgets and the LEG-06 tracker audit all passed. **Production `dist` untouched.**

### Performance

| Budget | Phase 1 | Phase 2 | Limit |
| --- | --- | --- | --- |
| `privateAdminChunkBytes` | 57,182 | **52,635** | 64,000 |
| `privateAdminCssBytes` | 19,039 | 22,027 | 24,000 |
| `publicCssBytes` | 66,576 | **66,576** | 68,000 |
| `largestPublicCssChunkBytes` | 12,214 | 12,214 | 13,000 |
| entry JS | 270,805 | 269,895 | 400,000 |

The admin chunk **shrank by 4,547 bytes** because the record now loads as its own lazy chunk.

### Public impact: measured

After normalising content hashes, no public chunk changed logic. Two public chunks differ only in their preload
dependency lists, which gained a new 1,196-byte `preload-helper` chunk that Rollup split out once the extra lazy
import crossed its threshold. The entry lost 910 bytes to that split, so net public JavaScript moves by roughly
+286 bytes across two files, with no behavioural change and public CSS byte-identical.

## Exit gate

| Requirement | Evidence | Result |
| --- | --- | --- |
| *"Chaque vue et chaque dossier doit disposer d'une URL propre"* | Ten addressed views plus record addresses; round-trip asserted for every view | Passed locally |
| *"Après connexion, l'administrateur doit revenir automatiquement vers le dossier demandé"* | Browser test signs in on a record URL and lands on that record | Passed locally |
| *"Actualiser ou utiliser Retour ne doit pas ramener à la vue d'ensemble"* | Reload asserted on four views; Back closes the record and stays on its list | Passed locally |
| E-mail and Cal.com links keep working | Parser test reads `admin-links.ts` and asserts all three shapes | Passed |
| §3.1 record structure | Browser test asserts header, two blocks, transaction detail, frozen contact, merged chronology, note separation | Passed locally |
| No public regression | Public CSS identical; no public logic changed; full local regression green | Passed |
| Production replay, addresses | Every view URL returns 200 on the live host; served entry hash verified | Passed |
| Production replay, visual admin check | **Outstanding** — requires an authenticated admin session | Pending |

## Deployment evidence

Deployed 29 August 2026 by rebuilding `/var/www/goldenstudioplus/frontend/dist`, the directory nginx serves.
Frontend only: no backend code, no schema change, no migration, no data mutation, no service restart.

- Previous build copied to `.phase-admin1-backups/dist-pre-admin-phase2` (entry `index-CcFQ3ikY.js`, 4.7 MB), so
  rollback is a directory swap.
- Build pipeline passed: Vite build, 22 localized prerendered documents, performance budgets, LEG-06 tracker audit.
- Live entry `assets/index-BMc0uZ2V.js`, SHA-256
  `4a47a74839786b1700377382337de1e9f25f348f365775b93bd2bc856410a522` served and local.
- Every addressed view returns 200 on the live host: `/admin`, `/admin/reservations`, `/admin/planning`,
  `/admin/paiements`, alongside `/`, `/fr/services` and `/api/health`.
- Production browser suite after deployment: **70 passed, 1 failed** — the identical count recorded after the
  Phase 1 deployment. The single failure is the stale catalogue fixture at `phase-9-production.spec.js:35`
  documented in the Phase 1 manifest, unrelated to this phase and still deliberately unfixed.
