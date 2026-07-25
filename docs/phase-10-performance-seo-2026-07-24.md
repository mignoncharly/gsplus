# Phase 10 — Performance, crawlable metadata and structured data

Date: 2026-07-24  
Canonical origin: https://gsplus.vip  
Status: complete; deployed and verified in production

## Acceptance contract completed

- M-03 is complete: static and uploaded masters remain private; the release contains only public derivatives; responsive images retain explicit dimensions, `srcset`, lazy loading and critical-image priority; deterministic asset and bundle budgets run during every production build.
- M-04 is complete: all 11 indexable routes return unique titles and descriptions, an apex canonical URL, Open Graph and Twitter metadata, crawlable route content and valid `LocalBusiness` JSON-LD in the initial HTML response.
- Route splitting is complete: every page is a lazy route, including isolated reservation and admin chunks. The Phase 9 entry fell from 540,821 bytes to 373,517 bytes, a 30.9% reduction, and the admin chunk is not requested by public routes.
- Reduced-motion and performance safeguards are active without weakening the Phase 7 accessibility, focus, keyboard, scroll-restoration or responsive contracts.

## Route-specific crawlable output

One metadata registry now controls browser navigation and build-time HTML generation. The production build emits route documents for:

```text
/
/services
/portfolio
/reservation
/services-creatifs
/a-propos
/contact
/corporate
/mentions-legales
/confidentialite
/cgv
```

Each document contains a unique title, description and crawlable heading/summary, a canonical `https://gsplus.vip` URL, Open Graph metadata, a large-image Twitter card and the verified studio schema before JavaScript executes.

The schema publishes only existing public facts: Golden Studio Plus, `https://gsplus.vip`, `+237673026654`, `info@gsplus.vip`, Cité des Palmiers, Douala, Littoral, Cameroon and the published Monday–Saturday 09:00–18:00 hours. No social URL, rating, legal identity or missing company particular was invented.

`/admin`, `/admin/login` and `/admin/dashboard` receive crawlable `noindex, nofollow` documents without canonical, social or LocalBusiness tags. Unknown paths return a real HTTP 404 with the same safe noindex contract.

Nginx now resolves extensionless application routes against generated `.html` files and uses `404.html` for unknown routes. HTTPS and HTTP `www.gsplus.vip` requests redirect to the apex origin, aligning redirects, sitemap and canonical metadata.

## Route splitting and enforced budgets

`React.lazy` and `Suspense` split Home, Services, Portfolio, Reservation, Admin, Creative Services, About, Contact, Corporate and all legal/not-found pages. The generated release has 35 JavaScript chunks and 11 CSS chunks.

The production build runs `scripts/prerender.mjs` and `scripts/check-performance-budgets.mjs`. A release fails if any budget is exceeded.

| Measurement | Phase 10 result | Enforced maximum |
|---|---:|---:|
| Entry JavaScript | 373,517 B | 400,000 B |
| Entry JavaScript, gzip | 118,951 B | 125,000 B |
| Largest public route chunk | 34,600 B (`Reservation`) | 40,000 B |
| Private admin route chunk | 42,148 B | 50,000 B |
| Largest CSS chunk | 12,056 B | 15,000 B |
| Total split CSS | 70,348 B | 85,000 B |
| Hero 640 WebP | 24,948 B | 30,000 B |
| Hero 1024 WebP | 63,632 B | 70,000 B |
| Social preview JPEG | 90,202 B | 200,000 B |

The resulting report is published as `frontend/dist/performance-budget-report.json`.

## Media privacy and loading

The ten current static PNG masters were relocated from `frontend/public` to `private-media/static-masters`, with mode 0700 on the root and mode 0600 on files. The existing deterministic Sharp script now reads those private masters while keeping the verified WebP URLs unchanged.

The deployed release no longer contains the large PNG masters. Production requests for representative former master URLs return HTTP 404. Uploaded masters and the 17 supplied unapproved images retain their Phase 8 private behavior.

The home document alone preloads the responsive hero, and the hero retains `fetchpriority="high"`. Non-home documents do not preload it. Noncritical service, portfolio, about and footer imagery retains lazy loading, responsive sources and explicit dimensions. The approved hero also supplies a 1200×630, 90,202-byte JPEG social derivative.

## Fonts and reduced motion

The blocking Google Fonts CSS `@import` was removed. Font origins are preconnected in the document head and the stylesheet is linked directly.

`MotionConfig reducedMotion="user"` applies the operating-system preference across Motion components. The CSS reduced-motion contract disables smooth scrolling, collapses animation and transition duration, stops the loading spinner and removes costly backdrop blur from affected surfaces.

## Automated verification

- Frontend ESLint: pass with zero warnings.
- Frontend Node suites: 24/24 tests passed.
- Static tests prove metadata uniqueness, canonical construction, published-only LocalBusiness fields, raw generated HTML, private/noindex output, route splitting, reduced motion, font loading, social image typing/size, and owner-only static masters.
- Exact isolated production build: `/tmp/gsp-phase10-build.1VcXPb`; build, prerender and all budgets passed.
- Preserved local Phase 7–10 Chromium/WebKit acceptance: 30/30 passed.
- Canonical Phase 10 browser smoke: 6/6 passed across Chromium and WebKit.
- Canonical raw-response smoke: 4/4 passed across Chromium and WebKit, covering every indexable route, admin/noindex behavior, real 404 output, `www` redirect, social image and former-master privacy.
- Backend was not changed. The established backend baseline remains 43/43 tests, and both Nginx and `goldenstudioplus-backend` are active.

## Production rollout

The exact isolated release was published with deletion semantics. The previous public PNG masters disappeared from the live artifact as designed. Nginx syntax validation succeeded before reload.

Production checks confirm:

- `/api/health` returns HTTP 200 and `{"status":"ok","service":"golden-studio-plus-api"}`;
- all 11 indexable routes return distinct crawlable metadata and HTTP 200;
- admin returns HTTP 200 with raw `noindex, nofollow`;
- unknown routes return HTTP 404 with raw `noindex, nofollow`;
- `https://www.gsplus.vip/services` returns HTTP 301 to `https://gsplus.vip/services`;
- the social JPEG returns the correct media type and stays below budget;
- Nginx and the backend service are active.

Published artifact hashes:

```text
8586ed6ff12f750ebc4740ad9fe4cf602b69f71edbc1e966930bda275885f543  index.html
21d38d6251ca69ea00ecad1157d571fa2452ab27272fdd034c5e81ef95c4abdd  assets/index-Ccj_oUBX.js
a6a55310a90f45d33c13c7261a95e804b172edbb33a42a9415118f77f96677e9  assets/index-CJXeQvrZ.css
e6d41d8d0b4a4f2da7df702164debb22ddeb5d14df4dcee21e0ee4ddd40891dd  images/og-golden-studio-plus.jpg
2bff9ed4e0ae5a8d1d9b978967447b8535b32f38eb98671cc09b000f4c1979c8  performance-budget-report.json
e07c0b96527163ca4bdea1349d6bf35cd76b4292b58eba76a28accb9228bafe5  /etc/nginx/sites-enabled/goldenstudioplus
```

## Recovery assets

Protected recovery directory:

```text
/var/www/goldenstudioplus/.phase0-backups/20260722-204951/
```

```text
5586740483a8d4e0b66f9b81f394b45e22548e9666745f42f793197e9127120e  frontend-dist-pre-phase10.tar.gz
98a6cebbb5dd96692b3ebfbfcf2cd187bf1df9a4166fde227439dd40b290c29a  nginx-site-pre-phase10.conf
```

Both files are mode 0600, the frontend archive is readable, and the complete protected `SHA256SUMS` manifest verifies successfully. Phase 10 contains no database migration, so no database write or migration backup was required.

## Primary implementation references

- Google Search Central, JavaScript SEO and canonical guidance: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- Google Search Central, LocalBusiness structured data: https://developers.google.com/search/docs/appearance/structured-data/local-business
- Schema.org LocalBusiness: https://schema.org/LocalBusiness
- React `lazy`: https://react.dev/reference/react/lazy
- Motion `MotionConfig`: https://motion.dev/docs/react-motion-config
- Vite dynamic import/code splitting: https://vite.dev/guide/features

## Deferred scope

SMTP and WhatsApp production activation, official social URLs, complete company particulars and final supplied-image publication approval remain deferred until after Phase 11. The installed kernel update still requires a separately authorized maintenance reboot.

Phase 11 remains pending and must not start without explicit approval.
