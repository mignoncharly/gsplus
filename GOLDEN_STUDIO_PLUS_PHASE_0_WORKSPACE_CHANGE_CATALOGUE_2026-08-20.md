# Golden Studio Plus — Phase 0 workspace change catalogue

Recorded against `HEAD` `7059faf1b4a42764f00d7fbc2584186d7c746bb8` on 20 August 2026. This catalogue preserves the pre-existing dirty worktree boundary; it does not approve or stage any item.

## Release policy

- `CANDIDATE-REVIEW`: plausibly belongs to the post-report application patch, but must be reviewed and split into coherent commits before release.
- `EVIDENCE-ONLY`: useful release/source evidence; do not ship in the runtime artifact.
- `EXCLUDE-DEFAULT`: unrelated, destructive, generated, secret, binary, or superseded material; include only after explicit owner review.
- Existing index/staging state is not a release decision. In particular, staged deletions remain excluded by default.

## Tracked application and test changes — `CANDIDATE-REVIEW`

### Backend

```text
backend/.env.example
backend/package.json
backend/prisma/schema.prisma
backend/src/catalogue/golden-studio-plus-2026-08-04.ts
backend/src/config/env.ts
backend/src/emails/delivery-notifications.ts
backend/src/emails/email-delivery-reports.ts
backend/src/emails/notifications.ts
backend/src/emails/templates.ts
backend/src/routes/admin.ts
backend/src/routes/public.ts
backend/src/server.ts
backend/src/services/admin-auth.ts
backend/src/services/admin-permissions.ts
backend/src/services/leads.ts
backend/src/services/packages.ts
backend/src/services/reservations.ts
backend/src/services/status-transitions.ts
backend/src/services/zoho-mail-smtp-logs.ts
backend/src/validation/schemas.ts
backend/test/catalogue-official.test.ts
backend/test/email-templates.test.ts
backend/test/integration/api.test.ts
backend/test/integration/delivery-notifications.test.ts
```

### Frontend application

```text
frontend/scripts/audit-trackers.mjs
frontend/src/App.jsx
frontend/src/components/ActionAvailabilityHint.jsx
frontend/src/components/Footer.css
frontend/src/components/Footer.jsx
frontend/src/components/Header.jsx
frontend/src/components/LegalPageLayout.jsx
frontend/src/components/ReservationConsentFields.jsx
frontend/src/components/RouteMetadata.jsx
frontend/src/components/ServiceGallery.jsx
frontend/src/content/catalogue-promotions.js
frontend/src/content/legal.js
frontend/src/content/service-media.js
frontend/src/content/site-metadata.js
frontend/src/content/tracker-inventory.js
frontend/src/index.css
frontend/src/lib/api.js
frontend/src/lib/contact-validation.js
frontend/src/lib/disabled-actions.js
frontend/src/lib/form-errors.js
frontend/src/lib/packages.js
frontend/src/main.jsx
frontend/src/pages/About.jsx
frontend/src/pages/AdminDashboard.jsx
frontend/src/pages/Contact.jsx
frontend/src/pages/Corporate.jsx
frontend/src/pages/CreativeServices.jsx
frontend/src/pages/Home.jsx
frontend/src/pages/Home.css
frontend/src/pages/Legal.jsx
frontend/src/pages/NotFound.jsx
frontend/src/pages/Portfolio.jsx
frontend/src/pages/Privacy.jsx
frontend/src/pages/Reservation.jsx
frontend/src/pages/Services.jsx
frontend/src/pages/Terms.jsx
```

### Frontend tests

```text
frontend/e2e/leg-01.spec.js
frontend/e2e/leg-02.spec.js
frontend/e2e/leg-03.spec.js
frontend/e2e/leg-04.spec.js
frontend/e2e/leg-06.spec.js
frontend/e2e/p1-02.spec.js
frontend/e2e/p1-04.spec.js
frontend/e2e/p2-06.spec.js
frontend/e2e/phase-7.spec.js
frontend/e2e/phase-10.spec.js
frontend/e2e/phase-9-production.spec.js
frontend/e2e/phase-9.spec.js
frontend/e2e/post-03-production.spec.js
frontend/e2e/val-01.spec.js
frontend/test/catalogue-official.test.js
frontend/test/leg-01-mentions-legales.test.js
frontend/test/leg-02-confidentialite.test.js
frontend/test/leg-03-cgv.test.js
frontend/test/leg-04-consent.test.js
frontend/test/leg-06-trackers.test.js
frontend/test/legal-editorial.test.js
```

### Changes made during Phase 0 remediation

```text
frontend/src/index.css
frontend/src/pages/Home.css
frontend/src/components/Header.jsx
frontend/e2e/leg-04.spec.js
frontend/e2e/leg-06.spec.js
frontend/e2e/p1-02.spec.js
frontend/e2e/phase-7.spec.js
frontend/e2e/phase-9.spec.js
frontend/e2e/phase-10.spec.js
frontend/e2e/val-01.spec.js
```

These edits add an accessible light-surface gold token, correct mobile-menu focus order, and align stale browser assertions with the current source-driven legal/locale contract. They are independently evidenced by the targeted two-engine rerun and the post-remediation full campaign recorded in the release manifest.

## Untracked application changes — `CANDIDATE-REVIEW`

```text
backend/prisma/migrations/20260811110000_post_04_qa_notification_override/migration.sql
backend/prisma/migrations/20260812123000_add_contact_locale/migration.sql
backend/prisma/migrations/20260814170000_add_whatsapp_marketing_consent/migration.sql
backend/scripts/publish-owner-legal-documents.ts
backend/src/catalogue/delivery-labels.ts
backend/src/legal/owner-legal-documents.ts
backend/src/services/reservation-notification-overrides.ts
backend/src/services/zoho-mail-smtp-logs-sync.ts
backend/test/integration/qa-notification-overrides.test.ts
backend/test/owner-legal-documents.test.ts
backend/test/zoho-mail-smtp-logs-sync.test.ts
frontend/e2e/translation-audit.spec.js
frontend/src/components/LanguageSwitcher.css
frontend/src/components/LanguageSwitcher.jsx
frontend/src/components/LocaleProvider.jsx
frontend/src/components/OwnerLegalDocument.jsx
frontend/src/content/owner-legal-documents.js
frontend/src/lib/i18n.js
frontend/test/admin-password-management.test.js
```

The three migrations are part of the intended release set. The configured target has the first applied and the final two pending. They must stay coupled to the schema and service changes that use them.

## Release records and source evidence — `EVIDENCE-ONLY`

Tracked modifications:

```text
.gitignore
GOLDEN_STUDIO_PLUS_CHANGELOG.md
GOLDEN_STUDIO_PLUS_POST_05_ZOHO_PROOF_RUNBOOK.md
GOLDEN_STUDIO_PLUS_TEST_REPORT.md
GOLDEN_STUDIO_PLUS_TRACEABILITY_MATRIX.md
```

Untracked records/source inputs:

```text
GOLDEN_STUDIO_PLUS_IMPLEMENTATION_PLAN_2026-08-19.md
GOLDEN_STUDIO_PLUS_PHASE_0_ACCEPTANCE_LEDGER_2026-08-20.md
GOLDEN_STUDIO_PLUS_PHASE_0_RELEASE_MANIFEST_2026-08-20.md
GOLDEN_STUDIO_PLUS_PHASE_0_WORKSPACE_CHANGE_CATALOGUE_2026-08-20.md
GOLDEN_STUDIO_PLUS_POST_04_QA_PACKAGE_DEVIATION_2026-08-11.md
GOLDEN_STUDIO_PLUS_POST_05_I09_QA_DEVIATION_2026-08-11.md
docs/Rapport_tests_nouvelle_version_Golden_Studio_Plus_2026-08-16.pdf
docs/new docs/cgv.en.txt
docs/new docs/cgv.txt
docs/new docs/mentions legales.en.txt
docs/new docs/mentions legales.txt
docs/new docs/politique de confidentialite.en.txt
docs/new docs/politique de confidentialite.txt
```

These records may be committed separately from runtime code. Owner-supplied legal text must retain provenance and approval; it must not be silently treated as developer-authored copy.

## Existing deletions — `EXCLUDE-DEFAULT`

Staged deletions observed:

```text
GOLDEN_STUDIO_PLUS_CATALOGUE_MIGRATION_PREVIEW.md
GOLDEN_STUDIO_PLUS_OWNER_PACKAGE_CONTENT_INVENTORY.md
GOLDEN_STUDIO_PLUS_POST_06_FINAL_REVALIDATION.md
ISSUE_UPDATE_LOG.md
docs/Rapport_unifie_audit_Golden_Studio_Plus_2026-07-29.docx
docs/Textes_juridiques_Golden_Studio_Plus_2026-07-31.docx
docs/new_prompt.md
frontend/README_RELAIS.md
```

Unstaged deletions observed:

```text
GOLDEN_STUDIO_PLUS_IMPLEMENTATION_PLAN.md
docs/Bibliotheque_emails_Golden_Studio_Plus_2026-07-30_v2.docx
```

These ten deletions are not authorised by Phase 0 and must not enter the release commit by accident. Some may be intentional supersession, but that decision belongs in a separate documentation commit with recovery/provenance reviewed.

## Other owner/binary input — `EXCLUDE-DEFAULT`

```text
docs/conditions.jpeg
```

The image is not a runtime dependency identified by the plan. Keep it outside the release until its purpose, rights, and destination are explicit.

## Always excluded from a release commit

```text
backend/.env
frontend/.env
.phase0-backups/
backend/dist/
frontend/dist/
frontend/test-results/
node_modules/
```

These paths contain secrets, backups, generated output, or ephemeral diagnostics. The release must be built from the reviewed candidate revision, not from committed generated artifacts.

## Recommended split before deployment

1. Owner legal sources and source-driven legal renderer/tests.
2. Locale persistence, language UI, route/public API changes, and `20260812123000_add_contact_locale`.
3. WhatsApp consent separation and `20260814170000_add_whatsapp_marketing_consent`.
4. QA notification override migration/service/admin/test changes.
5. Zoho SMTP log synchronisation and runbook/evidence changes.
6. Catalogue/delivery-label reconciliation.
7. Documentation-only evidence updates.
8. Any approved deletion cleanup as a separate final commit.

Each split must pass its relevant tests and preserve migration order. This is a review map, not permission to commit or deploy.
