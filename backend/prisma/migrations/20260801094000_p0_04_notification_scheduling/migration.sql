-- P0-04: a delayed payment-verification notice can be cancelled by confirmation.
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'CANCELLED' AFTER 'FAILED';
