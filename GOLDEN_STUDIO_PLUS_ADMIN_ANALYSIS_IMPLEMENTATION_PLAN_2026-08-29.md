# Golden Studio Plus — implementation plan for the administration analysis of 16 August 2026

Date: 29 August 2026 
Source report: `docs/Rapport_analyse_administration_Golden_Studio_Plus_2026-08-16.pdf`
Scope analysed: full workspace on branch `codex/phase7-external-acceptance-20260821` (22 commits ahead of `main`)
Guiding objective (from the report): *permettre au Studio de recourir le moins possible au développeur*
Explicitly deferred by the report: advanced security (MFA, roles, sessions, audit) and full commercial CRM

---

## 1. Executive decision

The report describes ten numbered findings (`ADM-01` … `ADM-10`) plus seven unnumbered target sections
(reservation record, catalogue form, received requests, message library, settings, portfolio, dashboard mock-up).
It was produced against **production at 16 August 2026**.

Two facts change how it must be implemented:

1. **The workspace has moved since the report was written.** Phases 0–7 (20–21 August) landed the versioned
   catalogue taxonomy, the refund queue, admin deep links to *records*, controlled admin date/time dialogs, the
   accessibility contrast pass and the multilingual date work. Several report findings are therefore already
   partially or wholly answered in code but **not proven in production**. Rebuilding them from scratch would be waste
   and would risk regressions in guarantees the code currently holds (command IDs, optimistic versions, immutable
   snapshots, notification outbox, advisory booking locks).
2. **Nothing in the report is closed by code alone.** Every criterion in the report is written as an *observable
   behaviour in `https://gsplus.vip/admin`*. Each phase below therefore ends with a production replay, not with a
   green local test run.

The plan is sequenced so that the cheapest trust-restoring fixes ship first (a status pill that says
"STATUT NON RECONNU" on every offer costs one line and destroys confidence in every other number on the screen),
then the P0 operational modules, then autonomy, then exploitation, then the deferred security phase.

### 1.1 Deviation from strict priority order — stated explicitly

The report marks `ADM-04`, `ADM-05`, `ADM-06` as **P0** and the rest as **P1**. This plan puts the label-integrity
fixes (`ADM-07a`, `ADM-08a`) and the `ADM-06` production proof **before** the two large P0 modules. Rationale: the
report's own roadmap groups "statuts reconnus" with "reports/blocages" in Phase 1A, those fixes are hours rather than
days, and `ADM-06`'s root cause already appears remediated in the workspace. No P0 item is deferred behind a P1
module — only behind sub-day corrections.

---

## 2. Verified current state (evidence gathered 29 August 2026)

### 2.1 Architecture

```text
React SPA (frontend/src)                     Express + Zod + Prisma (backend/src)
  pages/AdminDashboard.jsx  1 873 lines  ->  routes/admin.ts   1 400 lines, 54 routes
  components/Admin*.jsx     14 panels        services/*.ts     32 domain services
  lib/status-labels.js                       prisma/schema.prisma  37 models, 36 migrations
```

The whole administration is **one React page with one `activeTab` state variable**
(`frontend/src/pages/AdminDashboard.jsx:169`) and ten tabs, refreshed wholesale every 60 s
(`frontend/src/lib/admin-refresh.js:1`).

### 2.2 What is genuinely strong and must not be broken

- Independent reservation and payment status machines, with mandatory reasons on negative states.
- Versioned admin commands: `commandId`, `expectedVersion`, `AdminCommand`, `AuditLog`, `ReservationTransition`,
  `PaymentTransition`.
- Immutable `ReservationSnapshot` freezing contact, package, price, schedule, consents and locale.
- Notification outbox with attempts, provider status, dedupe keys and operator resolution codes.
- Serializable transactions plus booking-window advisory locks in `services/availability-blocks.ts` and
  `services/booking-slots.ts`.
- Catalogue publication lifecycle: draft → validated → published → archived, with referential delete protection.
- `DataRightsRequest` + `DataRetentionPolicy` + event trail already model the GDPR-style register.
- Role scaffolding already exists: `AdminRole {OWNER, STAFF}`, a typed `AdminPermission` set
  (`backend/src/services/admin-permissions.ts`), `AdminUser.sessionVersion` for session invalidation, and `AuditLog`.
  **Phase 2 security is a smaller job than the report assumes.**

### 2.3 Finding-by-finding code evidence

| Finding | Priority | Verified root cause in code | Disposition |
|---|---|---|---|
| `ADM-01` overview does not help decide | P1 | Four static, non-clickable tiles at `AdminDashboard.jsx:1143-1163`. `paidRevenueThisMonth` (`:861-865`) sums `VERIFIED`/`PAID` payments with **no exclusion of cancelled or refunded reservations**. All four numbers are computed **client-side from the first 50 rows** (`listQuerySchema` default limit 50) so they are silently wrong past 50 reservations. The fourth tile aggregates every `LeadType`. | **Open** |
| `ADM-02` search and filtering insufficient | P1 | `GET /admin/reservations` (`backend/src/routes/admin.ts:346-388`) builds `where: query.reference ? { reference } : undefined`. Exact match only. `listQuerySchema` even declares a `status` field (`backend/src/validation/schemas.ts:64`) that **the route never reads**. No customer/phone/e-mail/date/pack search, no sort, no total count, no saved views. | **Open** |
| `ADM-03` table impractical on mobile | P1 | 7-column table at `AdminDashboard.jsx:1301-1345`, `td` padding `1.5rem` (`AdminDashboard.css:527`), wrapped only in `.admin-table-wrap { overflow-x: auto }` (`:505`). No card fallback at any breakpoint. Reproduces the reported ~1 097 px table in a ~353 px container. | **Open** |
| `ADM-04` no central financial module | **P0** | Refunds **are** done: `FinancialTask` model, `GET/PATCH /admin/financial-tasks`, and `AdminFinancePanel.jsx` with status/reference/operator/overdue filters, pagination, immutable proof and E-20/E-21 dedupe. **Payment verification is not**: it lives inside each reservation record (`POST /admin/payments/:id/verify`), there is no verification queue, no search by transaction code, no expected-vs-declared amount comparison, no duplicate surfacing (the `@@unique([method, transactionRefNormalized])` constraint prevents duplicates but never shows them), and no export. The tab is labelled "Remboursements" and is OWNER-only. | **Half done** |
| `ADM-05` planning does not cover daily needs | **P0** | `BusinessHour` exists in Prisma and is read by `services/booking-slots.ts:118` and `services/availability.ts:84`, but **no admin route writes it** — opening hours are a database/developer operation. No exceptions, holidays, breaks, daily capacity, minimum notice or booking horizon models. The Disponibilités tab (`AdminDashboard.jsx:1378-1445`) is a create form plus a flat list of blocks. No day/week/month agenda, no Cal.com health panel. | **Open** |
| `ADM-06` reschedule and block edit broken | **P0** | The reported symptom (fields reverting to their original values) is the signature of uncontrolled dialog inputs. The current `AdminActionDialog.jsx` uses **controlled inputs backed by `values` state**, mounts conditionally (so state is fresh per open), and `businessDateTimeLocalValue` / `doualaLocalDateTimeToIso` round-trip correctly through `Africa/Douala`. The backend `updateAvailabilityBlock` locks both old and new windows in a serializable transaction. A regression suite already exists (`frontend/e2e/phase-2-admin-scheduling.spec.js`, `frontend/test/admin-reschedule-workflow.test.js`). **This is Phase 2 work (20 August) that has not reached production.** | **CLOSED on code evidence (Phase 0)** — owner replay outstanding |
| `ADM-07` unrecognised tariff status + public taxonomy | P1 | **Two halves.** (a) `AdminPackagesPanel.jsx:186` renders `pill(\`${packageReferenceCount(pack)} référence(s)\`)` — a free-text string pushed through `statusLabel()`, whose fallback is `'Statut non reconnu'` (`frontend/src/lib/status-labels.js:66`). That is why *every* card shows `PUBLIÉ` **and** `STATUT NON RECONNU`. One-line fix. (b) The public/admin taxonomy single source **is already delivered** by Phase 3: `CatalogueTaxonomy` + `CatalogueTaxonomyLocale`, served through the public catalogue and consumed by `Services.jsx:307` via `shootingCategoriesForLocale`. | **(a) confirmed live in the served bundle; (b) CLOSED in production (Phase 0)** |
| `ADM-08` journal too technical, labels unrecognised | P1 | `AdminDashboard.jsx:1523` calls `statusLabel(item.type)` where `item.type` is a snake_case outbox code (`booking_received_customer`, `refund_action_required_admin`, … 18 values in `backend/src/emails/notifications.ts`). None are keys of `STATUS_LABELS`, so **every row** reads "Statut non reconnu". The table is 9 columns of raw technical data. `GET /admin/notifications` (`routes/admin.ts:1277-1305`) accepts no channel/status/type filter and returns no total, so disabled-WhatsApp rows cannot be hidden. | **Open** |
| `ADM-09` too much content still needs the developer | P1 | No `StudioSetting`, `SiteContent`, `FaqEntry` or `EmailTemplate` model exists. The public phone number is hard-coded in four places (`Contact.jsx:62`, `Footer.jsx:81`, `WhatsAppFab.jsx:90`, `content/site-metadata.js:227`); SEO copy is a frozen array in `content/site-metadata.js`; payment instructions are strings in `lib/i18n.js`; legal texts are `backend/src/legal/owner-legal-documents.ts`; e-mail bodies are `backend/src/emails/templates.ts` (E-01…E-23, 468 lines); every integration setting is an environment variable (`config/env.ts`). **Every ordinary change is a code deployment.** | **Open** |
| `ADM-10` data rights module hard to use | P1 | The contrast half looks **already remediated** — `AdminDataGovernancePanel.css` deliberately forces `--dark-primary` on governance headings (Phase 5 accessibility pass). The workflow half is open: `AdminDataGovernancePanel.jsx` has no search, no due-date surfacing, no response templates and no export, although the `DataRightsRequest` model already carries `targetResponseAt`, `identityEvidenceReference`, `responseEvidence`, `closedAt` and a full event trail. | **Contrast CLOSED in production (Phase 0); workflow open** |

### 2.4 Unnumbered target sections

| Report section | Verified gap |
|---|---|
| §2.1 Deep links — *chaque vue et chaque dossier doit disposer d'une URL propre* | Record-level deep links exist (`AdminDeepLinkResolver.jsx`, `lib/admin-deep-links.js`) for `/admin/reservations/:ref`, `/admin/leads/:ref`, `/admin/finance/:id`. **View-level links do not**: `parseAdminDestination` returns `null` when `segments.length < 3`, and `activeTab` is component state. Refresh or Back on any list returns to the overview. |
| §3.1 Target reservation record | Data all exists (snapshot, transitions, notifications, calendar logs, deliveries, consents). It is presented as one long modal rather than the two-block Paiement/Réservation layout with a merged timeline. |
| §6.2 Simplify the tariff form | `AdminPackagesPanel.jsx` `fields()` is a flat list: free-text slug, numeric order, unconditional duration, no conditional price shapes, no draft-vs-publish requirement split. |
| §7 Received requests | Heading is "Demandes B2B / Leads". `LeadType` has only `CONTACT`, `B2B`, `QUOTE` — the **creative-services form posts through `submitQuoteRequest` → `LeadType.QUOTE`** (`frontend/src/pages/CreativeServices.jsx:81`, `backend/src/routes/public.ts:186-205`), so creative and photo-quote requests are indistinguishable. Statuses are CRM-shaped (`WON`/`LOST`) instead of Nouveau/En cours/Traité/Archivé. No search, filter, e-mail history, contact actions or export. |
| §8.1 Message library | No editable template store, no preview with fake data, no test send, no versioning/rollback, no send rules, no sender/reply-to management. `internal-notification-policy.ts` exists but is code-level. |
| §10 Portfolio and media | `MediaItem` carries `width`, `height`, `fileSize`, `thumbnail*` and `rightsBasis` as nullable columns. Nothing raises them as **actionable alerts** (zero-byte derivative, unknown dimensions, unverified rights). No file replacement preserving history, no bulk reorder/publish. |
| §12 Security phase 2 | Only password change exists. Role/permission/audit/session-version scaffolding is already present (see §2.2). |

---

## 3. Phase plan

Ten phases. Each names its findings, its schema and code changes, its acceptance criteria **quoted from the report**,
its tests, and its production proof. Effort is one developer, working days.

Report roadmap mapping: Phases 0–4 = **1A Stabilisation**; Phases 5–7 = **1B Autonomie**; Phase 8 = **1C Exploitation**;
Phase 9 = **Phase 2 Gouvernance**.

---

### Phase 0 — Reconciliation and production baseline *(prerequisite, 0.5 day, no feature code)* — **EXECUTED 29 August 2026**

Result recorded in `GOLDEN_STUDIO_PLUS_PHASE_0_ADMIN_ANALYSIS_RECONCILIATION_2026-08-29.md`.

**Why first.** The branch is 22 commits ahead of `main`, `git status` shows ten deleted tracked documents and an
unignored `.phase4-backups/` directory, and the report tested a production build that predates all of it.
Implementing on top of this without reconciling would close some findings twice and would make every later
"production proof" ambiguous.

1. ~~Capture the exact production revision serving `https://gsplus.vip/admin` and diff it against `HEAD`.~~
   **Done.** Production serves *from this working directory* — nginx roots at `frontend/dist`, the systemd unit runs
   `backend/dist`. Both artefacts proved byte-identical to a scratch rebuild from source: 79 of 79 Vite content
   hashes and 108 of 108 compiled backend files. **The deployed revision is `ed995c3`, the code this plan analysed.**
2. Resolve the working tree: **`.gitignore` glob applied** (all five backup directories now ignored); the ten deleted
   documents and the untracked `docs/` assets **await an owner decision** — the 20 August catalogue parked them as
   `EXCLUDE-DEFAULT` and that ruling still stands.
3. ~~Deploy phases 0–7 to production~~ — **already deployed on 21 August**; the service has been up one week and
   `prisma migrate status` reports 36 migrations with none pending. **This step does not exist.**
4. ~~Re-run the report's own manual checks.~~ **Done.** `ADM-07b` **closed** (eight FR/EN taxonomy categories live,
   35 packages across all eight). `ADM-10` contrast **closed** (rule present in the served stylesheet). `ADM-06`
   closed on code evidence — the deployed dialog is controlled and the regression spec reproducing the exact symptom
   passes — with one credentialled owner replay outstanding.
5. **Done.** Disposition for all ten findings recorded in the reconciliation note, §6.

**Exit criterion.** Met, pending the two owner decisions in the reconciliation note §6: the ten deleted documents,
and the two-minute ADM-06 replay in the live admin.

**Findings struck from later phases by this evidence:** `ADM-07b` out of Phase 8; `ADM-10` contrast out of Phase 9;
Phase 5's `ADM-06` work reduced to the conflict-case test.

**Baseline recorded:** frontend 108 passed, backend 188 passed across 26 files, migrations current, and one isolated
failure each for the notification, calendar and Zoho workers in seven days — two of them caused by a single
PostgreSQL restart, none chronic.

---

### Phase 1 — Label integrity *(1A, 0.5 day, `ADM-07a`, `ADM-08a`)*

The single highest trust-to-effort ratio in the report.

1. **`ADM-07a`.** In `frontend/src/components/AdminPackagesPanel.jsx:186`, stop routing the reference **count**
   through the **status** formatter. Render it as its own neutral chip:
   `<span className="admin-pill admin-pill--neutral">{packageReferenceCount(pack)} référence(s)</span>`.
   Each offer then carries exactly one status.
2. **`ADM-08a`.** Add `NOTIFICATION_TYPE_LABELS` to `frontend/src/lib/status-labels.js` covering the 18 outbox codes
   in `backend/src/emails/notifications.ts`, keyed by code, each with a business name, an audience
   (client / interne / financier) and a trigger. Introduce `notificationTypeLabel(type)` and use it at
   `AdminDashboard.jsx:1523`. Keep `templateCode` visible as secondary technical detail.
3. **Harden the fallback.** `statusLabel()` must never be the funnel for arbitrary strings. Add a dev-time
   `console.warn` on unknown codes and a unit test asserting that every `ReservationStatus`, `PaymentStatus`,
   `LeadStatus`, `NotificationStatus` and `PackageVersionStatus` enum member has a label.

**Acceptance criteria (report).** *"Chaque offre possède un seul statut compréhensible."* — *"Chaque ligne est
compréhensible sans connaître le code du modèle."*

**Tests.** Unit test over the enum-to-label completeness; Playwright assertion that neither the tariff grid nor the
notification journal renders the string `Statut non reconnu`.

---

### Phase 2 — Deep-linkable views and the reservation record *(1A, 2 days, §2.1, §3.1)*

1. Move `activeTab` from `useState` into the router. Declare real routes: `/admin/tableau-de-bord`,
   `/admin/planning`, `/admin/reservations`, `/admin/paiements`, `/admin/demandes`, `/admin/offres`,
   `/admin/contenus`, `/admin/messages`, `/admin/parametres`, `/admin/conformite`.
2. Extend `lib/admin-deep-links.js` to resolve a two-segment path to a view (today it returns `null` below three
   segments), and keep `?filters=` in the query string so a filtered list is shareable by URL.
3. On login, return to the originally requested URL instead of the overview.
4. Restructure the reservation record per §3.1: header (reference, client, pack, Douala date/time, duration, general
   status); two independent blocks **Paiement** and **Réservation** each with its timestamped history; frozen contact
   details and consents; the transaction block (code, operator, expected vs declared amount, duplicate flag,
   verification result); one merged chronology of e-mails, WhatsApp and Cal.com events with the relevant retry
   actions; internal notes visibly separated from customer-facing reasons; state-appropriate actions only.

**Acceptance criteria (report).** *"Après connexion, l'administrateur doit revenir automatiquement vers le dossier
demandé. Actualiser ou utiliser Retour ne doit pas ramener à la vue d'ensemble."*

---

### Phase 3 — Payments and refunds: one financial module *(1A/P0, 4 days, `ADM-04`)*

Build on the existing refund queue; do not replace it.

**Schema.**
- `Payment`: add `declaredAmount Int?` (what the customer says they sent) and keep `amount` as the expected amount
  derived from `ReservationSnapshot`, or add `expectedAmount Int` explicitly — decide in design, record the choice.
- Add `duplicateOfPaymentId String?` plus an index, so a near-duplicate detected on `transactionRefNormalized` or on
  `(paymentPhone, amount, day)` can be *linked and shown* rather than merely rejected by the unique constraint.
- Do **not** widen `FinancialTask`; refunds stay as they are.

**Backend.**
- `GET /admin/payments` — a first-class verification queue: filters on status, method, date range, amount mismatch,
  duplicate-suspect, reservation status; free-text search on `transactionRef` and `paymentPhone`; `total` in the
  response meta.
- `GET /admin/payments/export.csv` and `GET /admin/financial-tasks/export.csv`, both audit-logged.
- A `paymentAmountVariance` helper comparing declared against snapshot price, surfaced in the list payload.

**Frontend.**
- Rename the tab **Paiements & remboursements**; make it two sub-views — *Vérification* and *Remboursements* —
  reachable at `/admin/paiements/verification` and `/admin/paiements/remboursements`.
- Verification rows show: reference, client, operator, expected vs declared, transaction code, duplicate badge,
  reservation status, age, and the decision actions.
- Keep all three existing actions distinct, as the report demands: *Vérifier et confirmer*, *Vérifier le paiement*,
  *Confirmer la réservation*.
- Restrict the queue to `PAYMENT_DECIDE` rather than to `role === 'OWNER'`, so STAFF can triage.

**State machine (must match the report's table exactly).**
Payment: `En attente · Information requise · Vérification bloquée · Vérifié · Rejeté`, mandatory reason on any
negative or incomplete state. Refund: `À examiner · Autorisé · En cours · Exécuté · Impossible · Abandonné`,
**never announce execution before the real provider reference exists** — already enforced by the immutable proof
block in `AdminFinancePanel`; assert it with a test.

**Acceptance criterion (report).** *"Tout paiement ou remboursement est retrouvable, possède un état, un historique,
un responsable et une référence d'exécution."*

---

### Phase 4 — Decision-first dashboard, reservation search, mobile *(1A, 4 days, `ADM-01`, `ADM-02`, `ADM-03`)*

**`ADM-02` — server-side search.** Rewrite `GET /admin/reservations` (`routes/admin.ts:346`) and replace
`listQuerySchema` with a dedicated `reservationListQuerySchema`:

```
q            free text over reference, first/last name, phone, e-mail, transaction code
status[]     reservation status, repeatable
payment[]    payment status, repeatable
packageId    pack filter
from / to    Douala business-day range on startAt
sort         startAt | createdAt | reference, asc/desc
limit/offset with { total, limit, offset } in meta
```

Search must cover **both** `Customer` and the frozen `ReservationSnapshot` (a customer may have edited their profile
after booking). Add the supporting indexes in the same migration. Wire the already-declared-but-ignored `status`
parameter or delete it — do not leave a lying schema.

Front end: a filter bar whose state lives in the URL query string, saved views persisted per admin, and a reset
button.

**`ADM-01` — action queues.** Add `GET /admin/dashboard` returning counts **and** the deep link that opens each
filtered list: paiements à vérifier, réservations à décider, informations manquantes, reports en attente,
remboursements à traiter, séances du jour, échecs Cal.com, échecs e-mail, demandes non lues. Every count is computed
**in SQL**, not from a 50-row client-side slice.

Replace the four static tiles with the six zones of the report's §14 mock-up (À traiter, Aujourd'hui, Finances,
Intégrations, Demandes, Résumé). Every card is a link to its pre-filtered list.

Fix the revenue definition: *chiffre d'affaires vérifié* must split payments attached to **active**, **cancelled**
and **refunded** reservations, and the headline figure must be net. Rename the fourth counter **Demandes reçues**.

**`ADM-03` — mobile.** Below 768 px, render reservations, payments and notifications as compact cards
(reference, client, time, both statuses, one primary action), details opening in the dedicated record.
Add a Playwright assertion at a 390 px viewport that `document.scrollingElement.scrollWidth <= clientWidth`.

**Acceptance criteria (report).** *"Chaque compteur ouvre la liste filtrée correspondante et aucun indicateur ne
mélange des catégories différentes."* — *"Un dossier est retrouvable par n'importe quelle donnée métier en moins de
trois actions."* — *"À 390 pixels, les données essentielles et l'action principale sont visibles sans défilement
horizontal."*

---

### Phase 5 — Planning, opening hours and availability rules *(P0, 5 days, `ADM-05`; `ADM-06` closure)*

The largest single gap: opening hours are currently a developer operation.

**Schema (new migration `phase_admin_scheduling_rules`).**
- Expose the existing `BusinessHour` through the admin API; add `breaks Json?` for intra-day pauses.
- `ScheduleException { id, date, isClosed, opensAt?, closesAt?, reason, createdById }` — dated exceptions and public
  holidays.
- `BookingRule { id, packageId? (null = global), minNoticeMinutes, horizonDays, dailyCapacity, bufferMinutes }` —
  global defaults overridable per pack.
- Availability computation in `services/availability.ts` and `services/booking-slots.ts` must consume these instead
  of hard-coded values, preserving the existing advisory-lock semantics.

**Backend.** CRUD for business hours, exceptions and booking rules, all audit-logged and `OWNER`-gated;
`GET /admin/calendar/health` returning Cal.com last success, last failure, pending sync count and a test action.

**Frontend.** A `/admin/planning` view with day / week / month agenda showing reservations, holds, blocks and
exceptions; inline creation of a block or exception from a slot; a rules panel; a Cal.com health panel.

**`ADM-06` closure.** Assuming Phase 0 confirms the fix reached production: extend
`frontend/e2e/phase-2-admin-scheduling.spec.js` with a **conflict** scenario (moving a block onto an existing
reservation must show the conflict, not silently fail) and assert the Cal.com sync is emitted exactly once
per accepted reschedule. If Phase 0 instead shows the defect alive in production, this becomes the first task of
this phase.

**Acceptance criteria (report).** *"Le Studio peut modifier ses horaires et exceptions sans développement ; le public
et Cal.com reflètent la règle dans les minutes suivantes."* — *"Le nouveau créneau est enregistré, visible côté
public et synchronisé une seule fois dans Cal.com."*

---

### Phase 6 — Studio settings and editable content *(1B, 6 days, `ADM-09`)*

**Schema.**
- `StudioSetting { key, valueJson, updatedById, updatedAt }` with a typed registry per the report's eight groups:
  Identité, Paiement, Réservation, Livraison, Juridique, Intégrations, SEO, Fonctionnalités.
- `SiteContent { key, locale, body Json, status, version, publishedAt, publishedById }` reusing the catalogue's
  draft → published → history lifecycle, for page copy, FAQ and SEO metadata.

**Backend.** `GET/PUT /admin/settings/:group` and `GET/POST /admin/content/:key` with preview and publish, all
audit-logged; a public `GET /api/site-settings` serving the published projection with cache headers.

**Frontend.** Replace the four hard-coded phone-number call sites (`Contact.jsx:62`, `Footer.jsx:81`,
`WhatsAppFab.jsx:90`, `content/site-metadata.js:227`) and the payment instruction strings in `lib/i18n.js` with the
settings projection. Build `/admin/parametres` and `/admin/contenus` with preview, history and publish.

**Automatic translation.** Per the report, do **not** build side-by-side FR/EN editors. Show generation state,
preview, failures, and an optional correct-or-regenerate action.

**Integration settings.** Feature flags and health/test actions move to the UI; **secrets stay in the environment**.
Say this explicitly in the UI so the owner is not surprised.

**Acceptance criterion (report).** *"Le propriétaire peut modifier les informations ordinaires, prévisualiser et
publier sans déploiement de code."*

---

### Phase 7 — Message library and the notification journal *(1B, 5 days, §8.1, `ADM-08b`)*

**Schema.** `MessageTemplate { code, channel, audience, version, status, publishedAt }` +
`MessageTemplateLocale { templateCode, version, locale, subject, body, preheader }`, seeded from the current
`backend/src/emails/templates.ts` registry (E-01…E-23) so nothing changes on day one. Rendering falls back to the
code registry when no published override exists — the outbox must never lose a template.

`MessageRule { event, delayMinutes, groupingWindowMinutes, maxAttempts, fallbackChannel, isEnabled }` to make the
five-minute grouping and retry policy in `internal-notification-policy.ts` editable.

**Backend.** Template CRUD with version/rollback; `POST /admin/messages/:code/preview` with fake data (reuse the
existing `/admin/communication-preview` machinery); `POST /admin/messages/:code/test-send`; documented variable list
per template; sender name, from address and monitored reply-to as settings.

**Journal (`ADM-08b`).** Add filters to `GET /admin/notifications` — channel, status, type, date, `actionableOnly`,
plus `total`. Hide disabled-channel rows by default (WhatsApp today). Split each row into a business line
(business name, channel, language, trigger, recipient, status, useful action) and a collapsible technical panel
(template code and version, provider status, attempts, provider message id).

**Internal e-mail volume.** Per the report, restrict internal notifications to new requests, significant integration
failures, financial tasks and the daily digest — the policy already exists in code; expose it as editable rules.

**Acceptance criterion (report).** *"Chaque ligne est compréhensible sans connaître le code du modèle ; les anomalies
exploitables sont filtrables."*

---

### Phase 8 — Conditional tariff form *(1B, 3 days, §6.2, `ADM-07b`)*

Rewrite `AdminPackagesPanel.jsx` `fields()` as a conditional form driven by **Mode de réservation**:

| Field | Target behaviour |
|---|---|
| Nom | required |
| Slug | auto-generated from the name; manual override behind an "advanced" toggle |
| Catégorie | controlled list from `CatalogueTaxonomy`; creating a category moves to Paramètres |
| Prix | conditional shape: fixed amount, per month, percentage, or double advantage |
| Devise XAF | fixed display — *the report states explicitly this is not a defect* |
| Mode de réservation | required; drives every other field |
| Durée | required for `DIRECT`; genuinely empty and optional for `CONTACT` |
| Résumé | required to publish, optional as draft |
| Contenu / inclusions / conditions | optional as draft; at least one complete public presentation required to publish |
| Mentions légales | required and explicitly validated before publication (already enforced) |
| Date d'effet | defaults to now, editable for scheduled publication |
| Ordre | drag-to-reorder; numeric field only in advanced mode |
| Livraison | conditional: "Nous contacter" or a validated lead time |

Confirm `ADM-07b` in production: eight category filters on the public page, FR and EN, driven by the taxonomy,
with no code change needed to publish or move a category.

---

### Phase 9 — Exploitation: requests, portfolio, data rights *(1C, 5 days, §7, §10, `ADM-10`)*

**Received requests (§7).**
- Add `CREATIVE` to `LeadType` (migration + backfill by `source`), and point the creative-services form at a new
  `POST /api/creative-requests` instead of `submitQuoteRequest`
  (`frontend/src/pages/CreativeServices.jsx:81` → `backend/src/routes/public.ts:186`).
- Replace `WON`/`LOST` with the report's simple statuses: `NEW`, `IN_PROGRESS`, `HANDLED`, `ARCHIVED`
  (keep the old values as deprecated aliases during the migration).
- Rename the module and the dashboard counter to **Demandes reçues**.
- Add search, filters by type/date/status, contact details, the WhatsApp consent flag, the linked e-mail history,
  a simple note, actions (call, e-mail, open WhatsApp when consented) and CSV export.
- **Out of scope by the report's own instruction:** assignment, pipeline, opportunity value, automated follow-up,
  conversion measurement.

**Portfolio (§10).** Media integrity alerts computed from the existing nullable columns — zero-byte derivative,
unknown dimensions, missing thumbnail, unverified `rightsBasis` — surfaced as an actionable list; file replacement
that preserves history; search, filter, bulk reorder, bulk publish/archive; public-render preview before publishing.

**Data rights (`ADM-10`).** Search by reference/requester/type, due-date and overdue surfacing from the existing
`targetResponseAt`, referenced evidence, response templates, export, and a traced closure step. Re-verify the
contrast fix delivered in Phase 5 accessibility work.

---

### Phase 10 — Governance and security *(report Phase 2, 6 days)*

Deliberately last, as the report requires — *"la sécurité n'est pas exclue : elle est explicitement placée en
phase 2"*. Materially cheaper than it looks, because `AdminRole`, the typed `AdminPermission` set,
`AdminUser.sessionVersion` and `AuditLog` already exist.

1. Named accounts with invitation and deactivation; per-module rights on top of the existing permission set.
2. TOTP two-factor authentication for privileged accounts, with recovery codes.
3. An `AdminSession` table listing active sessions with device, IP and last-seen, plus individual revocation
   (`sessionVersion` already provides the global kill switch).
4. An audit view over the existing `AuditLog` and `AdminCommand` tables, filterable and exportable.
5. Secret rotation procedure and alerts on unusual or repeated sign-in attempts.

---

## 4. Global success criteria (report §13.1) and how each is measured

| Report criterion | Measurement | Delivered by |
|---|---|---|
| A new reservation needs at most three minutes of nominal handling | Timed walkthrough on production, three operators | Phases 2, 3, 4 |
| Every external action has a consultable state and proof | Assert every e-mail, WhatsApp, Cal.com and refund action exposes state + provider reference | Phases 3, 5, 7 |
| The owner can change an offer, a schedule, a rule, a text or a template without a deployment | Owner performs all five unaided, with the developer watching and not intervening | Phases 5, 6, 7, 8 |
| Lists usable on a phone; every record has a clean URL | 390 px Playwright run with zero horizontal scroll; every view and record deep-linked | Phases 2, 4 |
| Technical information available but never replacing business labels | No `Statut non reconnu` anywhere; technical detail confined to secondary panels | Phases 1, 7 |
| FR and EN journeys keep their language end to end | Existing `translation-audit.spec.js` extended to the new admin-published content | Phases 6, 8 |

---

## 5. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Server-side reservation search regresses the current list or misses snapshot-only matches | Search `Customer` **and** `ReservationSnapshot`; add the indexes in the same migration; keep the current behaviour behind the `reference` parameter and test both paths |
| Editable message templates break the notification outbox | Ship templates as **overrides** over the existing code registry; fall back to code when no published version exists; never let a render failure drop an outbox entry |
| Editable business hours desynchronise public availability or Cal.com | Route every rule change through the existing advisory-lock path; add an integration test asserting the public slot API reflects a change within one request |
| Dashboard counters drift from the lists they link to | Compute counter and list from the **same** SQL predicate, shared in one service function; test that the count equals the linked list's `meta.total` |
| Payment schema change (declared vs expected amount) touches money | Additive columns only, no backfill of `amount`; the verification decision path keeps its existing command-id and optimistic-version guards |
| `AdminDashboard.jsx` is 1 873 lines and every phase touches it | Extract one panel per phase into `components/`, as phases 0–7 already began; no phase may add net lines to that file |
| Scope creep into the CRM the report excludes | The §7 out-of-scope list is binding: no pipeline, no assignment, no opportunity value, no automated follow-up |

---

## 6. Sequencing summary

| Phase | Report bucket | Findings | Days | Depends on |
|---|---|---|---|---|
| 0 Reconciliation | — | all (triage) | 0.5 | — |
| 1 Label integrity | 1A | `ADM-07a`, `ADM-08a` | 0.5 | 0 |
| 2 Deep links + record | 1A | §2.1, §3.1 | 2 | 0 |
| 3 Financial module | 1A / **P0** | `ADM-04` | 4 | 2 |
| 4 Dashboard, search, mobile | 1A | `ADM-01`, `ADM-02`, `ADM-03` | 4 | 2, 3 |
| 5 Planning and rules | **P0** | `ADM-05`, `ADM-06` closure | 5 | 0, 2 |
| 6 Settings and content | 1B | `ADM-09` | 6 | 2 |
| 7 Message library + journal | 1B | §8.1, `ADM-08b` | 5 | 6 |
| 8 Tariff form | 1B | §6.2, `ADM-07b` | 3 | 1 |
| 9 Requests, portfolio, data rights | 1C | §7, §10, `ADM-10` | 5 | 4 |
| 10 Governance and security | Phase 2 | §12 | 6 | 9 |

**Total: ~41 developer-days.** Phases 1–5 (16 days) clear every P0 and every 1A deliverable.

---

## 7. Definition of done, per phase

1. Local unit and integration suites green (baseline recorded in the 19 August plan: frontend 95, backend 176).
2. New Playwright coverage for the phase's own acceptance criterion, run against production where the criterion is
   phrased as production behaviour.
3. Migration applied with `prisma migrate deploy`; no pending migrations.
4. A release manifest in the repository's existing `GOLDEN_STUDIO_PLUS_PHASE_*_RELEASE_MANIFEST_*.md` format.
5. **The report's own acceptance sentence replayed on `https://gsplus.vip/admin` and recorded**, with the finding
   marked closed only after that replay.

---

## 8. Annex — limits of this plan

The source report states its own limit: it analyses visible functions and executable journeys, not source code,
infrastructure or security. This plan is the complement — it is grounded in the source code and therefore names
root causes the report could only describe by symptom. Two consequences:

- Where the code already contains the fix (`ADM-06`, `ADM-07b`, `ADM-10` contrast), the remaining work is deployment
  and proof, not development. Phase 0 exists to settle exactly that, and its findings may shorten this plan.
- WhatsApp is not configured. Every WhatsApp-related item — the journal rows, the consent-gated contact action, the
  fallback channel in message rules — is designed here but can only be validated end to end after activation.
