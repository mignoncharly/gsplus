# Phase 9 — Legal publication and editorial alignment

Date: 2026-07-24  
Canonical origin: https://gsplus.vip  
Status: complete; deployed and verified in production

## Acceptance contract completed

- H-02 is complete: the published privacy policy now covers every public form and reservation field, technical and administrative data, image processing, purposes, legal grounds, active and optional providers, retention rules, consent mechanisms, cookies, security and statutory rights.
- L-02 is complete: the approved French accents and wording from the 21 July 2026 recommendations are applied across the home, services, about, B2B, contact and reservation experiences.
- L-03 is complete for all verified information: the July 2026 legal drafts are published consistently and cross-linked. Missing official particulars are identified as awaiting validation; no RCCM, NIU, capital, legal identity, publication director or hosting identity was invented.

## Sources and reconciliation

The implementation was reconciled against:

- `projet-textes-legaux-gsplus-2026-07-21_modif.docx`;
- `03_recommandations-administration-et-textes-gsplus-2026-07-21_modif.docx`;
- the current Prisma schema, public validation schemas and all reservation/contact/B2B/creative form payloads;
- notification, calendar, anti-abuse, session, media and server-log behavior;
- the official Presidency publication of [Law No. 2024/017 of 23 December 2024](https://www.prc.cm/fr/actualites/actes/lois/7588-loi-n-2024-017-du-23-decembre-2024-autorisant-le-president-de-la-republique-a-ratifier-le-traite-de-beijing-sur-les-interpretations-et-executions-audiovisuelles-adopte-le-24-juin-2012-a-beijing-chine-9).

Production configuration was classified without exposing credentials:

- Cal.com is active for confirmed reservations and receives only the booking attendee and event data required by the calendar operation.
- Zoho SMTP is configured but automatic email delivery is currently disabled.
- WhatsApp Business automatic delivery and Cloudflare Turnstile are currently disabled.
- Nginx technical logs use 14 daily rotations.
- The public site has no advertising or audience-measurement cookie. The admin session cookie is strictly necessary, HTTP-only and limited to eight hours.

## Published legal set

All three pages display `Dernière mise à jour : 24 juillet 2026` and link to each other:

- `/confidentialite`;
- `/mentions-legales`;
- `/cgv`.

The privacy page contains a machine-testable provider and retention register shared with the rendered tables. It distinguishes active services from configured or optional disabled services and describes the data each would receive.

The terms retain the approved commercial rules: 100% payment before final confirmation, manual payment control independent of the reservation decision, five-minute delay rule, 48-hour cancellation/report rules, copyright and image authorization, digital processing and amicable resolution before competent Douala courts.

The legal page publishes only verified brand, activity, location and contact information. It explicitly lists the official particulars still awaiting documentation.

## Editorial corrections

The approved wording is now public, including:

- `Livraison sous 48 h` / `Livraison sous 72 h`;
- `Idéal pour un profil professionnel`, `Direction éditoriale`, `Séance à deux`;
- `Séances photo`, `Services de design`, `Impression et produits`;
- accented package/category names and `À partir de`, `Journée`;
- the approved About, B2B, contact, opening-hours and reservation guidance.

The floating WhatsApp control now uses the bundled icon component. It no longer loads an image from Wikimedia at runtime.

## Automated verification

- Backend TypeScript production build: pass.
- Backend Vitest suites: 43/43 tests passed; all nine migrations applied to the test database.
- Production migration status: nine migrations found, database up to date.
- Frontend ESLint: pass with zero warnings.
- Frontend Node suites: 19/19 tests passed, including four new legal/editorial contracts.
- Isolated Vite production build under `/tmp/gsp-phase9-build.2sQ787`: pass.
- Local Phase 7–9 Chromium/WebKit acceptance: 24/24 tests passed.
- The preserved accessibility suite covers all three expanded legal pages with axe.
- Legal tables have no page-level overflow at 375, 768 or 1280 CSS pixels in Chromium or WebKit.
- Read-only canonical Phase 9 Chromium/WebKit smoke: 4/4 tests passed.
- Canonical privacy route and release asset: HTTP 200.
- Canonical and loopback health endpoints: healthy.

Dependency-audit exceptions are unchanged:

- frontend: two high findings for the React Router RSC/server-action advisory; this Vite SPA does not use that server mode, and the forced 7.11 downgrade is not accepted;
- backend: four moderate findings only through Prisma CLI development-server transitives, not the production API imports.

Vite reports the main 540.82 kB minified bundle advisory. Route splitting and broader performance budgets remain Phase 10 scope.

## Production rollout

Phase 9 contains no backend, database or production-configuration change. No database backup, migration or backend restart was required.

The final frontend was built under `/tmp`, then published with exact deletion semantics. Published hashes exactly match the isolated artifact:

```text
54b0f38bf7ec5abfcfd7eecc35877f1f44affdd3d7a1241b7968680c3b781aa4  index.html
f8c349c8c0b3b4f9d18cebaa72eda1e2950b45fbc6e008f2cd53aad67d45b0ea  assets/index-D8K6L-D-.css
d73805990389091e968d49b9eb19d9d7aca0e99221239fb25d72f0fa0cd1d1ec  assets/index-D_2KPIZa.js
```

## Recovery

The exact verified Phase 8 isolated artifact was archived before the final Phase 9 publication:

```text
e95e905729a0f547cc6f8d37f6e80d36c704d82fca6367a5b948f0e34b7ac388  frontend-dist-pre-phase9.tar.gz
```

The archive is mode 0600, readable by `tar`, and stored under:

```text
/var/www/goldenstudioplus/.phase0-backups/20260722-204951/
```

Its archived Phase 8 release hashes match the previously documented production hashes.

## Deferred inputs and next phase

Official company particulars, provider activation inputs, official social URLs and final supplied-image approval remain deferred until after Phase 11. The legal page must be reviewed and completed when verified company documents arrive.

Phase 10 owns route splitting, metadata, canonical/social/schema output, reduced-motion and the remaining performance budgets.
