# Phase 6

Phase 6 connects public lead forms to PostgreSQL-backed API endpoints.

## Backend

These endpoints are active:

```text
POST /api/contact
POST /api/b2b-inquiries
POST /api/quote-requests
```

Each endpoint:

```text
validates input with Zod
stores a lead in PostgreSQL
creates a pending email notification event
returns the stored lead
```

SMTP delivery is still reserved for Phase 9. This phase creates `NotificationEvent` rows with `PENDING` status so the later email worker has durable work to send.

## Frontend

These forms now submit to the backend before showing success:

```text
Contact page
Corporate/B2B page
Creative services quote page
Services page quote forms
```

## Admin

The admin lead panel now loads real leads from:

```text
GET /api/admin/leads
```

New contact, B2B, and quote requests appear in the admin dashboard data instead of only local mock state.
