# Golden Studio Plus — Phase 9 release manifest
## Exploitation: requests, portfolio, data rights (report §7, §10, `ADM-10`)

**Status:** built and verified locally; awaiting production deployment. Two migrations, one of
which must be applied **after** the restart — see *Deployment*.

Three modules that all had the same shape of problem: the data was already there, and nothing
made it workable.

## §7 — Demandes reçues

**A creative request was indistinguishable from a photography quote.** The creative-services
form posted through `submitQuoteRequest`, so a request for a flyer and a request for a wedding
shoot arrived in the same list, under the same label, separable only by a phrase the form
happened to write into the subject.

- `LeadType.CREATIVE` and `POST /api/creative-requests`, with its own `CREA-` reference prefix
  so the kind is legible before the record is opened. Existing creative requests keep the
  `DEVIS-` references they were given — a reference is an identifier the customer may have
  written down.
- The backfill re-files them by that subject phrase, which is the only record of origin that
  was kept. On the live data it separates **three creative requests from one photography
  quote** — exactly the split the report describes.
- `WON` and `LOST` are gone from every surface. Both meant the studio had finished, which is
  what *Traité* says; the API refuses them, the panel offers only the report's four statuses,
  and the enum members remain solely so historical rows stay readable.
- Search over reference, name, company, e-mail, phone, subject and message body; filters on
  type, status and Douala business day; a real total; CSV export **of the filtered list**, not
  the whole table.
- Contact actions: call, write, and WhatsApp **only where the demander consented**. A request
  with no e-mail offers no write action rather than a broken link.
- An internal note, visibly separate from the demander's own words, which it never touches.
- *Traité* records who closed it and when; reopening clears both rather than leaving a stale
  author on an open request.

**Out of scope, by the report's own instruction, and not built:** assignment, pipeline,
opportunity value, automated follow-up, conversion measurement.

## §10 — Portfolio

The columns have always been nullable and nothing ever raised them, so a picture with no
dimensions, no thumbnail or no rights basis looked exactly like a healthy one.

- Alerts computed on read, never stored, so the list and the summary cannot disagree.
- Severity is about consequence: **blocking** means it must not be published as it stands —
  rights not established, a customer image with no active authorisation, a zero-byte file —
  and **warning** means it will render, badly.
- The case surfaced first is the one that matters: **published *and* blocking**, live on the
  site and shouldn't be.
- Each alert says what it costs, not just what is missing: unknown dimensions means "the page
  reserves the wrong space and the layout jumps".
- A filter for *only what needs fixing*, and reordering that sends the whole sequence.

On the live portfolio: 18 media, of which one has no dimensions, one no thumbnail and one no
rights basis.

## `ADM-10` — the register as a work queue

The record already carried the due date, the identity evidence, the response evidence, the
closure and a full event trail. None of it could be searched, and **a due date nobody is warned
by is a due date that gets missed**.

- Search over reference, requester, e-mail, phone, linked reservation and summary; filters on
  status, right exercised, and a due-within-days window; open-only by default.
- Lateness computed from the clock, never a stored flag, so it cannot drift from the date it
  describes. A closed request is never *late* — it was answered — but `answeredLate` survives,
  so a register of late answers does not silently show none.
- Four response templates for the steps the register actually has. They are plain text an
  operator adapts and sends from their own mailbox: the panel says so, and a refusal with no
  reason keeps a visible `[motif]` hole rather than reading as a finished letter.
- CSV export of the register, audit-logged as an act in its own right.
- Contrast, delivered in the Phase 5 accessibility pass, was re-verified: lateness is carried
  by a word and a rule, not by colour alone.

## A defect I caused, and how it was contained

Running `prisma migrate deploy` from `backend/` applies to the **live** database — that
directory's `.env` is production, and production runs from this working directory. Intending to
migrate the test database, I applied the Phase 9 migration to production, and its backfill wrote
`LeadType.CREATIVE` into three live rows. The running server's Prisma client had never heard of
that value, so **every read of the table failed and `GET /admin/leads` returned 500** for about
two minutes, until the three rows were reverted to `QUOTE`.

Two things changed as a result:

- The backfill was split out into `20260830160200_admin_phase_9_creative_backfill_after_deploy`,
  written to be a no-op wherever it has already run. Adding an enum value is safe ahead of a
  restart; **writing that value into a row is not**, and the ordering is now part of the
  migration set rather than part of my memory.
- `test/global-setup.ts` already derives and migrates its own `_test` database, so `npx vitest
  run` never needed a manual migrate. No test run in this phase touched production again.

## A regression the suite caught, in this phase and the last one

`P2-02` asserts that *Actualiser* refreshes an open tab without reloading the page. Making
the requests panel fetch its own rows — the same pattern the journal took in Phase 7 —
broke it: the dashboard's refresh button no longer reached either panel, because neither
listened to anything the button changed. **Phase 7 shipped that gap in the journal and
nothing caught it**, because `P2-02` only exercises the requests list. Both panels now take
the dashboard's refresh clock as a dependency.

`P2-02` also crashed the panel outright: its fixture has no `createdAt`, and
`formatBusinessDateTime` throws on an invalid value, so **one unreadable date blanked the
whole list** instead of leaving one gap in it. The panel now degrades per field.

`phase-4-admin` caught the third: the deep link `/admin/leads/:ref` used to work because
the resolver injected the request into the list. It now works because the panel searches
for the reference the path carries — which is better, but only as long as the search finds
an archived request too. It does: the search matches the reference exactly, whatever the
status filter would otherwise hide.

## Verification evidence

- New browser suite `adm-phase-9-exploitation.spec.js`: **9 passed**.
- New backend suites: **8** for received requests, **6** for media integrity, **5** for the
  rights queue.
- Frontend unit suite: **128 passed**.
- Backend suite: **268 passed across 37 files** (249 before, plus 19 new).
- Full local Chromium regression: **140 passed, 0 failed** (131 before, plus 9 new).
- Frontend lint and backend TypeScript build: clean.

**A guard that fired as designed.** The Phase 1 enum-completeness test failed the moment
`LeadStatus` gained a comment: its parser read comment lines as members. The comment explains why
`WON` and `LOST` still exist, so it stays, and the parser learned to skip comments. `HANDLED` and
`CREATIVE` both needed French labels before it passed again.

## Exit gate

| Requirement | Evidence | Result |
| --- | --- | --- |
| Creative requests distinguishable from photo quotes | New type, own endpoint, own prefix, backfill by origin | Passed locally |
| Report's four statuses, no pipeline | API refuses `WON`/`LOST`; panel offers four | Passed locally |
| Search, filters, contact actions, e-mail history, note, export | Browser suite, all five | Passed locally |
| Media integrity as an actionable list | Computed alerts, severity by consequence, live-and-blocking surfaced | Passed locally |
| Rights register searchable, due dates surfaced, templates, export | Queue, computed lateness, four templates, audited export | Passed locally |
| `ADM-10` contrast still correct | Lateness carried by word and rule, not colour | Passed |
| Production replay | **Outstanding** — needs deployment | Pending |

## Deployment

**Order matters in this phase, and it is not the usual one.**

1. Back up the database.
2. Build the backend.
3. Apply the schema migrations — `20260830160000` adds the enum values and the columns; it is
   safe against the running server, which simply never sees the new values.
4. **Hand off the restart.** Nothing may write `CREATIVE` into a row before this.
5. Apply `20260830160200`, the backfill, against the now-current server.
6. Build the frontend — *after* the restart, per the Phase 8 lesson.
7. Replay in production.

The rights register is **empty in production**, so its replay can only prove the queue, the
filters, the templates and the export behave — not that they order real requests correctly.
That limit is stated rather than papered over.
