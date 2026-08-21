# Golden Studio Plus — Phase 5 release manifest

**Release date:** 21 August 2026
**Branch:** `codex/phase5-accessibility-20260821`
**Implementation revision:** `c9a8c3c`
**Production host:** `https://gsplus.vip`

## Released scope

- Unconditional global route-heading and eyebrow styles, eliminating lazy `Home.css` ordering differences between direct and client-side navigation.
- Documented semantic foreground tokens for dark surfaces, with maintained WCAG contrast ratios and replacement of informative low-alpha text colours across public and administration views.
- Administration and data-governance heading, summary, label, help-text, and control scopes for the dark interface.
- Meaningful section-level headings before card collections on Services, Portfolio, Corporate, Contact, and Creative Services.
- Explicit 44 × 44 CSS-pixel floors for compact navigation, language, filter, administration, disclosure, and shared button controls.
- WhatsApp FAB collision avoidance through 320, 390, 768, 992, and 1280 CSS-pixel widths, including keyboard, modal, drawer, and final-form-action states.
- Production axe coverage for every public route and mocked authenticated administration/governance views, failing on serious or critical WCAG violations.

## Production safety and deployment evidence

- Frontend-only release: no backend, schema, migration, or production-data mutation was required.
- Nginx serves `/var/www/goldenstudioplus/frontend/dist`; the verified production build was deployed directly to that release directory.
- Live health endpoint returned `{"status":"ok","service":"golden-studio-plus-api"}` after deployment.
- Live frontend entry `assets/index-CrbqPJhk.js` matched local SHA-256 `f6d13fc38e024ea1d3e791f471e25b2d1916fc2102d4f501fec9f0aa4cdf0885`.
- Live global stylesheet `assets/index-CwaozmlY.css` matched local SHA-256 `50305811674cad5ef5cc779ed6a69f7b4b3653e50f950e70ecbdb95c650e3a6a`.
- Rollback is the prior Phase 4 revision `296fccf` followed by the same deterministic frontend build; no database rollback is involved.

## Verification evidence

- Frontend test suite: 104 tests passed.
- Phase 5 browser suite: 8 tests passed across Chromium and WebKit.
- WhatsApp responsive/collision suite: 6 tests passed across Chromium and WebKit.
- Production accessibility suite: 3 tests passed, covering Phase 5 public/authenticated views, existing public routes/forms, and all reservation steps.
- Production build, lint, client-only assertion, tracker audit, and diff whitespace checks passed.
- Performance budgets passed: entry 267,486 bytes (85,819 bytes gzip), largest public route 38,934 bytes, administration chunk 56,950/57,000 bytes, and CSS 84,355/85,000 bytes.
- Tracker audit passed with 3 inventory entries, 2 external origins, 0 optional trackers, and 0 browser-storage APIs.

## Exit gate

| Requirement | Production evidence | Result |
| --- | --- | --- |
| Direct and client-side navigation produce identical readable styles | Dedicated Chromium/WebKit computed-style comparison with shared global heading rules | Passed |
| Normal and large text satisfy maintained contrast requirements | Documented semantic tokens plus local and production axe scans, including governance | Passed |
| Heading order contains no unexplained level jump | Route matrix over Services, Portfolio, Corporate, Contact, and Creative Services | Passed |
| Interactive targets meet 44 px and the WhatsApp FAB overlaps none | Control-size scan plus five-width keyboard/dialog/final-action matrix | Passed |

Phase 5 is closed in production. Phase 6 may proceed from revision `c9a8c3c` plus this release-record commit.
