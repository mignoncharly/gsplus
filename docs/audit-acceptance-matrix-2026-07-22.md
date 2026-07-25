# Golden Studio Plus — Audit Acceptance Matrix

Date: 2026-07-22
Canonical production origin: https://gsplus.vip
Business timezone: Africa/Douala

This matrix is the release contract for the July 2026 remediation. An item is complete only when its implementation, automated regression test, and production smoke check all pass. A passing legacy test alone is not sufficient.


## Remediation progress

| Phase | Status | Production evidence |
|---:|---|---|
| 0 | Complete | Audit baseline, protected recovery assets and acceptance matrix established. |
| 1 | Complete | Domain foundation deployed and verified; see `phase-1-domain-foundation-2026-07-22.md`. |
| 2 | Complete | Booking/payment integrity deployed and verified; see `phase-2-booking-integrity-2026-07-23.md`. |
| 3 | Complete | Admin workflows and tariff lifecycle deployed and verified; see `phase-3-admin-workflows-2026-07-23.md`. |
| 4 | Complete | Notification outbox, consent and legal validation deployed and verified; see `phase-4-notification-outbox-2026-07-23.md`. |
| 5 | Complete | Safe rescheduling and calendar reliability deployed and verified; see `phase-5-calendar-reliability-2026-07-24.md`. |
| 6 | Complete | Submission reliability and stale-state protection deployed and verified; see `phase-6-submission-reliability-2026-07-24.md`. |
| 7 | Complete | Accessibility, navigation and responsive integrity deployed and verified; see `phase-7-accessibility-navigation-2026-07-24.md`. |
| 8 | Complete | Curated media pipeline and responsive portfolio deployed and verified; see `phase-8-media-pipeline-2026-07-24.md`. |
| 9 | Complete | July 2026 legal/editorial publication deployed and verified; see [Phase 9 report](phase-9-legal-editorial-2026-07-24.md). |
| 10 | Complete | Performance budgets, private static masters, route splitting, crawlable route metadata/schema and reduced-motion safeguards deployed and verified; see [Phase 10 report](phase-10-performance-seo-2026-07-24.md). |
| 11 | Complete | Security boundary, proxy trust, headers/CSP, CORS, sessions, throttling, honeypots, upload limits, safe errors and dependency evidence deployed and verified; see [Phase 11 report](phase-11-security-hardening-2026-07-24.md). |
| 12 | Complete | Recoverable baseline, protected credentials without owner-prohibited rotation, private Git baseline and split QA harness; see `phase-12-baseline-secrets-source-control-2026-07-25.md`. |
| 13 | Complete | All supplied service media and canonical logo derivatives published with protected manifests; see `phase-13-14-media-social-sharing-2026-07-25.md`. |
| 14 | Complete | Official Facebook/Instagram, distinct business actions and cross-platform sharing metadata deployed; see `phase-13-14-media-social-sharing-2026-07-25.md`. |
| 15 | Complete with reviewed exception | Runtime/tooling separation, client-only guard and indexing policy complete; React Router RSC-only exception expires 2026-08-25; see `phase-15-dependencies-indexing-qa-2026-07-25.md`. |
| 16 | Complete for e-mail; WhatsApp deferred | Historical dead letters classified and fresh exactly-once SMTP delivery provider-accepted; see `phase-16-email-outbox-2026-07-25.md`. |
| 17 | Complete except external payment proof | Real-browser production flows and terminal cleanup reconciled; legitimate payment/Cal.com lifecycle awaits operator sandbox or owner-authorized transaction; see `phase-17-production-acceptance-2026-07-25.md`. |
| 18 | Pending external/root evidence | All automated matrices pass; Nginx hash sync, mailbox receipt and legitimate payment/calendar evidence remain; see `phase-18-non-legal-readiness-2026-07-25.md`. |

## Critical findings

| ID | Finding | Phase | Required acceptance evidence |
|---|---|---:|---|
| C-01 | Public and admin appointment times differ by two hours | 1–2 | One UTC instant displays as the same Douala time in public UI, admin UI, email and calendar. Test browsers in Douala, UTC and Europe/Berlin, including midnight boundaries. |
| C-02 | Payment reference changes between booking steps and admin | 1–2 | The server creates one unique reference before payment; payment instructions, confirmation, API, database, notifications and admin all reuse it. Idempotent retries cannot create another. |
| C-03 | Transactional emails fail SMTP authentication | 4 | Delivery works through an idempotent outbox; failures expose a safe error, retry with backoff and cannot duplicate a delivered message. Provider acceptance is proven; owner mailbox receipt remains pending. |
| C-04 | Admin availability blocks do not reliably affect public slots | 1–2 | Douala-time block create/edit/delete immediately changes public availability; transactional overlap checks prevent concurrent bypass. |

## High findings

| ID | Finding | Phase | Required acceptance evidence |
|---|---|---:|---|
| H-01 | Contact reports an error after successful submission | 6 | One successful API call creates one lead, safely resets the form and shows stable success without a JavaScript error. |
| H-02 | Privacy policy does not match collected data | 9 | Published text covers all collected data, processing, providers, retention, consent and statutory rights. |
| H-03 | Form labels, names and semantics are incomplete | 6–7 | Controls have associated labels, names, autocomplete and error descriptions; axe and keyboard checks pass. |
| H-04 | Routes inherit the previous scroll position | 7 | Forward navigation starts at top; browser back/forward restores history position on desktop and mobile. |
| H-05 | B2B reports currentTarget.reset error after success | 6 | One lead is stored, reset is safe, success is stable and repeat clicks cannot duplicate the request. |
| H-06 | WhatsApp notifications are absent/unverified | 4 | Feature-flagged WhatsApp Business delivery supports templates, E.164, transactional consent, provider IDs, webhooks, retries and privacy-safe payloads. Production activation is deferred. |
| H-07 | Proposed-time mode loses state or reuses a stale slot | 2, 6 | Booking modes have isolated state; only a server-verified slot enables Continue; switching modes cannot retain an old selection. |

## Medium findings

| ID | Finding | Phase | Required acceptance evidence |
|---|---|---:|---|
| M-01 | Arbitrary payment transaction references are accepted | 2–3 | Method-specific server validation/normalization and uniqueness reject invalid or duplicate references; verification remains manual. |
| M-02 | Portfolio is nearly empty and exposes technical categories | 8 | Database media augment the gallery correctly; public categories are curated and hero/QA_TEST never appear. |
| M-03 | Images are excessively heavy | 8, 10 | Masters remain private; correctly typed responsive derivatives have dimensions, lazy loading and page-weight budgets. |
| M-04 | Metadata is duplicated; canonical/schema data are absent | 10 | Every indexable route has unique metadata, canonical https://gsplus.vip URL, social metadata and valid LocalBusiness data in crawlable output. |
| M-05 | Mobile menu is translucent/incompletely accessible | 7 | Dynamic labels, expanded/controls state, Escape, focus management, background inertness, scroll lock and contrast pass. |
| M-06 | Admin exposes technical statuses and weak action context | 3 | French statuses/actions, confirmations/reasons and actor/old/new state history are present. |
| M-07 | Admin loading is unclear and messages become stale | 3 | Tabs/actions own busy and feedback states; stale content/toasts do not persist; feedback receives appropriate focus. |
| M-08 | Portfolio upload succeeds but reset throws | 6, 8 | One item is created, the form resets safely and no false failure/stale toast appears. |
| M-09 | Package CTA is unreadable until hover | 7 | CTA contrast passes at rest, hover, focus and touch across every card. |
| M-10 | Footer shortcuts are mislabeled social links pointing to # | 7 | Business shortcuts are correctly labeled; official Facebook/Instagram links work; LinkedIn stays hidden until configured; no action uses #. |
| M-11 | Tariff admin supports only price editing | 1, 3–4 | Create, duplicate, preview, edit, order, activate, deactivate and archive work; referenced packages cannot be destructively deleted; legal/version fields validate. |

## Low findings

| ID | Finding | Phase | Required acceptance evidence |
|---|---|---:|---|
| L-02 | French copy has missing accents/inconsistent English | 9 | Public copy matches the approved recommendations and editorial checklist. |
| L-03 | Legal information is incomplete or dated | 9 | July 2026 drafts are published consistently and reviewed after missing company particulars arrive; no facts are invented. |

## Additional regression obligations

- No horizontal overflow at 375, 390, 412, 414, 768, 1280 or 1440 CSS pixels in Chromium and WebKit; scrollWidth must not exceed clientWidth.
- Fix the actual 768px footer/grid breakpoint instead of masking it with overflow clipping.
- No broken maternity/media URLs.
- Provide a skip link, visible focus, branded favicon and correctly labeled social links.
- Add route splitting, critical-image priority, lazy loading and reduced-motion/performance safeguards.
- Preserve required-field validation, overlap protection, pending manual payments, Helmet and API rate limiting.

## Domain transition contract

- Reservation and payment statuses are independent.
- Verifying payment never confirms a reservation.
- Reservation targets: PENDING_CONFIRMATION, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW, REJECTED, EXPIRED.
- Payment targets: PENDING, VERIFIED/approved equivalent, REJECTED, FAILED, EXPIRED, REFUND_PENDING, REFUNDED.
- The server enforces every transition.
- Rejection, cancellation, rescheduling, refund and restoration require a recorded reason.
- Calendar/notification failure is visible and retryable but cannot silently rewrite business status.

## Deferred or externally gated inputs

The following do not authorize invented data or synthetic production verification:

- WhatsApp Business account, credentials, webhook secret, approved templates and consented test number: deferred by owner.
- Official LinkedIn company URL: remains hidden until supplied.
- Complete Golden Studio Plus legal-company particulars: deferred by owner and excluded from non-legal readiness.
- Operator sandbox or owner-authorized real mobile-money transaction: required for genuine payment verification and dependent Cal.com lifecycle proof.
- Owner mailbox access: required only to confirm human receipt of the already provider-accepted QA messages.
- Root privilege: required to copy the versioned Nginx file and reload Nginx with the current JSON-LD CSP hash.

SMTP delivery, supplied-image approval, the canonical logo, Facebook/Instagram publication and the kernel reboot are complete.

The canonical host is https://gsplus.vip.
