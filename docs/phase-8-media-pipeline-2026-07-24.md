# Phase 8 — Curated media pipeline and responsive portfolio

Date: 2026-07-24  
Canonical origin: https://gsplus.vip  
Status: complete; deployed and verified in production

## Acceptance contract completed

- M-02 is complete: database media augment the six-image local portfolio instead of replacing it; public categories are restricted to Portrait, Couple, Maternité, Corporate, Famille and Événementiel; technical `hero` and `QA_TEST` records cannot appear publicly.
- The Phase 8 portion of M-03 is complete: uploaded masters are private, public uploads are generated WebP derivatives with recorded dimensions and byte sizes, public UI images use responsive `srcset`, dimensions and lazy loading, and deterministic critical/gallery byte budgets pass. Phase 10 still owns route splitting and broader application performance budgets.
- M-08 is complete end to end: a valid upload creates one media item and its derivative set; the admin form uses success-only reset behavior; invalid bytes fail before a record is created; deletion removes the master and both derivatives; no reset exception can replace a successful result.
- The broken maternity/media regression is complete in local Chromium/WebKit acceptance and canonical production smoke checks.

## Backend and database

Migration `20260724170000_phase_8_media_derivatives` is additive. It adds nullable MIME, primary-byte-size and thumbnail dimension/byte-size columns to `MediaItem`. It also unpublishes the two legacy technical records without deleting their rows or files.

Post-migration production state:

```text
TEST QA CODEX — Portfolio Douala | QA_TEST | unpublished
Golden Studio Plus Hero          | hero    | unpublished
```

The public media endpoint now filters against one shared editorial category allowlist and explicitly selects public fields. It does not return `storagePath`, even for a valid published item.

The admin upload path now:

- accepts JPEG, PNG and WebP only, with one file and an 8 MiB request limit;
- validates decoded content with Sharp, a 40-megapixel limit and animated/multipage rejection;
- writes the unchanged master to `private-media/portfolio` with mode 0600 under a mode-0700 directory;
- publishes only WebP derivatives at up to 640 px and 1600 px, without enlargement;
- records MIME type, dimensions and byte sizes in PostgreSQL;
- cleans all generated files if database creation fails;
- removes the private master and both public derivatives when an item is deleted.

Upload dependencies were updated to fixed runtime releases, including Multer 2.2.0, Nodemailer 9.0.3, body-parser 2.3.0 and fast-uri 3.1.4. Prisma CLI remains aligned to the 7.8 runtime client.

## Portfolio and admin frontend

- API media are normalized, defensively filtered and placed before the local editorial set.
- Duplicate URLs are suppressed while database media augment rather than erase local coverage.
- Filter order is fixed to the editorial vocabulary; arbitrary database strings cannot become public filter labels.
- Gallery thumbnails use 480/1024 or 640/primary width-descriptor source sets, explicit dimensions, responsive `sizes`, async decoding and lazy loading.
- The hero uses high-priority responsive WebP; service, portfolio, about and footer imagery uses responsive WebP and lazy loading where appropriate.
- The admin upload form requires meaningful title, alternative text, curated category and a valid supported file. It exposes display order, publication and featured controls with associated labels.
- Admin media cards show dimensions and derivative sizes and load their previews lazily.

## Deterministic media preparation

`npm run media:optimize-static` generated 20 public WebP derivatives for ten current public sources and recorded them in `frontend/public/images/optimized/manifest.json`.

Enforced budgets include:

- 640 px hero: 24,948 bytes, budget 30,000;
- 320 px logo: 13,826 bytes, budget 15,000;
- six 480 px portfolio thumbnails: 88,656 bytes total, budget 100,000, with every item below 25,000 bytes.

`npm run media:stage-supplied` prepared the 17 supplied portfolio images as 34 private WebP derivatives under `private-media/phase8-curated`. Every file and the manifest are mode 0600, directories are mode 0700, and both the set and each item are explicitly marked `publicationApproved: false`.

The source masters under `docs/images_logos/Image Page Portfolio` remain unchanged. No ownership or publication approval was invented. Final supplied-image approval remains deferred until after Phase 11.

## Automated verification

- Prisma format and typed-client generation: pass.
- Additive migration rehearsal against the isolated test database: pass.
- Backend TypeScript production build: pass.
- Backend Vitest suites: 43/43 tests passed across two files.
- Media integration coverage proves public filtering/private-field exclusion, one-record upload, exact WebP type/dimensions, private-master permissions, public inclusion, audit logging, complete deletion and corrupt-byte rejection.
- Frontend ESLint: pass with zero warnings.
- Frontend Node suites: 15/15 tests passed.
- Static-media tests verify every manifest entry against a real RIFF/WebP file, exact byte size, positive dimensions and the Phase 8 budgets.
- Isolated Vite production build under `/tmp/gsp-phase8-build.kElgEN`: pass.
- Local Chromium/WebKit acceptance: 18/18 tests passed, preserving all Phase 7 accessibility, focus, scroll and responsive checks while adding portfolio/media coverage.
- Read-only canonical Chromium/WebKit production smoke: 6/6 tests passed without creating production data.

The frontend dependency audit currently reports one React Router RSC/server-action CSRF advisory as two high transitive findings. The deployed application is a client-only Vite SPA and does not use React Server Components, server actions or the affected server runtime. React Router is pinned to 7.18.1 because the audit service reports many broader redirect/XSS/RCE advisories against the recommended 7.11 downgrade. This exception is documented rather than masking or introducing the older affected release.

The backend audit reports four moderate findings only through Prisma CLI development-server dependencies (`@hono/node-server` and Valibot); those components are not imported by the production API process. The application-facing upload/runtime advisories are remediated.

Vite still reports the primary 527 kB minified bundle advisory. Route splitting and the broader performance budget remain Phase 10 obligations.

## Production rollout and smoke evidence

- Protected database, frontend and upload rollback assets were created and verified before the production migration.
- The production migration applied successfully; nine migrations are recorded and none is pending.
- The exact isolated frontend artifact was published with deletion semantics.
- Backend restart completed at 2026-07-24 17:54:17 UTC and the service remained active.
- Loopback and canonical `/api/health` returned HTTP 200.
- Loopback and canonical `/api/media` returned `{"data":[]}`; no technical item or private path was exposed.
- Canonical hero and maternity derivatives returned HTTP 200 with `Content-Type: image/webp` and the expected byte sizes.
- Canonical `/`, `/portfolio` and `/a-propos` served the Phase 8 release and passed the read-only production browser checks in Chromium and WebKit.

Published artifact hashes:

```text
c3746a374187ef0ddb1e78ca1d9323473a67285dab9f18cdadc4d7f807f8b3a7  index.html
8a462026d396e08db8339b878443820f61aa948cf28c83ab806fd13b83069dcc  assets/index-BAy2CFKT.css
9ffb28bce58e31e359b0870a2d7f239c6a0b67626fe7f2e140c10170be263717  assets/index-MJKaEWPU.js
```

The published hashes exactly match `/tmp/gsp-phase8-build.kElgEN/dist`.

## Recovery assets

Protected directory:

```text
/var/www/goldenstudioplus/.phase0-backups/20260722-204951/
```

```text
a71e0fde93bfe42b7a1e7a37cbcd6f2123970abcc303fabca9f674fbdb365624  database-pre-phase8.dump
cc524cb93c541e0474e15c1eb3ae226def5c93c140b6f2a84472887e4df388f6  frontend-dist-pre-phase8.tar.gz
9f1e3b65fdc2e317b4915a6c2a6016c68f06ca91120a3201537ffe3fcc6d297c  uploads-pre-phase8.tar.gz
```

All three artifacts and `SHA256SUMS` are mode 0600. The database archive is readable by `pg_restore`, both tar archives are readable, and the complete checksum manifest verifies successfully. The frontend archive is an exact copy of the already-verified Phase 7 release archive, which is the pre-Phase 8 rollback state.

## Deferred scope

- Phase 9 owns approved editorial/legal copy and legal-policy alignment, subject to the documented rule not to invent missing company particulars.
- Phase 10 owns route splitting, metadata/schema work, reduced-motion/performance safeguards and broader page-weight budgets.
- SMTP/WhatsApp production credentials and templates, official social URLs, complete company particulars and final supplied-image approval remain deferred until after Phase 11.
- The installed kernel update can be loaded only during a separately authorized maintenance reboot; no reboot was required for Phase 8.
