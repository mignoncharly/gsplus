> Legacy pre-remediation dashboard note. Superseded by `phase-8-media-pipeline-2026-07-24.md` for the July 2026 acceptance contract.

# Phase 8

Phase 8 connects the admin dashboard to live PostgreSQL data and removes the remaining dashboard mocks.

## Backend

Protected admin APIs now cover the dashboard data surface:

```text
GET    /api/admin/reservations
PATCH  /api/admin/reservations/:id
GET    /api/admin/leads
PATCH  /api/admin/leads/:id
GET    /api/admin/packages
PATCH  /api/admin/packages/:id
GET    /api/admin/media
POST   /api/admin/media
DELETE /api/admin/media/:id
GET    /api/admin/availability-blocks
POST   /api/admin/availability-blocks
DELETE /api/admin/availability-blocks/:id
PATCH  /api/admin/payments/:id/verify
POST   /api/admin/calendar/sync/:reservationId
```

Admin mutations write audit rows:

```text
reservation.update
lead.update
package.update
media.create
media.delete
availability_block.create
availability_block.delete
payment.verify
calendar.sync
```

Calendar sync creates a local sync log and now uses Cal.com as the active provider.

## Frontend

The admin dashboard now loads real data for:

```text
reservations
leads
packages
payment status
availability blocks
media items
```

Available admin actions:

```text
confirm/cancel reservation
mark payment verified/rejected
sync reservation to calendar queue
update lead status
update package price
block calendar time
add/delete portfolio media metadata
```

The overview metrics are computed from the live admin API responses.

## Verification

Validated locally:

```text
backend npm run build
frontend npm run lint
frontend npm run build
authenticated admin API probe
```

The API probe logged in with the seeded admin account, read all dashboard endpoints, created and deleted a temporary availability block, created and deleted a temporary media item, and confirmed four audit log rows were added.
