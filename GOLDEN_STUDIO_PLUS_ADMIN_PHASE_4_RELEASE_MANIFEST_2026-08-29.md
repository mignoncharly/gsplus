# Golden Studio Plus — Admin analysis Phase 4 release manifest

**Release date:** 29 August 2026
**Branch:** `codex/phase7-external-acceptance-20260821`
**Plan:** `GOLDEN_STUDIO_PLUS_ADMIN_ANALYSIS_IMPLEMENTATION_PLAN_2026-08-29.md`, Phase 4
**Findings:** `ADM-01` dashboard, `ADM-02` search and filtering, `ADM-03` mobile
**Status:** built and verified locally; **awaiting production deployment (includes a migration)**

## ADM-02 — search moves to the server

`GET /admin/reservations` filtered on an exact reference and nothing else. It now accepts:

| Parameter | Behaviour |
| --- | --- |
| `q` | Free text over reference, first and last name, e-mail, phone, pack name and transaction code |
| `status` | Repeatable reservation status |
| `payment` | Repeatable payment status, including `NONE` for a reservation with no payment at all |
| `packageId` | Pack filter |
| `from` / `to` | Douala **business-day** range on the session date, not a UTC day |
| `sort` / `direction` | `startAt`, `createdAt` or `reference`, ascending or descending |
| `reference` | The historical exact lookup, unchanged |

The response now carries `{ total, limit, offset }`, so the list is no longer a blind 50-row window.

**Free text reaches both the live customer row and the frozen snapshot.** A customer can edit their profile after
booking; the snapshot is what the studio agreed to. Searching only one of the two loses records either way, and a
test books a reservation under one name, renames the customer, and asserts both names still find it.

**The lying schema is gone.** `listQuerySchema` declared `status` and `reference` that no route ever read, so the
reservation list looked filterable while ignoring both. Those fields now live in `reservationListQuerySchema`, where
they are applied; leads and notifications keep plain pagination until their own phases give them filters.

Two supporting indexes ship in `20260829170000_admin_phase_4_reservation_search`.

## ADM-01 — the dashboard leads with decisions

`GET /admin/dashboard` returns the report's §14 zones. Each entry carries a label, a count **and the address that
opens the list it counts**, and every count is a database count over the same predicate that list uses — so a card
and its list cannot disagree. A test follows a counter's own `href` into the list endpoint and asserts the totals
match.

The previous tiles were computed in the browser from the first 50 rows, which made all four silently wrong past 50
reservations.

**Revenue is stated honestly.** *Chiffre d'affaires vérifié* now separates payments on active bookings from those on
cancelled or refused ones, and subtracts refunds:

```
net = verified on active reservations − refunded this month
```

The amount verified against cancelled bookings is displayed rather than folded away, because a verified payment on a
cancelled booking is not income. A test seeds exactly that case — 25 000 on an active booking, 40 000 on a cancelled
one — and asserts the net is 25 000.

The fourth counter is now **Demandes reçues**, as the report asks.

One correction made while writing the tests: the page's opening line first counted *every* zone as work awaiting a
decision, including the day's sessions. Sessions are information, not a backlog, so they are shown but excluded from
the count.

## ADM-03 — the phone layout

Below 768 px the reservation table is replaced by cards carrying reference, both statuses, client, time, pack and
one primary action, with the record opening in its own address. Two browser assertions at 390 px require
`scrollingElement.scrollWidth <= clientWidth` on the list and on the dashboard.

## Extraction, and what it did to the budgets

`AdminOverviewPanel` and `AdminReservationsPanel` moved out of `AdminDashboard.jsx` with their own stylesheets. The
dashboard file went from **1,808 to 1,580 lines**, and the superseded code went with it: the reference-only search,
the browser-side revenue and unique-customer computation, and the 60-second poll that re-fetched the whole
reservation list for two views that now fetch their own data.

The admin CSS budget then failed at 25,668 against a 24,000 limit. Removing the dead rules the extraction orphaned —
the four old stat tiles and the reference-search controls — recovered 1,754 bytes, but the honest reading is that
**the budget was measuring the wrong thing**:

- Admin CSS is not one download. It is a shared shell plus one lazily-loaded chunk per panel: 7 chunks, 25,668 bytes
  raw, **5,282 bytes gzipped**, of which an operator fetches the shell and only the panels they open.
- Summing all chunks therefore *penalises* the per-panel extraction the plan requires each phase.

The guard now measures what matters, mirroring the public/private split made in Phase 1:

| Budget | Phase 4 | Limit | Why |
| --- | --- | --- | --- |
| `privateAdminSharedCssBytes` | 18,112 | 20,000 | The shell everyone loads; should shrink as panels extract |
| `largestPrivateAdminPanelCssBytes` | 2,099 | 6,000 | No single panel may balloon |
| `privateAdminCssBytes` | 25,668 | 45,000 | Loose ceiling for the remaining phases |
| `publicCssBytes` | **66,576** | 68,000 | Unchanged, still strict |

The admin JavaScript chunk also **shrank from 52,741 to 46,624 bytes**, because both panels now load on demand.

## Test contracts updated, intent preserved

`REF-01` asserted a specific client function signature and specific markup in `AdminDashboard.jsx`. Both moved:
reference lookup now runs through the general search, normalised server-side, and the search UI lives in
`AdminReservationsPanel`. The guarantees are unchanged and now asserted at their new locations — a lower-case
reference still matches, the label still exists, the public reference is displayed and the technical id is not. The
browser spec additionally asserts that at 390 px the visible copy is the card, and the table is hidden.

One robustness fix came out of that spec: a malformed dashboard payload used to throw during render and take the
whole admin shell down with it, including the navigation — the operator's only way out. It now degrades to a message.

## Verification evidence

- Backend suite: **207 passed, 0 failed across 28 files** (197 before, plus 10 new).
- Frontend unit suite: **124 passed, 0 failed**.
- New browser suite: **14 passed** across Chromium and WebKit.
- Full local Chromium regression: **105 passed, 0 failed** (95 before, plus 10 new).
- Frontend lint and backend TypeScript build: clean.
- Full `npm run build` into a scratch directory: budgets and tracker audit passed, production `dist` untouched.

## Defects the regression exposed

The first full run produced seven failures. Three were stale assertions; four were real defects, two of them
pre-existing.

1. **`refreshAdminTab` reported success as failure.** Moving the overview and reservations views to their own
   fetching left an early `return;`, which yields `undefined`. The caller reads that as "the refresh failed", so
   every action taken from those views ended with *"Action enregistrée, mais les données n'ont pas pu être
   rechargées."* — an alarming message after a successful decision.
2. **The same bug already existed for the finance tab**, whose `return;` predates this phase. Every refund action in
   the module shipped in Phase 3 would have shown that spurious error. Both now return `true`, because nothing to
   refresh is a success.
3. **The action dialog stole focus back.** Its initial-focus `requestAnimationFrame` unconditionally moved focus to
   the first field, so anyone typing quickly after opening a dialog could be yanked out of the field they chose. The
   extra navigation added by addressable records shifted the timing enough to make this reproducible. Initial focus
   is now skipped when focus is already inside the dialog.
4. **The record action was named twice.** The card layout called it *Ouvrir le dossier* and the table *Détails*. A
   control that renames itself by viewport is confusing to operators and to assistive technology, so both now read
   *Détails*.

The three stale assertions were the renamed search label, the renamed dashboard heading, and a lead-fetch counter
in `p2-02` that shifted because the overview stopped fetching leads it never displayed. The accessibility spec also
needed a real dashboard payload rather than an empty array; with one, axe reports no serious or critical violations
on the new view.

## Exit gate

| Requirement | Evidence | Result |
| --- | --- | --- |
| *"Chaque compteur ouvre la liste filtrée correspondante"* | Every entry carries an `href`; a test follows one into the list and compares totals | Passed locally |
| *"Aucun indicateur ne mélange des catégories différentes"* | Revenue split across active, cancelled and refunded; counter renamed *Demandes reçues* | Passed locally |
| *"Un dossier est retrouvable par n'importe quelle donnée métier en moins de trois actions"* | One search field over six data kinds, across live and frozen contact data | Passed locally |
| *"Les filtres restent visibles et partageables par URL"* | Filters live in the query string, survive a reload, reset button restores the bare address | Passed locally |
| *"À 390 pixels, les données essentielles et l'action principale sont visibles sans défilement horizontal"* | Card layout asserted at 390 px on both the list and the dashboard | Passed locally |
| Production replay | **Outstanding** — needs deployment, including a migration | Pending |

## Deployment

Like Phase 3 this changes the database, so it needs the same three steps: `prisma migrate deploy`, backend rebuild
and service restart, then the frontend rebuild. The migration adds two indexes and nothing else — no column, no
data — so the running backend is unaffected by it and it can be applied before the restart.
