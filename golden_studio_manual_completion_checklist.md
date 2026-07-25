# Golden Studio Plus — Manual Completion Checklist

Use this checklist to make the implemented phases 100% complete manually.

---

## Backend Setup

### 1. Confirm production environment variables

In `backend/.env`, confirm these values are set for your real environment:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
DATABASE_URL="postgresql://..."
CLIENT_ORIGIN=https://gsplus.vip
CORS_ORIGINS=https://gsplus.vip,https://www.gsplus.vip
ADMIN_SESSION_SECRET=long-random-secret
ADMIN_PASSWORD=strong-admin-password
TRUST_PROXY=true
UPLOAD_DIR=/var/www/goldenstudioplus/uploads
UPLOAD_PUBLIC_PATH=/uploads
CALCOM_API_KEY=cal_live_...
CALCOM_EVENT_TYPE_ID=5733625
CALCOM_TIME_ZONE=Africa/Douala
```

### 2. Apply database migrations on the server

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### 3. Seed or create the first admin user

```bash
npm run db:seed
```

Make sure `ADMIN_PASSWORD` is set before seeding.

---

## Phase 11 — Security

Completed and production-verified on 2026-07-24. See `docs/phase-11-security-hardening-2026-07-24.md`.

- The backend is bound to `127.0.0.1`; `TRUST_PROXY=true` is valid only behind the local Nginx boundary.
- Canonical CORS origins are the apex and www HTTPS origins only.
- Security headers/CSP, secure admin sessions, authenticated logout revocation, safe errors, private media boundaries and read-only static locations are enforced.
- Honeypot protection is enabled on every public write form.
- Turnstile remains optional and disabled until verified credentials are supplied.
- Continue monitoring the enforced limits after real traffic starts:
  - General API: `300 requests / 15 min`
  - Public forms: `20 requests / 10 min`
  - Admin login: `5 failed attempts / 15 min`

---

## Owner-authorized activation — 2026-07-24

- Zoho EU SMTP is enabled through `smtp.zoho.eu`; authentication, a labeled delivery test, backend tests/build and the live service restart all passed.
- All 17 owner-approved portfolio images and 34 responsive WebP derivatives are live; private sources remain private.
- Verified Hetzner hosting particulars are published on `/mentions-legales`.
- WhatsApp Business, official social URLs, optional Turnstile and Golden Studio Plus legal particulars remain explicitly deferred.
- Frontend Node tests pass 28/28, the local legal suite passes 6/6, and production Phase 8–11 browser checks pass 20/20 across Chromium and WebKit.
- The installed `6.8.0-136-generic` kernel still requires the authorized reboot and post-reboot service verification.

---

## Phase 12 — Media Uploads

### 1. Create the upload directory on the server

```bash
sudo mkdir -p /var/www/goldenstudioplus/uploads/portfolio
sudo chown -R deploy:www-data /var/www/goldenstudioplus/uploads
```

### 2. Configure Nginx to serve uploads

```nginx
location /uploads/ {
    alias /var/www/goldenstudioplus/uploads/;
    access_log off;
    expires 30d;
}
```

### 3. Back up uploaded media

Back up this directory:

```text
/var/www/goldenstudioplus/uploads
```

Do not back up only PostgreSQL. Images are stored on disk; only metadata is stored in the database.

---

## Phase 13 — Cal.com Calendar Sync

Cal.com is the only active calendar provider. Confirm these values in `backend/.env`:

```env
CALCOM_API_BASE_URL="https://api.cal.com/v2"
CALCOM_API_KEY="cal_live_..."
CALCOM_EVENT_TYPE_ID="5733625"
CALCOM_TIME_ZONE="Africa/Douala"
```

### Manual checks

1. Confirm `/api/calendar/health` returns `ok: true`.
2. Test by confirming a reservation in the admin dashboard.
3. Check that `CalendarSyncLog` shows `synced` or `updated` with provider `cal_com`.
4. Confirm the booking appears in Cal.com.

If Cal.com is not configured, sync logs `skipped`. If Cal.com rejects a booking, sync logs `failed`.

---

## Phase 14 — Tests

### Local backend testing

```bash
cd backend
npm test
```

The tests use `golden_studio_test` by default. If needed, configure:

```env
TEST_DATABASE_URL="postgresql://golden_user:password@127.0.0.1:5433/golden_studio_test?schema=public"
```

### Run before deployment

```bash
npm run build --prefix backend
npm run build --prefix frontend
npm run test:backend
```

---

## Production Frontend

Set the frontend API URL before building:

```env
VITE_API_URL=https://gsplus.vip
```

Then build the frontend:

```bash
cd frontend
npm run build
```

Deploy:

```text
frontend/dist
```

---

## Remaining Important Manual Checks

- Verify admin login works with the seeded password.
- Upload one portfolio image from admin and confirm it appears on `/portfolio`.
- Create a test reservation and confirm double-booking prevention.
- Verify payment from admin and confirm the reservation becomes `CONFIRMED`.
- Confirm `/api/calendar/health` returns `ok: true`.
- After Cal.com setup, confirm the booking appears in Cal.com.
- Run this command periodically:

```bash
npm audit --audit-level=moderate
```

Current moderate advisories come through Prisma’s transitive dependency, and npm’s suggested force fix is breaking, so do not apply it blindly.
