# Phase 9

> Legacy pre-remediation note. The authoritative July 2026 Phase 9 scope and completion evidence are in
> [Phase 9 report](phase-9-legal-editorial-2026-07-24.md). SMTP/outbox implementation was completed earlier under Phase 4.

Phase 9 adds free-first SMTP email notifications with PostgreSQL delivery logs.

## SMTP Configuration

The backend reads these variables:

```text
ADMIN_NOTIFICATION_EMAIL
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM
```

Local development leaves `SMTP_HOST` blank. In that mode, notification rows are still created and delivery attempts are marked:

```text
FAILED / SMTP_NOT_CONFIGURED
```

That avoids fake email success while keeping reservation and lead creation working.

## Email Events

Implemented notification types:

```text
booking_received_customer
booking_received_admin
booking_confirmed_customer
booking_rejected_customer
lead_created_admin
payment_verified_customer
```

Each event is stored in `NotificationEvent` with:

```text
channel
type
recipient
status
error
sentAt
```

## Trigger Points

Emails are queued and attempted from:

```text
POST  /api/reservations
POST  /api/contact
POST  /api/b2b-inquiries
POST  /api/quote-requests
PATCH /api/admin/reservations/:id
PATCH /api/admin/payments/:id/verify
```

Admin users can inspect recent notification logs at:

```text
GET /api/admin/notifications
```

The dashboard also includes an Emails tab showing recipient, type, status, and error.

## Verification

Validated locally:

```text
backend npm run build
public contact notification probe
admin notification log read
```

With SMTP intentionally unset, the probe created a lead notification and recorded `FAILED` with `SMTP_NOT_CONFIGURED`.
