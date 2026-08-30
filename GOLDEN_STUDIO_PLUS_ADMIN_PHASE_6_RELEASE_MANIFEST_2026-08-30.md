# Golden Studio Plus — Admin analysis Phase 6 release manifest

**Release date:** 30 August 2026
**Branch:** `codex/phase7-external-acceptance-20260821`
**Plan:** `GOLDEN_STUDIO_PLUS_ADMIN_ANALYSIS_IMPLEMENTATION_PLAN_2026-08-29.md`, Phase 6
**Finding:** `ADM-09` — *trop de contenus nécessitent encore le développeur*
**Status:** complete and deployed to production

## The gap this closes

The public phone number was hard-coded in **four** component files plus the structured-data block, payment
instructions were translation strings, and SEO copy was a frozen array. A commercial or legal edit meant a code
change and a deployment — the report's *"une modification commerciale ou juridique mineure peut nécessiter une
intervention technique"*.

## Two stores, one principle

`StudioSetting` holds one JSON row per group, and `SiteContent` holds versioned page copy. Both are driven by a
**typed registry in code whose defaults are exactly the values that were hard-coded before**. Nothing is seeded and
nothing is backfilled: with zero rows the site renders precisely as it did, and a test asserts that the registry's
default phone number is still `+237673026654`.

The report's eight groups are all present: Identité, Paiement, Réservation, Livraison, Juridique, Intégrations, SEO
and Fonctionnalités.

### Secrets stay out, and the interface says so

No field in any group may be a credential. A test walks every field key across every group and fails on anything
matching *secret*, *token*, *password* or *apikey*, and asserts the public projection contains none of those words.
Unknown keys sent to the API are dropped rather than stored, so the registry remains the contract — a test posts
`smtpPassword` and asserts it is not persisted. The panel states plainly that provider credentials live in the
server configuration, rather than leaving the owner to wonder.

### Content is drafted, previewed, then published

`SiteContent` reuses the catalogue's lifecycle. A draft is invisible to the public; publishing freezes it and
**archives the previous version rather than overwriting it**; the next edit opens a new version. The panel shows the
published values and any draft side by side, in different colours, so the difference is obvious before publishing.
Publishing with no draft is refused.

Per the report, French and English are **not** presented side by side — automatic translation already exists, so
each entry is edited in one locale.

## The public site

A provider reads `/api/site-settings` once per page load and merges it over the compiled fallbacks, so the site
renders immediately and a slow or failed request never blanks a phone number. All four hard-coded call sites now
read the published value, and a test asserts none of them still contains the literal number.

## A regression this phase introduced, caught and fixed

The first build showed the public entry growing **269,860 → 279,938 bytes**. The cause was mine: the settings
provider is loaded eagerly by every visitor and imported `lib/api.js`, which holds the entire administration API
surface — so Phases 3, 4 and 5's admin endpoints were being downloaded by the public.

Confirmed by comparing builds: `financial-tasks`, `schedule/business-hours` and `admin/settings` appear in the
Phase 6 entry and in **neither** the Phase 4 nor Phase 5 entry, and not in what production serves today.

The transport moved to `lib/api-transport.js`, the public call into `lib/public-settings-api.js`, and the entry fell
back to **272,008 bytes** — the remaining 2,148 being the provider itself, which is the honest cost of the feature.

A budget check now fails the build if the entry contains any administration API path, naming the fix in its message.
Mutation-tested: restoring the bad import reproduces the failure.

## Verification evidence

- Backend suite: **226 passed, 0 failed** (218 before, plus 8 new).
- Frontend unit suite: **128 passed, 0 failed** (124 before, plus 4 new).
- New browser suite: **8 passed** across Chromium and WebKit.
- Full local Chromium regression: **114 passed, 0 failed** (110 before, plus 4 new).
- Frontend lint and backend TypeScript build: clean.
- Build into a scratch directory: budgets and tracker audit passed, production `dist` untouched.

| Budget | Phase 5 | Phase 6 | Limit |
| --- | --- | --- | --- |
| entry JS | 269,860 | 272,008 | 400,000 |
| `publicCssBytes` | **66,576** | **66,576** | 68,000 |
| `privateAdminSharedCssBytes` | 18,112 | 18,112 | 20,000 |
| `privateAdminCssBytes` | 28,116 | 29,000 | 45,000 |

## Exit gate

| Requirement | Evidence | Result |
| --- | --- | --- |
| *"Le propriétaire peut modifier les informations ordinaires…"* | Eight groups editable in the interface; a browser test changes the public phone number | Passed locally |
| *"…prévisualiser et publier sans déploiement de code"* | Draft, side-by-side comparison with the published version, then publish; history preserved | Passed locally |
| Secrets never editable or exposed | Registry-wide assertion plus unknown-key rejection | Passed |
| No public regression if the API fails | Compiled fallbacks asserted to match the previously hard-coded values | Passed |
| Production replay | The phone number was changed through the admin and appeared publicly; a content draft stayed invisible until published; production was restored | Passed |

## Deployment evidence — 30 August 2026

- Database dumped to `.phase-admin1-backups/goldenstudioplus_db-pre-admin-phase6.dump` (361 KB); both dists copied
  beside it.
- Migration applied: both tables created, **0 rows in each**, so the application served the compiled defaults and the
  running backend was unaffected. `/api/site-settings` correctly returned 404 until the restart, confirming nothing
  had changed for anyone yet.
- Backend restarted by the owner: PID 3644722 → 4060737 at 04:32:35 UTC. The projection then served all eight groups
  with `Cache-Control: public, max-age=60, stale-while-revalidate=300`, and a scan of the response found no
  secret-shaped key.
- Frontend rebuilt; live entry `assets/index-DfQPLZ4j.js` verified by SHA-256. The served entry contains **zero**
  occurrences of `/api/admin/settings`, `/api/admin/financial-tasks` or `/api/admin/schedule/`, confirming the
  bundle regression is fixed in what visitors actually download.

## Production replay — the acceptance criterion, end to end

| Step | Public projection |
| --- | --- |
| Before | phone `+237 673 026 654`, hours `9 h - 18 h` |
| Phone changed through the admin API | phone **`+237 690 111 222`** |
| Content draft saved | hours **unchanged** — a draft is invisible to the public |
| Draft published | hours **`10 h - 17 h`** |
| Both restored | phone `+237 673 026 654`, hours `9 h - 18 h` |

Production is back to its starting values, with `publicName` and `whatsappEnabled` confirmed untouched.

In the browser: the live contact page renders `tel:+237673026654` with the display text `+237 673 026 654`, and the
WhatsApp link resolves to `https://wa.me/237673026654` — both now read from the published settings rather than from
the bundle. The administration lists all eight setting groups and the three content entries, states where secrets
live, and marks the identity group as customised, since the replay wrote and restored it.
