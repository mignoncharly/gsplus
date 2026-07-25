# Phase 5

Phase 5 enables real reservation creation with server-side double-booking prevention.

## Backend

Reservation creation is active:

```text
POST /api/reservations
```

The backend now:

```text
validates request input with Zod
loads the selected active package
calculates endAt from package duration
checks business hours
checks availability blocks
checks overlapping reservations inside a serializable transaction
creates or updates the customer record
creates the reservation
creates a pending payment record when a transaction reference is submitted
returns the reservation reference
```

Blocking reservation statuses in the current schema are:

```text
PENDING
PAYMENT_PENDING
CONFIRMED
```

The overlap rule is:

```text
existing.startAt < newEndAt
AND existing.endAt > newStartAt
AND existing.status IN blockingStatuses
```

## Frontend

The reservation success screen now appears only after the API accepts the reservation.

The payment/devis step calls:

```text
POST /api/reservations
```

If the selected slot was taken after the availability screen loaded, the backend returns a conflict and the customer stays on the payment step.
