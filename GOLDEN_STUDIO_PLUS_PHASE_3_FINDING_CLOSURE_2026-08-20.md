# Golden Studio Plus — Phase 3 finding closure

Date: 20 August 2026 (UTC)

Status: **closed in production**

Findings: `TAR-01`, `TAR-02`

## Release identity

- Branch: `codex/phase3-catalogue-20260820`.
- Catalogue implementation: `5fc002c`.
- Explicit locale-approval gate: `b2944ea`.
- Production deployment record: `c5e97cc`.
- Auditable OWNER approval workflow and evidence: `65c6308`, `18944c2`.
- Final publication hardening deployed from: `37d8164`.
- Production service restart: 20 August 2026 at 19:51:54 UTC; Node PID `419092`.
- Database migration: `20260820170000_phase_3_catalogue_taxonomy`; production has all 35 migrations applied.

## Finding traceability

| Finding | Authoritative implementation | Automated evidence | Production evidence | Verdict |
|---|---|---|---|---|
| `TAR-01` | `CatalogueTaxonomy` and localized labels; `PackageVersion.taxonomyKey`; versioned benefit identities/locales; admin taxonomy and benefit workflows; public `/api/catalogue` projection | Backend exact membership pins all 35 slugs to one of eight keys; FR/EN labels and two benefit contracts are asserted; frontend consumes API taxonomy without heuristic category matching | Live API: 35 packages, exactly 8 ordered localized sections, 2 benefits; Chromium and WebKit exact-membership replay passed | **Closed** |
| `TAR-02` | `PackageVersionLocale` owns FR/EN commercial content; frontend slug-specific English/enrichment maps removed; CTA derives only from `DIRECT` plus duration versus `CONTACT`; package and benefit publication require approved enabled locales | Backend publication rejects unknown taxonomy, incomplete locales, and missing approval timestamps; frontend asserts no slug-derived copy/CTA exceptions; production test pins 31 direct choices | Live API and cards share published localized records; Identité Standard routes to contact and cannot enter reservation; 31 direct and 4 contact offers proven in Chromium/WebKit | **Closed** |

## OWNER approval evidence

- Approval timestamp: `2026-08-20T19:37:33.818Z`.
- Scope: 70 package-version locale records and 4 benefit-version locale records.
- Audit event: `cmt1x9wuo0000truugf0z30nh`.
- Audit action/entity: `catalogue.phase3.owner_approve` / `CatalogueRelease:PHASE3_OWNER_APPROVAL_2026-08-20`.
- Source SHA-256: `002bd52c30c7e3fcef8aebc71f82111780320ba8c9500c4e55d746164cd54696`.
- Publication effect: 0 drafts, 0 validations, 0 publications.
- Idempotency: immediate repeat returned `ALREADY_APPROVED`; exactly one approval audit event exists.

## Verification

- Backend: 24 files, 182/182 tests; TypeScript build passed.
- Frontend: 99/99 tests.
- Production acceptance after hardened deployment: Chromium 1/1 and WebKit 1/1.
- Acceptance asserts 35 packages, 8 exact FR/EN taxonomy labels and memberships, 2 benefits, 74 approved locales, 31 direct reservation choices, and CONTACT behaviour for Identité Standard and the three subscriptions.
- Production health: `https://gsplus.vip/api/health` returned `status: ok`.

## Rollback

- Hardened-runtime rollback: revision `18944c2`; retain the additive Phase 3 tables and OWNER approval audit evidence.
- Full Phase 3 application rollback: revision `ee52133`; retain migrated/versioned records for audit and recovery.
- Encrypted pre-migration backup: `.phase3-backups/20260820T190931Z-pre-phase3-release/database.dump.enc`, SHA-256 `eaf34e9e38b49e91ea99ab512c80e9d113736f9d56ef4c98476698bd9a4f5f22`.
