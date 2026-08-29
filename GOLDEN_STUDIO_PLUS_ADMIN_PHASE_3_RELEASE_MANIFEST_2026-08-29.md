# Golden Studio Plus — Admin analysis Phase 3 release manifest

**Release date:** 29 August 2026
**Branch:** `codex/phase7-external-acceptance-20260821`
**Plan:** `GOLDEN_STUDIO_PLUS_ADMIN_ANALYSIS_IMPLEMENTATION_PLAN_2026-08-29.md`, Phase 3
**Finding:** `ADM-04` — *Absence de module financier central* (**P0**)
**Status:** complete and deployed to production

## The design decision the plan asked to record

The plan left one question open: whether to add `declaredAmount` or an explicit `expectedAmount`. Reading the code
settled it.

`Payment.amount` is written from `packageVersion.price` when a customer books, and from
`reservation.snapshot.amount` when an administrator adds a payment. **It is the expected amount.** The customer never
enters a figure — they enter a transaction reference and a payer phone. So the report's *"montant attendu/déclaré"*
comparison had no second term at all: there was nothing to compare against.

Therefore:

- `Payment.amount` keeps its meaning and its name. Renaming a money column in production buys nothing and risks
  everything.
- `declaredAmount Int?` is genuinely new: what the studio observed on the operator statement, recorded by an
  administrator. **It is nullable and is never backfilled from `amount`.** A null means "nobody has checked yet",
  which is the truth for every existing row, and the interface says exactly that rather than showing a false match.

**This also corrects a mistake shipped in Phase 2.** The reservation record displayed `payment.amount` under the
label *"Montant déclaré"* beside `snapshot.amount` as *"Montant attendu"*. Both derive from the same package price,
so the comparison was vacuous and the mismatch chip could never fire — which is exactly what the production check
showed. The record now reads *Montant attendu* against *Montant reçu*, with **Non renseigné** when nothing has been
recorded.

## Schema

Migration `20260829120000_admin_phase_3_payment_verification`:

| Change | Purpose |
| --- | --- |
| `Payment.declaredAmount INTEGER NULL` | The amount actually observed, never derived |
| `Payment.duplicateOfPaymentId TEXT NULL` + FK + index | Link a duplicate to its original |
| `Payment_transactionRefNormalized_idx` | Free-text search on the normalised code |
| `Payment_status_createdAt_idx` | The queue's default ordering |

Additive only: no column dropped, no value rewritten, no data migrated. `FinancialTask` is untouched, as the plan
required.

## Backend

- `GET /admin/payments` — the verification queue. Filters on status, operator, open-only, amount mismatch,
  duplicate-flagged and date range; free-text search across transaction code, normalised code, payer phone,
  reservation reference and customer name — over **both** the live customer row and the frozen snapshot, since the
  two can drift. Returns `{ total, limit, offset }`.
- `GET /admin/payments/:id` and `GET /admin/payments/:id/duplicates`.
- `PATCH /admin/payments/:id/declared-amount` — optimistic-version guarded and audited. It annotates the payment and
  **never touches the verification status machine**.
- `PATCH /admin/payments/:id/duplicate` — links or unlinks, refusing a self-reference and refusing a chain so a pair
  always resolves to one original.
- `GET /admin/payments/export.csv` and `GET /admin/financial-tasks/export.csv` — both audited.
- `paymentAmountVariance()` returns **null** for an unrecorded amount and **0** for one that agrees. The distinction
  is the whole point: an unchecked payment must never be presented as a reconciled one.

### Duplicate detection

The unique index on `(method, transactionRefNormalized)` already refused an exact re-use on one operator, but it
only ever *refused* — it never showed the pair. `findDuplicateCandidates` surfaces the near misses it cannot see:
the same normalised reference on another operator, or the same payer phone and expected amount on the same day.

### Permissions — a deliberate narrowing of the plan

The plan said to gate the queue on `PAYMENT_DECIDE` "so STAFF can triage". Reading `admin-permissions.ts` showed
STAFF holds only `RESERVATION_CLOSE`, so that gate would still have excluded them, and granting STAFF
`PAYMENT_DECIDE` would hand them authority over money decisions.

A new **`PAYMENT_VIEW`** permission is granted to OWNER and STAFF and gates the reads. Every decision, annotation,
export and refund stays on `PAYMENT_DECIDE` / `REFUND_MANAGE`, which remain OWNER-only. Staff can triage; nobody
gained authority over money. **Widening who may decide on payments is a governance change and belongs to Phase 10.**

## Frontend

- The tab is now **Paiements**, reachable by every role, and the module carries the report's title
  *Paiements & remboursements*.
- Two addressable files: `/admin/paiements/verification` and `/admin/paiements/remboursements`, both reload-stable.
  `/admin/paiements` opens verification. The financial-task link printed in delivered e-mails,
  `/admin/finance/:id`, still resolves and now opens the **refunds** file, since a financial task is a refund.
- The verification queue shows reservation, client, operator, transaction code, expected against received with an
  explicit variance, both statuses, age in days, and the decision actions. A row with a real variance is tinted.
- Duplicate candidates expand inline with a *Marquer doublon* action.
- Audited CSV export on both files.
- Staff opening the refunds file get a plain explanation instead of an empty screen.
- **All three actions stay distinct**, as the report requires: *Vérifier et confirmer*, *Vérifier le paiement* and
  *Confirmer la réservation* are unchanged in the reservation record.

## Verification evidence

- Backend suite: **197 passed, 0 failed across 27 files** (188 before, plus 9 new).
- Frontend unit suite: **124 passed, 0 failed** (118 before, plus 6 new).
- New browser suite: **10 passed** across Chromium and WebKit.
- Full local Chromium regression: **98 passed, 0 failed** (93 before, plus 5 new). One failure on the first run was
  the Phase 2 §3.1 spec, which encoded the amount mislabelling this phase corrects; its fixture now carries a real
  `declaredAmount` so the variance it asserts is a genuine one.
- Backend TypeScript build and frontend lint: clean.
- Migration applied to the test database by the suite's own setup; 37 migrations, none pending.
- Full `npm run build` into a scratch directory: budgets passed, tracker audit passed, production `dist` untouched.

### Performance

| Budget | Phase 2 | Phase 3 | Limit |
| --- | --- | --- | --- |
| `privateAdminChunkBytes` | 52,635 | 52,741 | 64,000 |
| `privateAdminCssBytes` | 22,027 | 22,882 | 24,000 |
| `publicCssBytes` | 66,576 | **66,576** | 68,000 |
| entry JS | 269,895 | 269,895 | 400,000 |

Admin CSS is now within 1,118 bytes of its limit. Phase 4 should extract admin styles per panel rather than raise it.

## Corrections found by this phase's own tests

1. The CSV assertion initially ignored RFC 4180 quoting; the test was wrong, not the export.
2. The finance view was still gated on `role === 'OWNER'` at the render site, which would have hidden the whole
   module from staff regardless of the new permission. The guard moved into the refunds file where it belongs.
3. A French agreement error in a test regex (*réservées* for the masculine *remboursements*).

## Exit gate

| Requirement | Evidence | Result |
| --- | --- | --- |
| *"Tout paiement ou remboursement est retrouvable"* | Free-text search over code, phone, reference and name, across live and frozen contact data | Passed locally |
| *"…possède un état, un historique, un responsable et une référence d'exécution"* | Status, transitions, `verifiedBy`, and the refund proof block unchanged | Passed locally |
| Expected against declared amount | Separate columns; unrecorded shown as *Non renseigné*, never as a match | Passed locally |
| Duplicate detection surfaced | Candidate search plus an explicit link, audited | Passed locally |
| Export | Audited CSV on both files, formula injection neutralised | Passed locally |
| All three payment actions kept distinct | Reservation record untouched | Passed |
| Production replay | Signed in 29 August 2026: both files work on real data, search reaches a decided payment, export returns 200, and the record states the absence of a recorded amount | Passed |

## Deployment — partially applied, 29 August 2026

**Done**

- Database dumped to `.phase-admin1-backups/goldenstudioplus_db-pre-admin-phase3.dump` (351 KB, custom format), and
  both `frontend/dist` and `backend/dist` copied beside it for rollback.
- `prisma migrate deploy` applied `20260829120000_admin_phase_3_payment_verification`. Verified afterwards:
  `declaredAmount` and `duplicateOfPaymentId` exist and are nullable, and of **32 payments, 0 have a
  `declaredAmount`** — nothing was backfilled, exactly as designed.
- `backend/` rebuilt with `tsc`; the new `dist` is on disk.
- Production remained healthy throughout: `/api/health`, `/` and `/admin` all 200.

**Restart**

`systemctl restart` needed privileges this session does not hold. The owner ran it. Killing the process to exploit
`Restart=always` would have routed around an access control that was not granted, so it was not done; the frontend
was held back in the meantime, because shipping it first would have given the administration a verification queue
calling endpoints the running process did not serve.

Service restarted at 16:00:41 UTC, PID 1720937 → 3072131. Verified authenticated: `/api/admin/payments` 200,
both `export.csv` routes 200, and an unknown admin route 404 — so the new routes really are being served rather than
being masked by the authentication layer.

**Frontend**

Rebuilt and deployed after the restart. Live entry verified by SHA-256, served against local. `/admin/paiements`,
`/admin/paiements/verification` and `/admin/paiements/remboursements` all resolve.

**Rollback**, if ever needed: restore `backend-dist-pre-admin-phase3` and restart. The schema change is additive and
needs no reversal; the dump exists only as a precaution.


## Production replay, 29 August 2026 — and a defect it caught

Signed in to `https://gsplus.vip/admin` with the owner's credentials.

- The verification file lists **10 payments awaiting a decision**; the refunds file lists **7 obligations**. Both
  addresses survive a reload.
- All 10 read *"Reçu : non renseigné"* and **no row is flagged with a variance** — correct, because nothing has been
  reconciled yet. The module states the absence instead of inventing a match.
- The audited CSV export returns 200 with the `expected_amount, declared_amount, variance` columns.
- The reservation record shows *Montant attendu* against *Montant reçu* with *Non renseigné*, confirming the Phase 2
  mislabelling is gone from production.

**A defect the replay caught.** Searching for a real transaction code returned **nothing**. The backend was right —
the same query without filters returned exactly one row — but the queue defaults to *"À décider uniquement"*, and
that silently excluded the payment because it had already been decided. Of the 32 payments in production only 10 are
pending, so a search would have missed two thirds of the history while appearing to work.

The report's criterion is *"Tout paiement ou remboursement est retrouvable"*, and a search that hides matches does
not meet it. A free-text search now spans the whole history: the open-only restriction is dropped when a search term
is present, and the checkbox visibly unchecks so the displayed state stays truthful. A regression test asserts that
a search reaches a payment the default filter would hide, and that the request carries no `open=true`.

After redeploying, the same search returns its one row.
