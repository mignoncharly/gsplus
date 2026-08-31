-- §12: governance and security.
--
-- Additive only. Every column is nullable and every table is new, so the running server
-- is unaffected until the code that reads them is deployed.

ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "invitationTokenHash" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "invitationExpiresAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "invitedById" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "totpSecretEncrypted" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "totpConfirmedAt" TIMESTAMP(3);
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "lastSignInAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_invitationTokenHash_key" ON "AdminUser"("invitationTokenHash");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminUser_invitedById_fkey') THEN
    ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_invitedById_fkey"
      FOREIGN KEY ("invitedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- The accounts that exist predate invitations; they were never invited, they were seeded,
-- and they are already in use. Marking them activated says that plainly rather than
-- leaving them looking like invitations nobody ever accepted.
UPDATE "AdminUser" SET "activatedAt" = "createdAt" WHERE "activatedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "AdminPermissionGrant" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "grantedById" TEXT,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminPermissionGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminPermissionGrant_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdminPermissionGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminPermissionGrant_adminUserId_permission_key" ON "AdminPermissionGrant"("adminUserId", "permission");
CREATE INDEX IF NOT EXISTS "AdminPermissionGrant_grantedById_idx" ON "AdminPermissionGrant"("grantedById");

CREATE TABLE IF NOT EXISTS "AdminSession" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "revokedReason" TEXT,
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdminSession_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AdminSession_adminUserId_revokedAt_idx" ON "AdminSession"("adminUserId", "revokedAt");
CREATE INDEX IF NOT EXISTS "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
CREATE INDEX IF NOT EXISTS "AdminSession_revokedById_idx" ON "AdminSession"("revokedById");

CREATE TABLE IF NOT EXISTS "AdminRecoveryCode" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminRecoveryCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminRecoveryCode_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AdminRecoveryCode_adminUserId_usedAt_idx" ON "AdminRecoveryCode"("adminUserId", "usedAt");

CREATE TABLE IF NOT EXISTS "AdminSignInAttempt" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "succeeded" BOOLEAN NOT NULL,
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSignInAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminSignInAttempt_email_createdAt_idx" ON "AdminSignInAttempt"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminSignInAttempt_createdAt_idx" ON "AdminSignInAttempt"("createdAt");
