# Golden Studio Plus — implementation plan after the 15–16 August 2026 acceptance report

Date: 19 August 2026
Source: `docs/Rapport_tests_nouvelle_version_Golden_Studio_Plus_2026-08-16.pdf`
Scope analysed: current workspace, including its existing uncommitted changes
Purpose: close the new acceptance findings without regressing the reservation, payment, notification, legal, and calendar guarantees already present

Execution update — 20 August 2026: **Phase 3 is complete in production.** Findings `TAR-01` and `TAR-02` are closed by the versioned catalogue release, explicit OWNER approval, publication hardening, and production replay recorded in `GOLDEN_STUDIO_PLUS_PHASE_3_FINDING_CLOSURE_2026-08-20.md`.

## 1. Executive decision

The report must not be implemented as if the current workspace were identical to the version tested on 15–16 August. The code has moved since that campaign.

The current workspace already contains credible implementations for:

- reservation and lead locale capture, English transactional templates, and locale-aware rendering (`MAIL-01`);
- retention of the date/time entered in the precise-time flow, stale-request protection, and a dedicated Playwright scenario (`CAL-01`, at least for the currently defined “exact available slot” behaviour);
- controlled administrative date/time fields, a durable and versioned reschedule-request workflow, conflict checking, and Cal.com resynchronisation (`CAL-02`);
- an atomic server-side Happy Hours quota check using a booking-day advisory lock;
- the official WhatsApp mark, `#25D366`, keyboard focus, safe-area handling, and collision avoidance (`UI-03`);
- durable `FinancialTask` records and refund state transitions on the backend (`PAY-01`, backend portion only).

Those items are not closed until their migrations and code are deployed and the production acceptance scenarios are replayed. They should be treated as **implemented locally / awaiting deployment proof**, not rebuilt from scratch.

The principal gaps visible when this plan was written were:

1. internal reasons are still reused directly in client e-mails (`MAIL-02`);
2. studio cancellation still builds client copy such as “Remboursement de … à traiter” before the operation starts (`MAIL-03`);
3. WhatsApp consent labels in the four lead forms inherit a dark foreground on dark containers and are duplicated inline (`UI-01`);
4. the public catalogue is still reduced to five hard-coded filters, category inference is heuristic, English package copy is hard-coded in the frontend, benefits are static, and `Identité Standard` is explicitly forced to a booking CTA despite contact mode (`TAR-01`, `TAR-02`);
5. financial tasks exist in the database and command layer but have no first-class administration queue (`PAY-01`);
6. optional lead copy, raw status/operator values, duration wording, and the aggregated “Demandes B2B” label remain inconsistent (`MAIL-04` and forms section);
7. e-mail “deep links” contain database IDs in query parameters, while `AdminDashboard` does not consume those parameters;
8. the English legal notice still contains the literal phrase “French OWNER text”;
9. native date inputs, a client-side locale stored independently of the URL, and one canonical per path do not provide robust date localisation or crawlable multilingual URLs;
10. low-contrast route labels, governance headings, small filter targets, and H1-to-H3 jumps remain structurally possible (`UI-02` and P2 accessibility findings);
11. Cal.com receives the reservation reference only as metadata and uses a hard-coded attendee language; the requested concise calendar presentation is not explicitly encoded (`CAL-03`).

## 2. Current architecture and constraints

### 2.1 Relevant flow

```text
React public forms
  -> Express/Zod public routes
  -> ReservationIntent / Lead
  -> Reservation + immutable ReservationSnapshot
  -> Admin versioned commands
  -> ReservationTransition / PaymentTransition / FinancialTask
  -> NotificationEvent outbox and CalendarSyncLog
  -> SMTP / WhatsApp / Cal.com workers
```

Important properties to preserve:

- `ReservationSnapshot` freezes contact, package, legal consent, price, schedule, and now locale data.
- reservation and payment statuses are independent;
- sensitive admin actions use command IDs, optimistic versions, and audit records;
- booking-window advisory locks protect overlap and daily-quota checks;
- customer e-mails are rendered before delivery and stored in the notification outbox;
- package publication already has draft, validation, publication, archive, and historical version concepts;
- cancellation and rejection already create deduplicated financial obligations;
- Cal.com operations have versioned idempotency keys, payload hashes, retry state, and reconciliation.

### 2.2 Baseline verified during this analysis

- Frontend unit suite: **95 passed, 0 failed**.
- Backend suite: **176 passed, 0 failed across 23 files**.
- Prisma test database: **32 migrations applied, none pending**.

This is a local integrity baseline only. It does not prove the production build contains the current uncommitted changes or that Gmail, Zoho, Cal.com, and WhatsApp behave correctly.

### 2.3 Working-tree constraint

The repository has extensive pre-existing modified, deleted, and untracked files. Before implementation, capture the exact intended patch set and production revision. Do not base a deployment on an undifferentiated commit containing unrelated deletions.

## 3. Finding disposition matrix

| Finding | Current-code disposition | Evidence / remaining gap | Planned phase |
|---|---|---|---|
| `MAIL-01` English journeys receive French e-mails | Implemented locally; production proof required | Locale is captured by public schemas/routes, stored on `ReservationSnapshot` and `Lead`, and used by `renderEmailTemplate`; historical rows default to French | 0 and 1 |
| `MAIL-02` internal notes leak to customers | Open | `Reservation.statusReason`, `Payment.statusReason`, and `decisionReason` are interpolated into external templates; admin dialogs expose only one reason field | 1 |
| `MAIL-03` refund announced too early | Open | cancellation variables still create `Remboursement de X FCFA à traiter`; `E-20`/`E-21` correctly exist for initiated/completed states | 1 |
| `UI-01` unreadable WhatsApp consent | Open | four inline labels inherit foreground colour; no shared consent component or contrast assertion | 1 |
| `CAL-01` entered proposal is cleared | Implemented locally for exact available slots; semantic decision required | controlled `freeDate`/`freeTime`, request gate, and `p1-02.spec.js` exist; flow still accepts only a server-bookable exact slot and holds it like a standard slot | 2 |
| `CAL-02` admin reschedule/block edit resets | Implemented locally; production proof required | controlled `AdminActionDialog`, Douala conversion, durable reschedule commands, conflict checks, and block update service exist | 2 |
| Happy Hours maximum six per day | Implemented server-side; concurrency proof to add | availability and `assertBookableSlot` count reservations plus live intents under a booking-day lock | 2 |
| `TAR-01` incomplete/incoherent public taxonomy | **Closed in production** | Eight stable admin-managed keys, exact FR/EN labels and 35-package membership are versioned and production-proven | 3 |
| `TAR-02` catalogue divergence and wrong CTA | **Closed in production** | Public API/card share one localized projection; slug copy/CTA exceptions are removed; production proves 31 direct and 4 contact offers | 3 |
| `PAY-01` no manageable financial task | Partially implemented | backend model, dedupe, refund command, evidence, and notifications exist; no financial-task list/detail UI or dedicated queue endpoint | 4 |
| Fake admin deep links | Open | notification links use `/admin?reservation=<database-id>` and `/admin?lead=<database-id>`; dashboard reads neither query | 4 |
| `MAIL-04` editorial defects | Open | optional B2B organisation renders “Non renseignée”; internal templates expose raw enums/operators; duration text uses mechanical “heure(s)” | 4 |
| Aggregated “Demandes B2B” counter | Open | the count uses all leads but is labelled B2B | 4 |
| `UI-02` low-contrast labels/governance titles | **Closed in production** | Shared heading styles and documented dark-surface tokens pass direct/client comparison and public/authenticated axe scans | 5 |
| `UI-03` WhatsApp visual identity | **Closed in production** | Official mark, brand colour, safe area, keyboard/modal hiding, and collision avoidance pass the five-width production release matrix | 5 verification only |
| 44 px filter targets | **Closed in production** | Shared and compact public/admin controls have explicit 44 px floors and pass the route control-size scan | 5 |
| H1 to H3 jumps | **Closed in production** | Named section H2 headings and the public route hierarchy matrix prevent unexplained level jumps | 5 |
| English date control can remain French | Open | visible calendar cards are localised, but native `type=date` UI is browser/OS-controlled | 6 |
| English legal phrase contains `OWNER` | Open | literal phrase remains in `Legal.jsx`, `Privacy.jsx`, and `Terms.jsx` | 6 |
| hreflang and distinct multilingual canonicals | Open, architectural | locale is stored client-side while FR and EN share the same URL and canonical | 6 |
| `CAL-03` calendar title/description quality | Open | create request sends attendee and metadata, not an explicit concise GSP title/description; attendee language is fixed to `fr` | 7 |
| WhatsApp end-to-end delivery | Operationally blocked, not a code defect yet | provider is not configured; consent and outbox logic can be tested locally but external proof must wait | 7 |

## 4. Implementation phases

## Phase 0 — Reconcile, freeze, and establish the deployment baseline

**Objective:** identify exactly which post-report fixes are intended for release and prevent stale-production findings from being confused with current-code defects.

### Work

1. Record the current commit SHA, production commit SHA, schema migration table, frontend asset version, and deployment date in a short release manifest.
2. Split or explicitly catalogue all existing workspace changes. Preserve the user’s unrelated edits and deleted documents.
3. Confirm that these migrations are in the intended release set:
   - locale on `ReservationSnapshot` and `Lead`;
   - WhatsApp marketing consent separation;
   - notification overrides and any post-report migrations.
4. Run and archive:
   - `backend: npm test && npm run build`;
   - `frontend: npm test && npm run lint && npm run build`;
   - the existing local Playwright suites for proposal time, rescheduling, catalogue, legal pages, accessibility, and responsive behaviour.
5. Add a release-level acceptance ledger with one row per report ID and columns for code revision, migration, automated evidence, production evidence, owner sign-off, and rollback note.

### Exit gate

- The intended release is reproducible from a named revision or a reviewed patch set.
- No pending Prisma migration exists in the target environment.
- Unit, integration, build, and selected browser suites are green.
- Findings already implemented locally remain “awaiting production proof”, not “closed”.

## Phase 1 — P0 communication boundary and consent readability

**Findings:** `MAIL-01`, `MAIL-02`, `MAIL-03`, `UI-01`.

### 1.1 Create a strict internal/client message boundary

The current generic `reason` is serving two incompatible purposes. Retain a mandatory internal explanation for audit, but never use it as client copy.

Implement a typed decision-copy contract:

- `internalReason`: mandatory, unrestricted operational context within the existing length limit;
- `customerReasonCode`: mandatory for customer-visible adverse decisions, selected from an approved catalogue;
- `customerReasonText`: optional, locale-specific override with a shorter limit and explicit preview;
- `customerLocale`: derived from the immutable reservation snapshot, never from the admin UI locale;
- `customerCopyVersion`: stored with the transition/decision so the exact communication can be reconstructed.

Prefer explicit fields on the relevant transition/request records over hiding the separation only in JSON metadata. Keep `Reservation.statusReason` and `Payment.statusReason` as internal compatibility fields during migration, and remove every external-template read from those fields.

Apply the boundary to:

- payment rejection, payment information request, and verification blockage;
- reservation rejection, studio cancellation, and expiration;
- reschedule rejection;
- any withdrawal decision that later sends client copy;
- manual notification retry/override flows.

Update Zod schemas, admin forms, service command inputs, audit metadata, and notification queue functions together. Reject a command server-side if customer-visible copy is required but absent.

### 1.2 Add server-rendered preview before mutation

Add an authenticated preview endpoint or command mode that calls the same template renderer used by the outbox and returns subject, preheader, text, HTML, locale, and template version without enqueuing a message.

The admin dialog must show:

- the internal note in a clearly labelled private section;
- the approved customer reason selector/editor;
- the final FR or EN preview;
- a warning that the customer preview is the only content leaving the administration boundary.

Do not build a separate frontend-only preview renderer; that would allow preview and delivery to diverge.

### 1.3 Remove premature refund claims

- Change studio-cancellation and paid-rejection messages to neutral wording: the financial situation is under review and a separate notification will be sent if/when an operation is initiated or completed.
- Do not interpolate the task amount, “refund due”, or “refund to process” into the initial customer cancellation message.
- Keep `E-20` as the first message allowed to state that a refund has started, only when `Payment=REFUND_PENDING`, `FinancialTask=IN_PROGRESS`, and channel plus provider reference are stored.
- Keep `E-21` for completion only when `Payment=REFUNDED`, `FinancialTask=COMPLETED`, and completion evidence exists.
- Internal `I-05`/`I-06` messages may retain amount and operational instructions.

### 1.4 Make consent presentation shared and testable

Create a shared `TransactionalWhatsAppConsent` component used by Services, Corporate, Contact, and Creative Services. Give it a semantic label, optional explanatory text, a shared high-contrast token, visible focus, a minimum 44 px checkbox/label interaction area, and an error/help association where phone becomes conditionally required.

Move the foreground/background values into global theme tokens. Avoid duplicated inline styles.

### Tests

- Matrix every customer event code in FR and EN using the snapshot locale.
- Inject strings such as `TEST-AUDIT`, `paiement simulé`, and an internal instruction into `internalReason`; assert they are absent from subject, text, HTML, WhatsApp payload, and stored customer-visible variables.
- Assert preview content exactly equals the subsequently stored `NotificationEvent.renderedContent` for the same command.
- Assert initial cancellation/rejection messages contain neither a refund amount nor a claim that a refund will occur.
- Assert `E-20`/`E-21` cannot queue without their required persisted state/evidence.
- Run axe and computed-contrast checks on all four lead forms in FR/EN at desktop and 390 × 844; target at least 4.5:1 for normal text.

### Exit gate

- No customer channel can read an internal-reason field.
- Every English reference journey receives English for all covered event types.
- Initial cancellation copy is financially neutral.
- All four consent labels meet contrast and keyboard criteria.

## Phase 2 — P0 scheduling closure and concurrency proof

**Findings:** `CAL-01`, `CAL-02`, Happy Hours capacity limitation.

### 2.1 Close the meaning of “Proposer mon horaire”

The current implementation preserves the values but only accepts a precise time that the availability API already exposes and then creates the same kind of blocking `ReservationIntent`. That is safe, but it is not necessarily the business meaning of “propose a time when no standard slot suits”.

Make one explicit product decision and encode it in UI, API, and tests:

- **Recommended report-aligned behaviour:** support a non-confirmed custom proposal. Add an intent/schedule kind such as `STANDARD_HOLD` versus `CUSTOM_PROPOSAL`; persist requested start/end and Douala timezone; do not represent a proposal as confirmed availability; show it distinctly in admin; re-run `assertBookableSlot` when the Studio accepts it; only then create/replace the blocking schedule and synchronise Cal.com.
- If the owner intends only precise lookup of standard slots, rename the action to “Vérifier un horaire précis” / “Check a specific time” and document that unavailable/off-grid proposals are not accepted. Do not leave the UI semantics ambiguous.

For the report-aligned option, snapshot the proposal kind and requested time, and ensure payment/booking copy says “requested” until an admin confirms it.

### 2.2 Deploy and strengthen the current reschedule implementation

Preserve the existing versioned two-step flow:

1. create a durable request without changing the current slot;
2. owner accepts or rejects;
3. acceptance locks the booking day, checks conflicts/quota/business rules, updates the reservation under optimistic version control, writes a transition, queues the correct locale message, and calls calendar sync;
4. calendar sync updates/replaces the prior external booking idempotently.

Add browser tests that edit a `datetime-local` value and a calendar block, blur/focus fields, submit, refresh, and verify the new values. Existing source-presence tests are insufficient for the reset defect observed in production.

### 2.3 Prove the Happy Hours quota under concurrency

Add an integration test that creates six blocking reservations/intents for one Happy Hours date and races two attempts for the seventh place. Assert:

- at most six survive;
- the loser receives `PACKAGE_DAILY_QUOTA_REACHED`;
- another eligible date remains available;
- expired intents no longer count;
- rescheduling away from the date releases capacity;
- availability display and command enforcement agree.

### Exit gate

- The proposal behaviour has one unambiguous contract and production wording.
- Admin reschedule and block edits persist after refresh.
- A confirmed reschedule has exactly one current Cal.com event and no usable old event.
- The seventh concurrent Happy Hours attempt is rejected by the server.

## Phase 3 — Authoritative, versioned catalogue taxonomy and content

**Findings:** `TAR-01`, `TAR-02`.

**Status — 20 August 2026:** **complete and deployed.** Exact closure evidence, revisions, tests, OWNER sign-off, and rollback are recorded in `GOLDEN_STUDIO_PLUS_PHASE_3_FINDING_CLOSURE_2026-08-20.md`.

### 3.1 Replace heuristic categories with an authoritative taxonomy

Create an admin-managed, ordered taxonomy representing the eight approved public sections:

1. Portraits & identité;
2. Couples, familles & groupes;
3. Maternité, bébé & enfant;
4. Anniversaires;
5. Fiançailles & pré-mariage;
6. Événements;
7. Créateurs & entreprises;
8. Privilèges Golden — Promotion.

Use stable keys and localized labels. Assign the taxonomy key in the versioned package content; do not derive it from free-form category text in `frontend/src/lib/packages.js`.

Model student and referral benefits as versioned catalogue benefits, not hard-coded frontend arrays and not fake bookable packages. Their conditions, order, locale, publication state, and effective dates must be administered and auditable.

### 3.2 Make localized package content part of publication

Move the hard-coded English maps and slug-specific copy from the frontend into versioned localized package records (for example `PackageVersionLocale` keyed by package version and locale). Include name, description, content, inclusions, conditions, delivery label, and mandatory public wording.

Publication validation must ensure:

- an approved FR source exists;
- EN fields are complete when EN publication is enabled;
- no unknown category key is used;
- booking mode and duration are coherent;
- the public preview is generated from the same projection as `/api/packages`;
- any enrichment absent from the owner catalogue is explicitly approved and versioned.

### 3.3 Correct the CTA contract

Derive CTA solely from the published booking mode:

- `DIRECT` with a valid duration -> booking URL and “Réserver ce pack” / “Book this package”;
- `CONTACT` -> contact/quote destination and “Nous contacter” / “Contact us”.

Remove the `identite-standard` exception in `packageCtaLabel()`.

### 3.4 Reconcile the official catalogue

Use the existing official catalogue import/verification scripts to create a reviewed migration preview. Compare all 35 tariffs plus the two benefits field-by-field against the 4 August source. Do not publish automatically. Owner validation remains the publication gate.

### Tests

- Exact membership test for every one of the eight sections in FR and EN.
- No package appears in more than its approved primary section unless an explicit secondary classification is modelled and approved.
- `Classic Propre` public fields equal the approved version, including delivery, retouching, makeup, and conditions.
- `Identité Standard` renders a contact CTA and cannot enter direct reservation.
- Public API, preview, and rendered card use the same version/localisation.
- Publication fails for missing/unknown taxonomy or incomplete enabled locale.

### Exit gate

- All 35 tariffs and two benefits are attributable to an approved version.
- Eight public sections exist and have exact FR/EN membership.
- No slug-specific commercial copy or CTA rule remains in the frontend.

Closure: **all Phase 3 exit requirements met in production**; `TAR-01` and `TAR-02` closed on 20 August 2026.

## Phase 4 — Financial operations, real admin destinations, and editorial cleanup

**Findings:** `PAY-01`, fake deep links, `MAIL-04`, aggregated lead label.

### 4.1 Expose the existing financial task lifecycle

Add an owner-authorised “Paiements & remboursements” queue backed by `FinancialTask`:

- filters for pending, in progress, completed, failed, overdue, reservation reference, and operator;
- task detail with amount, reason, due date, responsible admin, payment and reservation links, channel, provider reference, timestamps, and immutable proof;
- actions to engage and complete the refund through the existing versioned refund command;
- no generic “mark done” endpoint that bypasses payment transition and evidence requirements;
- dedupe visibility so one financial obligation cannot be performed twice.

Add a dedicated paginated endpoint rather than depending only on nested reservation detail. If task assignment is required, add `assignedToId` and assignment audit events explicitly.

### 4.2 Make internal links resolve a real destination

Use stable public/business references, not raw database IDs, in e-mail URLs. Recommended routes:

- `/admin/reservations/GSP-…`;
- `/admin/leads/<stable-lead-reference>`;
- `/admin/finance/<task-id-or-reference>`.

Update React routing to accept authenticated admin subroutes, load the intended record after login, select the appropriate tab, open/focus the record, and show a clear not-found/stale message. Preserve the destination through an expired login session.

Add a durable unique lead reference instead of synthesising one from the tail of a database ID at render time.

### 4.3 Finish e-mail editorial formatting

- Suppress the complete “on behalf of …” segment when organisation is absent; never render “Non renseignée” in customer prose.
- Localise the full subject, not only the body.
- Centralise display labels for payment operators and statuses; do not show `PENDING` or `mtn_momo` in business-facing copy.
- Replace decimal-hour strings with a locale-aware duration formatter (`9 j 15 h 36 min`, for example).
- Keep internal technical codes available in structured metadata/log detail, not in the human headline.
- Rename the dashboard count to “Demandes” or split it by Contact/B2B/Devis so its label matches its query.

### Tests

- Cancel a paid reservation twice and assert one task and one allowed financial progression.
- Assert completion requires provider reference and proof and queues `E-21` once.
- Open each internal e-mail link both authenticated and after login; assert the intended record is focused.
- Snapshot customer and internal subjects/bodies for optional organisation, each operator, every relevant status, and long durations in both locales.

### Exit gate

- Every open financial task is visible and actionable by an authorised owner.
- Client notification occurs only after evidenced initiation/completion.
- Every internal e-mail link opens its intended record.
- No placeholder or raw enum appears in human-facing e-mail copy.

Closure: **all Phase 4 exit requirements met in production**; `PAY-01`, fake deep links, `MAIL-04`, and the aggregated lead label were closed on 21 August 2026. Deployment and verification evidence is recorded in `GOLDEN_STUDIO_PLUS_PHASE_4_RELEASE_MANIFEST_2026-08-21.md`.

## Phase 5 — Accessibility, contrast, hierarchy, and touch targets

**Findings:** `UI-02`, touch targets, heading structure; verification of `UI-03`.

### Work

1. Move reusable route-heading and eyebrow styles from lazy page CSS into a global theme/module imported unconditionally. The current `.home-section-label` dependency on `Home.css` explains why direct visits to other routes can render it incorrectly.
2. Define semantic text tokens for dark surfaces (primary, secondary, muted, accent, disabled) with documented contrast ratios. Replace arbitrary low-alpha inline colours where they carry information.
3. Scope admin heading colours to the admin dark surface, including governance `h2`/`h3`, summaries, labels, and help text.
4. Insert meaningful section `h2` headings before groups of `h3` cards on Services, Portfolio, Corporate, Contact, and Creative Services. Use visually hidden headings only when a visible title would genuinely duplicate nearby content.
5. Give service/category filters and other compact controls a minimum 44 × 44 CSS pixel target without relying on text height.
6. Re-run the WhatsApp FAB matrix at 320, 390, 768, 992, and 1280 widths, with keyboard open, dialogs open, and the final form controls visible.
7. Add production accessibility scans for all public routes and the authenticated governance/admin views; fail on serious/critical axe violations and on a maintained list of contrast targets.

### Exit gate

- Direct navigation and client-side navigation produce identical readable styles.
- Normal text meets 4.5:1 and large text meets 3:1.
- Heading order has no unexplained level jump.
- interactive targets meet the 44 px target and the WhatsApp FAB overlaps none of them.

Closure: **all Phase 5 exit requirements met in production**; `UI-02`, compact touch targets, heading hierarchy, dark-surface contrast, and the `UI-03` WhatsApp overlap verification were closed on 21 August 2026. Deployment and verification evidence is recorded in `GOLDEN_STUDIO_PLUS_PHASE_5_RELEASE_MANIFEST_2026-08-21.md`.

## Phase 6 — Multilingual URL, legal copy, and date architecture

**Findings:** English date localisation, `OWNER` phrase, hreflang/canonical strategy.

### 6.1 Immediate legal copy correction

Replace the three literal notices with owner-approved legal wording such as: “This English translation is provided for convenience. The French version remains authoritative.” Apply the same source-driven approach to all three pages and test absence of the token `OWNER` in public output.

### 6.2 Make locale part of the URL

Adopt crawlable routes, preferably `/fr/...` and `/en/...`, with:

- one canonical per locale URL;
- reciprocal `hreflang="fr"`, `hreflang="en"`, and `x-default`;
- localized metadata, structured-data language, navigation, legal links, and sitemap entries;
- redirects or a documented compatibility route from current unprefixed paths;
- locale derived from the route first, with storage only as a convenience for later navigation;
- private `/admin` remaining unprefixed and `noindex`.

Update the prerender script and production metadata tests; a runtime language toggle on a single canonical URL is insufficient for dependable indexing.

### 6.3 Replace locale-unstable native date presentation

Native `input[type=date]` chrome follows browser/OS behaviour and cannot reliably be forced by React locale. Keep an ISO value for submission but provide a controlled, accessible date picker or segmented date fields whose visible month/day labels come from the active route locale. Preserve keyboard entry, screen-reader labels, min/max constraints, mobile usability, and Douala conversion.

Use one locale-aware formatter library/helper for public dates, e-mails, admin dates, and calendar descriptions. Never parse a display string back into a business instant.

### Exit gate

- No public legal page exposes internal editorial vocabulary.
- FR and EN have distinct stable URLs, canonicals, alternates, prerendered HTML, and sitemap entries.
- An English booking journey displays English date labels across supported browsers and still submits the correct Douala instant.

## Phase 7 — Calendar presentation, external integrations, and final acceptance

**Findings:** `CAL-03`, unconfigured WhatsApp, remaining external checks.

### 7.1 Calendar presentation

First validate the currently deployed Cal.com API/event-type capabilities against the official API version used by the backend. Then encode the best supported presentation:

- concise identifier equivalent to `GSP-… — Pack — Client`;
- reference prominently available;
- Douala start/end, phone, localized payment label, safe operational notes, and a working admin link in supported booking fields/metadata;
- attendee language derived from the reservation snapshot, not hard-coded `fr`;
- no secret or unrestricted internal note sent to Cal.com.

If Cal.com derives the visible title from event type and attendee name and does not support a safe per-booking title, configure concise event-type names and document the provider limitation rather than sending unsupported payload fields.

### 7.2 External proof runs

After deployment, execute a new isolated five-journey matrix equivalent to the report:

- FR + Orange Money + direct pack + verify-and-confirm;
- EN + MTN MoMo + Happy Hours + missing validation then reject/refuse;
- EN + Orange Money + verify, confirm, studio cancel, engage refund, complete refund;
- FR + direct pack + reminder;
- EN + rapid payment/reservation decisions within five minutes to prove intermediate notification cancellation.

Also execute:

- four public lead forms in FR and EN;
- all direct-package links plus all contact-mode CTAs;
- accepted and rejected reschedule with old/new Cal.com inspection;
- six Happy Hours bookings and blocked seventh attempt;
- one digest with useful actions and one empty-digest window;
- manual Zoho message showing the exact “Golden Studio Plus” sender identity;
- Gmail/Zoho mobile rendering check;
- WhatsApp consent/no-consent scenarios only after provider configuration, including retries and no duplicates.

Use dedicated QA customers, payment references, and reason text. Never put `TEST-AUDIT` or simulation instructions in a field eligible for customer delivery.

### Exit gate

- External Gmail/Zoho and Cal.com evidence matches stored outbox/sync records.
- WhatsApp is either fully configured and proven or explicitly feature-gated as unavailable; it is never represented as production-validated without proof.
- Every P0 and P1 matrix row has automated evidence plus production evidence.
- P2 items are closed or explicitly accepted with owner rationale.

## 5. Recommended implementation order and dependencies

```text
Phase 0 baseline
  -> Phase 1 communication/consent safety
  -> Phase 2 scheduling proof
  -> Phase 3 catalogue source of truth
  -> Phase 4 finance/admin destinations/editorial cleanup
  -> Phase 5 accessibility hardening
  -> Phase 6 multilingual URL/date migration
  -> Phase 7 external acceptance
```

Phase 1 must precede any further production acceptance that sends customer messages. Phase 3 must precede the final “31 direct links”/catalogue replay because it changes category and CTA contracts. Phase 4 must precede the paid-cancellation proof because the acceptance operator needs the financial queue. Phase 6 should ship as its own routing/SEO release or behind redirects, not be mixed silently into the P0 hotfix.

Phases 3 and 5 can be developed in parallel after Phase 1 if their database migrations and CSS changes remain isolated. Final acceptance remains sequential after all release candidates are deployed.

## 6. Definition of done

A finding is closed only when all applicable conditions are true:

1. the behaviour is implemented in the authoritative backend/frontend layer;
2. schema changes have a reviewed forward migration and a rollback/compatibility plan;
3. unit/integration/browser coverage reproduces the original failure and proves the fix;
4. customer-visible text is verified in FR and EN;
5. concurrency/idempotency is tested for booking, financial, notification, and calendar commands;
6. accessibility checks cover desktop, mobile, keyboard, and direct-route loading;
7. production deployment revision and migration state are recorded;
8. Gmail/Zoho, Cal.com, and—once configured—WhatsApp external evidence is attached;
9. the traceability matrix links the finding to code, tests, deployment, and owner sign-off;
10. no unrelated working-tree change is silently included in the release.

## 7. Highest-risk regressions to guard against

- changing reason fields without preserving historical audit trails;
- rendering the preview in a different layer from the actual outbox message;
- treating a proposed time as a confirmed/blocking slot;
- bypassing the advisory lock when adding quota logic to a new command path;
- duplicating refund tasks or announcing financial completion before evidence;
- moving translated package copy to the database without versioning and publication validation;
- breaking existing unprefixed URLs during `/fr` and `/en` migration;
- trusting native date-control locale while storing the wrong instant;
- adding unsupported Cal.com fields or leaking internal notes into provider metadata;
- declaring post-report local changes complete before their production revision is proven.

## 8. First release slice

The safest first deployable slice is Phase 0 plus Phase 1 and the already implemented portions of Phase 2. It closes the confidentiality/accessibility blockers, proves English routing, removes premature financial wording, and deploys the scheduling fixes without waiting for the larger catalogue and multilingual-URL refactors.

That slice must include a production replay of one FR and one EN reservation, a paid studio cancellation without premature refund language, all four consent forms, one accepted reschedule, and the Happy Hours seventh-attempt test.
