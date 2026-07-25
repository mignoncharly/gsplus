# Phase 2

Phase 2 adds the Express API structure and Zod validation.

## Public API

```text
GET  /api/health
GET  /api/packages
GET  /api/availability
POST /api/reservations
POST /api/contact
POST /api/b2b-inquiries
POST /api/quote-requests
```

## Admin API

```text
POST   /api/admin/login
POST   /api/admin/logout
GET    /api/admin/me
GET    /api/admin/reservations
GET    /api/admin/reservations/:id
PATCH  /api/admin/reservations/:id
GET    /api/admin/leads
PATCH  /api/admin/leads/:id
GET    /api/admin/packages
PATCH  /api/admin/packages/:id
GET    /api/admin/media
POST   /api/admin/media
DELETE /api/admin/media/:id
PATCH  /api/admin/payments/:id/verify
POST   /api/admin/calendar/sync/:reservationId
```

Reservation creation and admin login are intentionally present but return `501` until their dedicated later phases add double-booking prevention and real authentication.
