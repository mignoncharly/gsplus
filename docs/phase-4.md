# Phase 4

Phase 4 replaces browser-generated availability with backend-calculated slots.

## Backend

Availability is served by:

```text
GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD&packageId=<id>
```

The API calculates 30-minute start slots using:

```text
business_hours
availability_blocks
blocking reservations
selected package duration
```

Blocking reservation statuses in the current schema are:

```text
PENDING
PAYMENT_PENDING
CONFIRMED
```

`COMPLETED`, `CANCELLED`, and `NO_SHOW` do not block availability.

## Frontend

The reservation screen now loads availability from the backend for the selected package.

Removed from the browser:

```text
Math.random()
generateBookedSlots()
client-only conflict simulation
```
