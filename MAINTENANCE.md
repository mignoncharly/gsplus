# Golden Studio Plus — Production Runbook

## Paths And URLs

```text
Project: /var/www/goldenstudioplus
Frontend build: /var/www/goldenstudioplus/frontend/dist
Uploads: /var/www/goldenstudioplus/uploads
Backend service: goldenstudioplus-backend
Live site: https://gsplus.vip
API health: https://gsplus.vip/api/health
Calendar health: https://gsplus.vip/api/calendar/health
Admin: https://gsplus.vip/admin
```

## Deploy

```bash
cd /var/www/goldenstudioplus/frontend
npm install
npm run build

cd /var/www/goldenstudioplus/backend
npm install
npm run build
npx prisma migrate deploy
npx prisma generate

sudo systemctl restart goldenstudioplus-backend
sudo nginx -t
sudo systemctl reload nginx
```

## Test

```bash
cd /var/www/goldenstudioplus/backend
npm test

cd /var/www/goldenstudioplus/frontend
npm run build

curl https://gsplus.vip/api/health
curl https://gsplus.vip/api/calendar/health
sudo systemctl status goldenstudioplus-backend --no-pager -l
```

Expected API health:

```json
{"status":"ok","service":"golden-studio-plus-api"}
```

Expected calendar health should include:

```json
{"ok":true,"provider":"cal_com","eventTypeFound":true}
```

## Backup

Create a timestamped backup directory:

```bash
export BACKUP_DIR=/var/backups/goldenstudioplus/$(date +%Y%m%d-%H%M%S)
sudo mkdir -p "$BACKUP_DIR"
```

Back up PostgreSQL:

```bash
cd /var/www/goldenstudioplus/backend
source .env
pg_dump "$DATABASE_URL" | sudo tee "$BACKUP_DIR/database.sql" >/dev/null
```

Back up uploaded media and environment files:

```bash
sudo tar -czf "$BACKUP_DIR/uploads.tar.gz" -C /var/www/goldenstudioplus uploads
sudo cp /var/www/goldenstudioplus/backend/.env "$BACKUP_DIR/backend.env"
sudo cp /var/www/goldenstudioplus/frontend/.env "$BACKUP_DIR/frontend.env"
sudo chmod 600 "$BACKUP_DIR"/*
```

## Restore

Restore database:

```bash
cd /var/www/goldenstudioplus/backend
source .env
psql "$DATABASE_URL" < /var/backups/goldenstudioplus/<backup-id>/database.sql
```

Restore uploads:

```bash
sudo tar -xzf /var/backups/goldenstudioplus/<backup-id>/uploads.tar.gz -C /var/www/goldenstudioplus
sudo chown -R deploy:www-data /var/www/goldenstudioplus/uploads
```

Restart services:

```bash
sudo systemctl restart goldenstudioplus-backend
sudo systemctl reload nginx
```

## Rotate Credentials

Rotate secrets in `backend/.env`, then rebuild or restart as needed:

```text
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
SMTP_PASS
CALCOM_API_KEY
DATABASE_URL password
TURNSTILE_SECRET_KEY, if enabled
```

After changing `ADMIN_PASSWORD`, reseed the admin user:

```bash
cd /var/www/goldenstudioplus/backend
npm run db:seed
sudo systemctl restart goldenstudioplus-backend
```

After changing `CALCOM_API_KEY`, verify:

```bash
curl https://gsplus.vip/api/calendar/health
```
