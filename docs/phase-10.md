# Phase 10

Phase 10 completes the manual payment verification flow.

## Customer Submission

The reservation form now captures:

```text
payment method
payment phone number
transaction reference
```

Supported method values:

```text
mtn_momo
orange_money
```

Payment details are stored on `Payment`:

```text
method
paymentPhone
transactionRef
status
verifiedAt
```

The database migration adds:

```text
Payment.paymentPhone
```

## Status Mapping

The current schema uses existing enum names:

```text
Reservation PAYMENT_PENDING = awaiting manual verification / pending payment follow-up
Payment PENDING = submitted by customer, awaiting admin verification
Payment VERIFIED = accepted by admin
Payment REJECTED = rejected by admin
```

## Admin Verification

Admin payment verification updates payment and reservation together in one transaction:

```text
Payment VERIFIED  -> Reservation CONFIRMED
Payment REJECTED  -> Reservation PAYMENT_PENDING
```

Verification writes an audit log:

```text
payment.verify
```

When a payment is verified, the customer payment confirmation notification is queued through the Phase 9 email system.

## Verification

Validated locally:

```text
npx prisma migrate deploy
npx prisma generate
backend npm run build
frontend npm run lint
frontend npm run build
reservation/payment verification API probe
```

The probe created a temporary paid reservation, verified its payment through the admin API, confirmed `paymentPhone`, `method`, and `transactionRef` were stored, confirmed the reservation moved to `CONFIRMED`, and then cleaned up the probe rows.
