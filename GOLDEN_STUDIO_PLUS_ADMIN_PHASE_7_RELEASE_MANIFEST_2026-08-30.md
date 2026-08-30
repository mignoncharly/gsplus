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
- `MessageRule` records delay, grouping window, attempts, fallback channel and enablement per event. A missing row
  means the behaviour compiled into the workers, so recording rules changes nothing until one is set.

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

## Verification evidence

- Backend suite: **236 passed, 0 failed across 32 files** (226 before, plus 10 new).
- Frontend unit suite: **128 passed, 0 failed**.
- New browser suite: **10 passed** across Chromium and WebKit.
- Full local Chromium regression: **119 passed, 0 failed** (114 before, plus 5 new).
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
| Production replay | **Outstanding** — needs deployment, including a migration | Pending |

## Deployment

Same shape as Phases 3 to 6. The migration creates two empty tables and nothing else. With no published override the
render path uses the compiled registry, so the running backend is unaffected and the migration can be applied before
the restart.
