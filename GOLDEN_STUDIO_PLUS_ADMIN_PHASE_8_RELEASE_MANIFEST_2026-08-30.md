# Golden Studio Plus — Phase 8 release manifest
## Conditional tariff form (report §6.2, `ADM-07b`)

**Status:** built and verified locally; awaiting production deployment. No migration.

The report's §6.2 is a table of thirteen fields and what each should become. The form was
a flat list of twenty-four fields, every one of them required, with no dependency between
any of them. Rewriting it required giving the dialog a notion of conditionality first.

## The dialog learned three things

`AdminActionDialog` is shared by every administrative action, so the additions are opt-in
and change nothing for the dialogs that do not use them.

- `visibleWhen(values)` — a hidden field is not rendered **and not validated**, so it can
  never block a form the operator cannot see. Its value stays in state rather than being
  cleared, so switching a mode back finds what was typed still there.
- `required(values)` — a field that only matters in one mode.
- `deriveFrom` / `derive` — a field that follows another until someone edits it by hand,
  after which it is theirs.

## The form, field by field

| Field | Before | Now |
| --- | --- | --- |
| Nom | required | required |
| Identifiant URL | required, always shown | derived from the name, behind *Réglages avancés*; never auto-rewritten for an existing formula, whose public address is already in circulation |
| Section publique | derived from the formulas that already existed | the taxonomy itself, active sections only |
| Forme du tarif | absent | fixed amount, *à partir de*, or per month |
| Montant / Devise | required / fixed | unchanged — the report states the fixed XAF display is not a defect |
| Mode de réservation | required, drove nothing | drives duration, delivery and the public button |
| Durée | always shown, optional | required and shown for a direct booking, hidden and genuinely `null` for a contact formula |
| Résumé, contenu, inclusions, conditions | required | optional as a draft, each saying it is required to publish |
| Mentions obligatoires | required | unchanged, still validated separately before publication |
| Date d'effet | required, always shown | defaults to now, behind advanced, stating that a future date defers publication rather than scheduling it |
| Ordre | numeric field, always shown | behind advanced; the list arrows are the normal way |
| Livraison | free text, required | *Délai annoncé* or *Nous contacter*, which writes the studio's own wording |

## A regression caught by the suite

Loading the sections and the privileges alongside the formulas put all three behind one
`Promise.all`, so a taxonomy outage blanked the whole tariff tab — formulas included —
where before it could not have affected it at all. `p1-04` caught it, through a mock that
answers an unexpected route with a 500 rather than an empty list. The catalogue is now the
only call allowed to fail the refresh; the two additional panels settle independently. If
the sections are genuinely unavailable, *Créer un brouillon* is disabled and says why,
rather than opening a form whose section list is empty.

## Three defects found while doing it

**The reorder arrows did nothing.** They wrote `sortOrder ± 1`, and the catalogue is
spaced in tens — a formula at 20 moved to 19 and stayed exactly where it was, between 10
and 30. The arrows looked like they worked. Order is a property of the list, not of one
row, so `POST /admin/packages/reorder` now takes the whole sequence and rewrites it,
respaced in tens. A partial or duplicated list is refused rather than silently leaving the
formulas it omits at stale positions. The first test reproduces the old write and asserts
that nothing moves.

**A section holding no formula could not be chosen.** The category list was built from the
formulas that already existed, so the one case an owner opening a new section is in — a
section with nothing in it yet — was the case it could not express. It now reads the
taxonomy.

**Two of the four tariff shapes had no screen at all.** A percentage and a shared
advantage are `CatalogueBenefit` records, which had a complete API — create, update,
validate, publish, versioned — and no interface anywhere. The tariff form now says
percentages and double advantages are managed in the privileges, so the privileges had to
exist. `AdminCatalogueSectionsPanel` carries them, and the sections beside them.

## What is deliberately not built

Adding a **ninth section** requires a code change: `taxonomyKey` is a closed enum in the
server's validation, guarding data that is already published. The panel says so plainly
rather than offering a creation button that would fail. Renaming, reordering and
activating the eight existing sections all work.

A **future effective date** is accepted and stored, but publication is refused until the
date is reached — there is no scheduler that publishes on its own. The field's help text
states this rather than implying a scheduled publication that will not happen.

## Verification evidence

- New browser suite `adm-phase-8-tariff-form.spec.js`: **9 passed**.
- Full local Chromium regression: **131 passed, 0 failed** (122 before, plus 9 new).
- Backend suite: **249 passed across 34 files** (244 before, plus 5 for the reorder).
- Frontend unit suite: **128 passed**.
- Frontend lint and backend TypeScript build: clean.

**Guards that had to change, and were mutation-tested rather than trusted.** `P1-04`
pinned `required: true` on the presentation fields, in both the unit suite and the browser
suite — the exact behaviour §6.2 asks to remove. Rewriting a guard to match new code is how a regression gets waved through, so it
was repointed at the invariant that actually protects a client: those fields are refused
by `assertPublishable` at publication. It now reads the server's gate and asserts the form
*states* the requirement. Two mutations confirm it bites: making `description` required
again fails it, and dropping `conditions` from the publish gate fails it.

## Exit gate

| Requirement | Evidence | Result |
| --- | --- | --- |
| Slug generated, advanced override | Derived until edited; hidden unless advanced | Passed locally |
| Controlled category list of the eight sections | Read from the taxonomy, inactive excluded | Passed locally |
| Conditional price shape | Fixed, from, per month in the form; percentage and double advantage in the privileges | Passed locally |
| Booking mode drives the other fields | Duration and delivery both conditional | Passed locally |
| Duration genuinely empty for a contact formula | Payload asserts `durationMin: null` | Passed locally |
| Draft tolerates an incomplete presentation | Sparse create asserts null content and no locale row | Passed locally |
| Publication requires a complete presentation | `assertPublishable`, guarded by the repointed P1-04 | Passed |
| Order managed by moving | Whole-sequence reorder; ends disabled | Passed locally |
| Conditional delivery | *Nous contacter* writes the studio wording | Passed locally |
| `ADM-07b` in production: eight filters, FR and EN | Outstanding — needs deployment | Pending |
