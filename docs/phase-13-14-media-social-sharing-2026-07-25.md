# Phases 13–14 — Supplied media, canonical logo and sharing

Date: 2026-07-25
Status: implementation and local acceptance complete; production verification pending deployment

## Canonical sources and publication approval

The site owner instructed publication of the 12 supplied Design/Impression realization images and use of `docs/images_logos/Logo/vert_gold_blanc.svg` as the canonical brand source on 2026-07-25. The raw masters were moved to owner-only protected storage under `private-media/supplied-masters`; they are ignored by Git and are not inside the public document root.

The protected manifest is `private-media/phase13-services/manifest.json` (mode 0600). It records each source filename, SHA-256, category, French title and alternative text, approval basis, and generated derivative dimensions/paths. The repeatable generator is `backend/scripts/prepare-phase13-media.mjs`.

## Public derivatives

- Design: 9 approved images in Retouche photo, Flyers et affiches, Identité visuelle, and Objets personnalisés.
- Impression: 3 approved images in Albums and Cadres et tirages.
- Each realization has 480px and 1024px WebP variants, an explicit 1024×1024 layout box, `srcset`, `sizes`, lazy loading, and async decoding.
- The canonical SVG produced 160px and 320px WebP logos, PNG favicon/app icons, and the web manifest. The raw SVG is not published.
- The new social preview is a versioned 1200×630 JPEG at `/images/og-golden-studio-plus-2026.jpg` (82,463 bytes).

## Sharing and footer actions

The raw HTML prerender and browser-managed route metadata now publish complete Open Graph and Twitter large-card fields: absolute HTTPS image URL, secure URL, JPEG type, 1200×630 dimensions, and accessible image text. This is the shared-link contract used by WhatsApp, Facebook, X/Twitter, and LinkedIn crawlers.

Official configured social links:

- Instagram: `https://www.instagram.com/goldenstudioplus/`
- Facebook: `https://www.facebook.com/people/Golden-Studio-Plus/61574353412752/`
- LinkedIn: hidden because no official company profile was supplied.

Contact actions, social accounts, and business shortcuts are separate. The share action uses the Web Share API and falls back to copying the canonical route URL with a visible live-region confirmation. No footer link uses `href="#"`; external targets use HTTPS, accessible labels, and `noopener noreferrer`.

## Local acceptance evidence

- Frontend Node tests: 36 passed, 0 failed.
- ESLint: passed.
- Vite production build and 14-route prerender: passed.
- Performance budgets: passed; entry 377,250 bytes (120,134 gzip), total CSS 71,932 bytes.
- Chromium Phase 7 acceptance: 8 passed.
- WebKit Phase 7 acceptance: 8 passed after the lazy-image check was corrected to scroll each intended lazy resource into view; no application defect was found.
- Axe checks, keyboard behavior, official social destinations, canonical share fallback, all 12 gallery entries, responsive sources, image decode, and contracted viewport widths passed.

Production crawler/header and visual verification must be run against the exact deployed release before final sign-off.
