# Phase 1

Phase 1 adds PostgreSQL persistence through Prisma.

## Database

Expected local connection:

```env
DATABASE_URL="postgresql://golden_user:password@127.0.0.1:5433/golden_studio?schema=public"
```

The local PostgreSQL install on this machine listens on `5433`, not `5432`.

## Commands

```bash
cd backend
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

The Prisma schema includes the planned core models:

```text
AdminUser, Customer, Package, Reservation, Payment, Lead,
AvailabilityBlock, BusinessHour, MediaItem, NotificationEvent,
AuditLog, CalendarSyncLog
```
