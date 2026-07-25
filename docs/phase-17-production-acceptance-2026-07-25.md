# Phase 17 — Controlled production acceptance

Date: 2026-07-25 UTC
QA run: `QA-GSP-20260725-002`
Status: COMPLETE for every safely executable non-payment flow; genuine payment/calendar lifecycle externally gated

## Real production run

The guarded runner used headless Chromium against `https://gsplus.vip` and the real public UI. It does not print, rotate, or replace credentials and refuses execution without `--execute-production`.

Verified behavior:

- Availability block create closed the public slot.
- Editing the block reopened the original slot and closed the new slot.
- Deleting it reopened the new slot.
- A browser reservation was submitted 7–14 days ahead.
- Repeating the exact reservation request returned the same reservation.
- A second intent for the occupied slot returned HTTP 409.
- General contact, B2B, and creative quote were each submitted through their real production forms.
- Repeating each exact submission key returned the same lead.
- The same server reference was retained in the response and browser confirmation.
- UTC and `Africa/Douala` representations were recorded in the protected manifest.

The first runner process exited after all submissions because its expected creative success phrase was stale (`Demande bien reçue` instead of the actual `Demande envoyée`). This was a harness-only false failure. Its `finally` cleanup executed. The assertion was corrected, and a separate database reconciliation proved every terminal condition below.

## Payment safety

The QA payment reference was explicitly synthetic:

- Exactly one payment record was created in `PENDING`.
- It was never transitioned to `VERIFIED`.
- Cleanup transitioned it to `REJECTED` with the reason that it was synthetic and never provider-verified.
- The reservation was then cancelled.

This proves that a fabricated reference is not represented as a genuine payment. Genuine production verification still requires an operator sandbox transaction or an owner-authorized real mobile-money transaction.

## Cleanup reconciliation

Protected evidence: `private-media/qa-evidence/QA-GSP-20260725-002.json` (mode 0600).

Final state:

- Reservation `cms0h9x2a0006cmuuc7alibi5`: `CANCELLED`.
- Payment `cms0h9x2f0008cmuu4wnqf8a7`: `REJECTED`; no `VERIFIED` transition.
- One CONTACT, one B2B and one QUOTE lead: all `ARCHIVED`.
- Six intended e-mail events: all `SENT`, attempt count 1, provider status `accepted`.
- Global pending/processing notification count: 0.
- Temporary QA availability block count: 0.
- External QA calendar event count: 0.
- Cancellation calendar action: recorded as `SKIPPED` because no external event existed.
- Reservation, payment, transition, notification, calendar and audit records were retained.

## External gates

- Human receipt in the configured inbox: owner confirmation required.
- Genuine payment verification: operator sandbox or owner-authorized real transaction required.
- Cal.com create/update/delete proof after legitimate payment: depends on that genuine payment.
- WhatsApp and legal-company particulars: deferred by owner.
