-- Persisted, private filter presets. Views contain only query parameters, never business records.
CREATE TABLE IF NOT EXISTS "AdminSavedView" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSavedView_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminSavedView_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminSavedView_adminUserId_scope_name_key" ON "AdminSavedView"("adminUserId", "scope", "name");
CREATE INDEX IF NOT EXISTS "AdminSavedView_adminUserId_scope_updatedAt_idx" ON "AdminSavedView"("adminUserId", "scope", "updatedAt");
