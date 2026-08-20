# Golden Studio Plus — Phase 3 production release manifest

Date: 20 August 2026 (UTC)

Runtime revision: `37d8164`

Branch: `codex/phase3-catalogue-20260820`

Disposition: **deployed; Phase 3 technical and OWNER editorial gates passed**

## Released scope

- Eight ordered, stable public catalogue section keys with independent FR/EN labels; package versions now reference one authoritative primary section instead of frontend text matching.
- Per-package-version FR/EN records own public name, description, content, inclusions, conditions, delivery wording, mandatory wording, options, source attribution, enabled state, and approval evidence.
- Student and referral offers moved from frontend arrays into auditable, versioned catalogue-benefit identities with draft, validation, publication, actor, effective-date, locale, ordering, and taxonomy contracts.
- The public `/api/catalogue` projection returns the same published package versions, taxonomy, and benefit versions consumed by Services cards. Existing `/api/packages` remains compatible with reservation and homepage consumers.
- Owner-only audited admin APIs manage taxonomy labels/order/state and benefit draft → validate → publish lifecycles. The package editor selects stable taxonomy keys and edits complete FR/EN locale records.
- Public CTA behavior is derived only from booking configuration: `DIRECT` plus a duration routes to booking; `CONTACT` routes to contact. The former `identite-standard` exception and every frontend slug-specific commercial translation/enrichment were removed.
- Official draft preparation remains draft-only and now writes taxonomy plus FR/EN locale records; verification checks those records. The 35+2 preview remains an OWNER decision gate and performs no package publication.

## Immutable data and rollback evidence

- Pre-migration encrypted PostgreSQL backup: `.phase3-backups/20260820T190931Z-pre-phase3-release/database.dump.enc`.
- SHA-256: `eaf34e9e38b49e91ea99ab512c80e9d113736f9d56ef4c98476698bd9a4f5f22`.
- Protection: AES-256-CBC, PBKDF2 200,000 iterations, mode `0600`; decrypted size 253,719 bytes and 300 restore-catalogue entries. Verification used a restricted temporary plaintext file that was immediately deleted.
- Additive migration `20260820170000_phase_3_catalogue_taxonomy` applied successfully; production is 35/35 with no pending migration.
- Application rollback point: `ee52133` (Phase 2 runtime). Retain the additive taxonomy/locale/benefit tables and migrated catalogue evidence during an application rollback.
- Reconciliation found all 35 production versions equal to the 4 August source before mutation. It attached taxonomy/locale evidence to those existing versions and migrated the two benefits already shown publicly; it created 0 package drafts, validated 0 package versions, and published 0 package versions.

## Automated evidence

- Backend after publication hardening: 24 files, 182/182 tests; TypeScript build and Prisma schema validation passed.
- Migration rehearsal: isolated database applied all 35 migrations successfully; strict publication tests reject missing/unknown taxonomy and incomplete enabled locales.
- Frontend: 99/99 tests; ESLint, client-only assertion, Vite build, 11 public/3 private prerenders, performance budgets, and tracker audit passed.
- Phase 3 contracts cover exact eight-section FR/EN membership, two benefits, canonical API locale selection, CONTACT-only Identité Standard CTA, Classic Propre OWNER fields, and absence of frontend slug-derived commercial copy.

## Production evidence

- Read-only pre-apply reconciliation: 35/35 found, zero commercial mismatches, eight taxonomy keys, 35 pending locale migrations, two pending benefit migrations.
- Post-apply reconciliation: 35/35 found, zero commercial mismatches, zero taxonomy mismatches, zero locale mismatches, and 2/2 benefits present.
- OWNER approval was recorded at `2026-08-20T19:37:33.818Z` for all 70 package-version FR/EN locale records and all 4 benefit FR/EN locale records. The transaction changed approval metadata only and published 0 versions.
- Approval workflow revision `65c6308` first required exact 35/35 package, taxonomy, locale, and 2/2 benefit reconciliation; it also made migration re-runs preserve existing approval timestamps.
- Initial Phase 3 backend deployment used revision `b2944ea`; the hardened runtime revision `37d8164` restarted at 19:51:54 UTC with Node PID `419092`.
- `https://gsplus.vip/api/health` returned `status: ok`.
- Live aggregate catalogue returned 35 packages, 8 taxonomy sections, and 2 benefits. Identité Standard returned `CONTACT`, null duration, and the versioned English name “Standard ID”; Classic Propre returned 18,000 FCFA and “Livraison sous 48 à 72 heures”.
- Nginx serves `assets/index-DRyxIe36.js`, SHA-256 `3507a7575a5549c87191726cd0e3c022897aabacbfa76cbb2d267458aa071503`.
- Focused live catalogue browser acceptance passed 1/1 Chromium and 1/1 WebKit: 35 public offers, exactly 31 direct reservation choices, CONTACT CTA for Identité Standard, both benefits visible.
- Post-approval reconciliation reports 0 pending package locales, 0 pending benefit locales, and `ownerSignOff: APPROVED`; an immediate repeat returned `ALREADY_APPROVED`.
- Audit event `cmt1x9wuo0000truugf0z30nh` is the sole `CatalogueRelease/PHASE3_OWNER_APPROVAL_2026-08-20` approval record, attributed to the active OWNER and recording source hash, scope, timestamp, and `publicationsPerformed: 0`.
- The live `/api/catalogue` response exposes the common approval timestamp on package and benefit locales while retaining 35 packages, 8 taxonomy sections, and 2 benefits.
- Runtime hardening independently rejects benefit publication if either enabled locale lacks `approvedAt`; exact package-to-section membership and all FR/EN section labels are pinned in automated and live Chromium/WebKit acceptance.

## Phase 3 exit gate

| Requirement | Verdict |
|---|---|
| Exactly eight stable public sections | **Met** — database taxonomy and live API return 8/8 ordered FR/EN sections |
| All 35 tariffs attributable to the approved source | **Met** — exact source reconciliation has zero core/taxonomy/locale mismatch |
| Two benefits are versioned and auditable | **Met** — version 1 records, actors/effective dates, and all 4 OWNER-approved locale records exist |
| No frontend slug-specific commercial copy or CTA | **Met** — source and automated tests prove removal; production browser proves CONTACT identity CTA |
| API, preview, and card use one version/localization | **Met** — published version locale records are projected and selected without frontend derivation |
| Publication rejects unknown taxonomy/incomplete locale | **Met** — service validation plus integration/unit evidence; publishing also requires locale approval timestamps |
| Owner editorial sign-off | **Met** — explicit OWNER approval is recorded on all 74 locale records and in one attributable audit event |
