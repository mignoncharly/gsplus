# Phase 7

Phase 7 replaces frontend-only admin authentication with backend sessions.

## Backend

Admin authentication is active:

```text
POST /api/admin/login
POST /api/admin/logout
GET  /api/admin/me
```

Login verifies `AdminUser.passwordHash` with bcrypt and returns an HttpOnly cookie:

```text
gsp_admin_session
```

Protected admin routes now require that cookie:

```text
/api/admin/reservations
/api/admin/leads
/api/admin/packages
/api/admin/media
/api/admin/payments/:id/verify
/api/admin/calendar/sync/:reservationId
```

Session settings:

```text
ADMIN_SESSION_SECRET
ADMIN_SESSION_TTL_SECONDS
```

## Frontend

The admin page now logs in through the backend API and checks the current session with:

```text
GET /api/admin/me
```

Routes available:

```text
/admin
/admin/login
/admin/dashboard
```

Removed from frontend code in this historical phase:

```text
frontend-only password check
React state-only auth
visible demo password
```

## Local Admin

The seed script uses:

```text
ADMIN_PASSWORD
```

The local development database has been reseeded so the previous demo password no longer works.
