# Phase 3

Phase 3 makes PostgreSQL the source of truth for package and pricing data.

## Backend

Package routes are active:

```text
GET   /api/packages
GET   /api/admin/packages
PATCH /api/admin/packages/:id
```

## Frontend

These screens now load package data from the backend:

```text
Reservation
Services
Home package cards
Admin dashboard tariff editor
```

Admin price edits call `PATCH /api/admin/packages/:id` and persist to PostgreSQL.
