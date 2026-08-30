# Golden Studio Plus — Admin analysis Phase 7 release manifest

**Release date:** 30 August 2026
**Branch:** `codex/phase7-external-acceptance-20260821`
**Plan:** `GOLDEN_STUDIO_PLUS_ADMIN_ANALYSIS_IMPLEMENTATION_PLAN_2026-08-29.md`, Phase 7
**Scope:** §8.1 message library, `ADM-08b` notification journal
**Status:** built and verified locally; **awaiting production deployment (includes a migration)**

## The constraint that shaped the design

The plan is explicit: *"the outbox must never lose a template."* `renderEmailTemplate` is synchronous and runs
inside notification transactions, so making it query the database would make it asynchronous, touch every call site,
and — worse — make rendering fail exactly when the database is briefly unavailable, which is when the outbox most
needs to keep working.

Overrides are therefore held in an **in-memory cache**. A lookup is a Map read that cannot throw and cannot block.
An empty cache means every template renders from the compiled registry, which is both today's state and the state
the system falls back to if a refresh ever fails. Four tests hold that line:

- with no override, rendering matches the compiled template;
- a **draft** changes nothing that is sent;
- a stored override with an empty body is **ignored** rather than blanking a customer e-mail;
- with the cache never loaded — a database unreachable at refresh time — rendering still succeeds.

The cache is loaded at start-up, refreshed every minute so a publish from another process is picked up, and
refreshed immediately on publish or revert.

## §8.1 — the library

- Every one of the 37 codes is listed with its compiled copy, its published override and its draft, so an operator
  edits from what exists rather than from a blank field.
- Draft → preview → publish, with the previous version **archived rather than overwritten**.
- **Return to the original**: the override is archived and the compiled template takes effect again. Nothing is
  deleted, so the history of what was sent survives.
- Preview renders with plausible sample data, so no real reservation is needed, and previews an *unsaved* draft.
- Test send renders through the real pipeline and goes to the studio's own address — a test asserts it is queued
  with no reservation attached.
- An override with an empty subject or no body is refused at the API.
## §8.1 — the sending rules

The first build of this stored rules and served them, and nothing read them. An owner could have set a delay and
believed it took effect. That is worse than not shipping the feature, so the rules are now applied — and the parts
that could not be honoured were removed rather than left as controls that do nothing.

- Rules are applied in `processNotificationEvent`, the single point every internal e-mail passes on its way out.
  Applying them there rather than at each of the fifteen places that enqueue one means a rule cannot be forgotten at
  a call site, and an event **already queued** obeys a rule set after it was queued.
- **A missing row is not a gap**: the twelve governed events are all listed, and one with no rule reads *Comportement
  de l'application* — immediate, no grouping, five attempts. Nothing changes until an owner sets a rule.
- **Delay** defers the first attempt to `createdAt + delay`; a test asserts the same event then goes out, so nothing
  is lost.
- **Grouping** cancels a repeat only when a message of the same type and recipient was already **sent** inside the
  window, and points at it through `replacementEventId`. No notice disappears without one of its kind having arrived.
- **Four alarms cannot be switched off** — Cal.com sync failure, WhatsApp delivery failure, permanent bounce, data
  integrity incident. They are the only signal that something is broken. The API refuses `isEnabled: false` with a
  message saying so, the cache re-enables them whatever a stored row says, and the dialog offers no switch at all
  rather than one that would be refused on save. Delay and grouping still apply.
- **Customer messages are out of reach by construction**: `GOVERNED_EVENTS` lists only the studio's own internal
  e-mails, and a rule for anything else is refused with 404 and ignored by the cache.
- `fallbackChannel` was dropped from the schema by a second migration. Nothing read it, WhatsApp is switched off in
  production, and a column an owner could set and no code would honour is worse than no column.
- The cache follows the template overrides exactly: loaded at startup, refreshed on write and every 60 seconds, and
  an unreadable rule table leaves the outbox on the compiled behaviour. A test holds that line.

## ADM-08b — the journal

- Filters on channel, status, type, date range and *actionable only* (failed and unclassified), all held in the URL
  so a filtered journal is shareable and survives a reload, with a real total.
- **A channel the studio has not switched on is hidden by default and the fact is stated** — WhatsApp today — with
  an explicit control to include it. The rows are never deleted.
- Each row leads with the business name, audience and status; the raw code, template, attempts, provider status and
  error sit behind a *Détail technique* toggle. A test asserts the raw code is **not** on the row until asked for.
- How a failure was classified stays on the business line, not behind the toggle.

## A regression caught by the suite

Extracting the journal dropped the *Disposition* column, so a failure classified *Obsolète* no longer showed that
anywhere. `p2-04` caught it. The label is restored on the business line, where it belongs operationally.

The Phase 1 label guard also fired as designed: the new `message_template_test_admin` type had no French name, and
the completeness test failed until it was registered.

## Two defects found by the production replay

**The journal misattributed every overridden send.** `renderEmailTemplate` returned the compiled version string even
when a published override had supplied the text, and all fifteen enqueue sites wrote that constant into
`NotificationEvent.templateVersion`. The replay caught it directly: a message rendered from override v1 was recorded
as `2026-08-20-phase4`. The render now returns `<compiled>+override.v<n>` when an override is used, every site records
what actually rendered rather than a constant, and a test pins it. This is the one thing the journal exists to say,
so recording the wrong answer was worth a second deployment.

**The sending rules were inert.** Described above.

## Verification evidence

- Backend suite: **244 passed, 0 failed across 33 files** (226 before, plus 18 new).
- Frontend unit suite: **128 passed, 0 failed**.
- New browser suite: **8 passed** on Chromium (5 for the library and journal, 3 for the rules).
- Full local Chromium regression: **122 passed, 0 failed** (114 before this phase).
- Frontend lint and backend TypeScript build: clean.
- Build into a scratch directory: budgets and tracker audit passed, production `dist` untouched.

The admin JavaScript chunk **shrank again, 45,969 → 42,951 bytes**, since the journal moved into its own lazily
loaded panel. Public CSS is unchanged at 66,576 and the public entry is unchanged at 272,008.

`AdminDashboard.jsx` is now **1,442 lines**, down from 1,883 when this plan began.

## Exit gate

| Requirement | Evidence | Result |
| --- | --- | --- |
| *"Chaque ligne est compréhensible sans connaître le code du modèle"* | Business name, audience and trigger on the row; codes behind a toggle | Passed locally |
| *"Les anomalies exploitables sont filtrables"* | `actionableOnly` filter, held in the URL | Passed locally |
| Disabled channels hidden by default | Hidden with the fact stated and an explicit override | Passed |
| Editable library with preview, test send, version and rollback | Draft, preview with sample data, publish, archive, revert | Passed locally |
| The outbox never loses a template | Four tests, including an unloaded cache and an empty-body override | Passed |
| Editable sending rules | Applied at the dispatch gate; alarms refuse to be silenced | Passed locally |
| Production replay of §8.1 | 37 codes listed, draft inert, publish switches the send path, revert restores the compiled copy | **Passed in production** |
| Production replay of the rules | 12 events listed, alarms refuse to be silenced, a customer message is refused, a saved rule reaches the cache | **Passed in production** |
| Production replay of the version fix | A send from override v2 recorded as `2026-08-20-phase4+override.v2`; compiled sends unchanged | **Passed in production** |

## Deployment

**First deployment — done.** The migration created two empty tables; the backend was restarted and the frontend
rebuilt. §8.1 was then replayed against production end to end:

| Step | Result |
| --- | --- |
| List the library | 37 codes, 0 overrides in the send path |
| Save a draft | Stored; send path still 0 overrides |
| Render through the real pipeline with the draft unpublished | Compiled text, no marker |
| Publish | 1 override in the send path, draft cleared, version 1 |
| Render again | The studio's text, marker present |
| Revert to the original | 0 overrides, compiled text restored, the override archived not deleted |
| Journal filters | Channel, status, type, date and *actionable only* all answered with a real total |

Production ends on the compiled copy, exactly as it started. The one archived `MessageTemplate` row is the deliberate
history of that replay.

**Second deployment — done.** Carried the version-attribution fix and the applied sending rules, and was replayed:

| Step | Result |
| --- | --- |
| List the rules | 12 governed events, none configured, 0 rules in the cache |
| Silence an alarm | Refused, `MESSAGE_EVENT_UNSILENCEABLE`, nothing stored |
| Set a rule on a customer message | Refused, `MESSAGE_EVENT_NOT_FOUND` |
| Save a rule | Reached the dispatch cache immediately; the other eleven events untouched |
| Send from a published override | Recorded as `2026-08-20-phase4+override.v2` — the defect the first replay found |
| Send after reverting | Recorded as `2026-08-20-phase4`, compiled text |
| Restore | Rule removed, template reverted; the cache confirmed empty after its periodic refresh |

Production ends with no rules and no overrides — the state it started in. The archived `MessageTemplate` rows are the
deliberate history of the two replays.

Its migration reached production at 05:48, ahead of the deployment step, as a side effect of a `prisma migrate deploy`
run while setting up the rule tests. It drops a column from an empty table that no running code read, so nothing was
at risk, but it was not the intended sequence and is recorded here rather than glossed over.

## Known limitation

There is no route to delete a rule, only to set one. An owner who wants to undo a rule can clear every field and
leave the message enabled, which is behaviourally identical to the compiled default — `applyMessageRule` returns
early on every branch — but the panel will still read *Réglée par le studio* rather than *Comportement de
l'application*. Cosmetic, not behavioural. Worth a delete route in Phase 10, not a third deployment now.
