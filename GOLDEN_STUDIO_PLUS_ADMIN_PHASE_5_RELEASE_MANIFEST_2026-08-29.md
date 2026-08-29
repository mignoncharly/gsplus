# Golden Studio Plus — Admin analysis Phase 5 release manifest

**Release date:** 29 August 2026
**Branch:** `codex/phase7-external-acceptance-20260821`
**Plan:** `GOLDEN_STUDIO_PLUS_ADMIN_ANALYSIS_IMPLEMENTATION_PLAN_2026-08-29.md`, Phase 5
**Findings:** `ADM-05` planning and availability (**P0**), `ADM-06` closure
**Status:** complete and deployed to production

## The gap this closes

`BusinessHour` existed in the database and the availability engine read it, but **no route ever wrote it**. Changing
an opening time was a database operation, which is exactly what the report meant by *"les disponibilités exigent
une intervention du développeur"*. There were also no dated exceptions, no breaks, and no explicit booking policy.

## One resolver, because a split would show customers slots that do not exist

Opening hours were worked out in **two** places: the public slot grid in `availability.ts`, and the authoritative
check inside the booking transaction in `booking-slots.ts`. Adding breaks, exceptions and rules to each separately
would let them drift, and a drift here has a specific, bad shape — **the site offers a slot the booking then
refuses.**

All schedule resolution therefore moved into one module, `services/schedule-rules.ts`, which both paths call.
A test asserts the property directly: for every slot in a day containing a break, a slot the grid marks available
must be accepted by the booking check, and a slot it marks unavailable must be refused.

Relocating the package-rule parser into that module also removed a circular import the change had introduced
between the two services.

## Schema

Migration `20260829200000_admin_phase_5_scheduling_rules`:

| Change | Purpose |
| --- | --- |
| `BusinessHour.breaks JSONB` | Intra-day pauses |
| `ScheduleException` | A dated override of the weekly pattern — holiday, exceptional closure, or unusual hours |
| `BookingRule` | Minimum notice, horizon, daily capacity and buffer; one global row plus per-package overrides |

Postgres treats NULLs as distinct in a unique index, so a plain unique on `packageId` would have allowed many
"global" rows. A unique index on a constant, restricted to rows with no package, keeps the global policy a
singleton — a test saves it three times and asserts one row.

## Every default reproduces the previous behaviour

The first run of the backend suite failed two reschedule tests with *"Ce créneau dépasse l'horizon de réservation
ouvert"*. The cause was a default I chose: `horizonDays: 365`. **Before this phase there was no horizon at all**,
so that default silently changed what customers could book the moment it deployed.

Every default now reproduces the prior behaviour exactly — no minimum notice, no horizon, no capacity, no buffer —
and a test books a slot 900 days out with no rule configured to hold that line. In the interface an empty field
reads as *"aucune limite"* rather than as zero.

`maxReservationsPerDay` in `Package.options.bookingRules` predates this table and still wins for the package that
declares it, so no existing quota changed meaning.

## Backend

Audited, `RESERVATION_RESCHEDULE`-gated routes for business hours, exceptions and booking rules, plus
`GET /admin/schedule/planning` for the agenda window and `GET /admin/calendar/health`.

Incoherent schedules are refused rather than silently producing a day with no slots: a closing time before the
opening time, a break outside the day's hours, or overlapping breaks all return 400.

## Frontend

`/admin/planning` replaces the old Disponibilités tab, which was a bare create form and a flat list:

- **Cal.com health** — last success, last failure, pending and failing counts.
- **Agenda** with day, week and month ranges, addressable through `?vue=` and `?debut=` so a range survives a
  reload. Reservations, temporary holds and blocks are visually distinct; a closed day reads as closed **with its
  reason** rather than merely looking empty.
- **Weekly hours**, editable per day including breaks.
- **Dated exceptions**, added and removed in place.
- **Booking rules**, with empty meaning no limit.
- **Blocks**, now created through the same action dialog as every other scheduling change.

## ADM-06 closure

Phase 0 established the reported defect no longer occurs and replayed it in production. The plan reduced the
remaining work to the conflict case, which is now covered: moving a reservation onto an occupied slot is refused
and the original slot is left untouched; moving onto a day closed by an exception is refused **with the exception's
reason in the message**; and an accepted move that is replayed with the same command id produces no second calendar
synchronisation.

## Verification evidence

- Backend suite: **218 passed, 0 failed across 30 files** (207 before, plus 11 new).
- Frontend unit suite: **124 passed, 0 failed**.
- New browser suite: **10 passed** across Chromium and WebKit.
- Full local Chromium regression: **110 passed, 0 failed** (105 before, plus 5 new).
- Frontend lint and backend TypeScript build: clean.

### One accessibility improvement the regression prompted

The planning view briefly carried nine controls all labelled *Modifier*, which a test found ambiguous — and a
screen-reader user would have heard the same undifferentiated list. Each now has an accessible name that says what
it edits (*"Modifier les horaires du lundi"*), while the visible label stays short. The accessible name still
contains the visible text, so WCAG 2.5.3 is satisfied.
- Build into a scratch directory: budgets and tracker audit passed, production `dist` untouched.

### Performance

The restructured budget did its job. The new panel is its own **2,448-byte** lazily-loaded chunk and the shared
shell held at 18,112 bytes, so the admin JavaScript chunk **shrank again, 46,624 → 45,025 bytes**, while public CSS
stayed at 66,576.

## Exit gate

| Requirement | Evidence | Result |
| --- | --- | --- |
| *"Le Studio peut modifier ses horaires et exceptions sans développement"* | Audited routes plus a browser test changing an opening hour through the interface | Passed locally |
| *"…le public et Cal.com reflètent la règle dans les minutes suivantes"* | An hour changed through the API is immediately visible in `getAvailability`; a dated closure removes the day's slots | Passed locally |
| Grid and booking agree | Every slot of a day with a break asserted in both directions | Passed |
| *"Le nouveau créneau est enregistré, visible côté public et synchronisé une seule fois"* | Conflict refused, exception refused with its reason, replayed command emits no second sync | Passed |
| Production replay | An hour changed through the admin appeared in the public availability API immediately; an exception closed the day and booking was refused; production restored to its original state | Passed |

## Deployment evidence — 29 August 2026

- Database dumped to `.phase-admin1-backups/goldenstudioplus_db-pre-admin-phase5.dump` (355 KB); both dists copied
  beside it.
- Migration applied and verified: `ScheduleException` and `BookingRule` created, `BusinessHour.breaks` present,
  **0 exception rows and 0 booking-rule rows**, so the engine behaved exactly as before. The public availability API
  was checked on the still-running previous process and answered normally.
- Backend restarted by the owner: PID 3195118 → 3644722 at 22:54:58 UTC. All five new endpoints then returned 200.
- Frontend rebuilt; live entry `assets/index-DN1vVAgD.js` verified by SHA-256, served against local.

## Production replay — the acceptance criterion, end to end

The report's criterion is that the studio can change its schedule *"sans développement"* and that *"le public […]
reflète la règle dans les minutes suivantes"*. That was replayed against production and then undone.

On a Thursday 120 days out, chosen so nothing could collide with a real booking window:

| Step | Public availability API |
| --- | --- |
| Before | open 09:00–18:00, 18 slots |
| After changing the hours through the admin to 11:00–15:00 with a 12:30–13:30 pause | open 11:00–15:00, 8 slots, **2 slots marked `schedule_break`** |
| After adding a dated exception | **closed**, with the reason returned to the public API |
| A booking attempt on the closed day | refused, HTTP 400 |
| After deleting the exception and restoring the hours | open 09:00–18:00, 18 slots |

Production was then confirmed identical to its starting state: the same seven business-hour rows including Sunday
closed and no breaks, zero exceptions, no booking rule, and an effective policy of no notice, no horizon, no
capacity and no buffer.

In the interface: the planning view renders seven agenda days with one closed and three real reservations, the
weekly hours are listed and editable, and the view fits a 390 px screen with no horizontal scroll.

## What the health panel found on its first day

Cal.com health reports **8 failed synchronisations**, the most recent on 28 July with `CALCOM_HTTP_400`, against a
last success on 21 August. Those failures were already in the database; nothing surfaced them, which is precisely
the blindness the report described. The dashboard's integrations card now reads *"8 — Échecs Cal.com"* and links
into the planning view.

**This is a finding, not a regression.** It predates this phase and needs its own investigation: eight reservations
may have no calendar event. It is recorded here rather than fixed, because diagnosing a provider rejection from
July is not this phase's scope.
