# Golden Studio Plus — Phase 6 release manifest

**Release date:** 21 August 2026
**Branch:** `codex/phase6-multilingual-dates-20260821`
**Production host:** `https://gsplus.vip`
**Status:** complete; application and root-owned Nginx CSP deployed

## Released scope

- Stable `/fr/...` and `/en/...` public URLs for all 11 public routes, with route-derived locale and unprefixed `noindex, follow` compatibility documents.
- Per-locale canonical URLs, reciprocal French/English/x-default alternates, localized metadata, localized LocalBusiness `inLanguage`, navigation, legal links, static shells, and 22-entry sitemap.
- Source-driven English legal authority notice on the legal notice, privacy policy, and terms pages, with no public `OWNER` token.
- Controlled accessible day/month/year fields for booking and birth dates, localized month labels, ISO values, min/max constraints, and 320 px mobile containment.
- Shared locale-aware Africa/Douala date/time helpers across frontend display, administration, email, and delivery-notification code.
- Compatibility and regression tests updated for locale-aware links and current `bookingMode: DIRECT` catalogue contracts.

## Deployment evidence

- Nginx serves the verified frontend directly from `/var/www/goldenstudioplus/frontend/dist`.
- Live frontend entry `assets/index-BYHqqiAp.js` matches local SHA-256 `c4c74e2459945279d1bed77ab9f6f68b78dce336fc92b488148601f5f755af30`.
- Live global stylesheet `assets/index-CwaozmlY.css` matches local SHA-256 `50305811674cad5ef5cc779ed6a69f7b4b3653e50f950e70ecbdb95c650e3a6a`.
- Backend was rebuilt and gracefully recycled through its `Restart=always` systemd policy; PID changed from `1324739` to `1582611` and local health returned `{"status":"ok","service":"golden-studio-plus-api"}`.
- Production returns 22 localized sitemap entries and all six localized raw-HTML SEO checks pass in Chromium and WebKit.
- No database schema, migration, or production-data mutation was required.
- Privileged Nginx activation completed after removing the accidentally duplicated enabled filename; syntax validation and reload passed, and the live CSP exposes both localized JSON-LD hashes.

## Verification evidence

- Frontend unit/source suite: 108 passed.
- Backend integration/unit suite: 187 passed across 26 files.
- Phase 6 browser suite: 6 passed across Chromium and WebKit, including the English segmented-date submission of `2027-08-04T09:00:00.000Z` for 10:00 Africa/Douala.
- Full Chromium regression covered all 85 tests; five stale locale/catalogue fixtures found on the first run were corrected and their affected suites subsequently passed.
- Frontend lint, backend TypeScript build, client-only assertion, tracker audit, and diff whitespace checks passed.
- Performance budgets passed: entry 270,805 bytes (86,826 bytes gzip), largest public route 38,631 bytes, administration chunk 56,956 bytes, and CSS 84,995 bytes total.

## Exit gate

| Requirement | Evidence | Result |
| --- | --- | --- |
| No public legal page exposes editorial vocabulary | Shared approved authority notice plus unit and Chromium/WebKit page assertions | Passed |
| French and English have stable URLs, canonicals, alternates, prerendered HTML, and sitemap entries | 22 generated documents, reciprocal hreflang assertions, and live raw-HTML production checks | Passed |
| English booking displays English date labels and submits the correct Douala instant | Chromium/WebKit booking test with Month/Day/Year controls and captured API payload | Passed |
| CSP permits both localized JSON-LD documents | Root-owned site replaced; `nginx -t` and reload passed; live `/fr` header contains both generated hashes | Passed |

## Privileged activation completed

On 21 August 2026 the privileged operator replaced the active site file, removed the duplicate enabled filename that initially caused a duplicate-listen validation error, passed `nginx -t`, and reloaded Nginx successfully. A live `HEAD /fr` response now contains both localized JSON-LD hashes: `sha256-mXrHd274Pe4j55OVKQMd35ztM8fym1sMUg2jwdyIvm8=` and `sha256-79Qo2Zr09XreThhQcmDTXccVXgxUFVwAwZrxqavQz18=`. Phase 6 is complete.
