import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { adminSubviewPath, parseAdminDestination } from '../src/lib/admin-deep-links.js';

const repoRoot = new URL('../../', import.meta.url);
const record = readFileSync(new URL('frontend/src/components/AdminReservationRecord.jsx', repoRoot), 'utf8');
const payments = readFileSync(new URL('backend/src/services/payments.ts', repoRoot), 'utf8');
const permissions = readFileSync(new URL('backend/src/services/admin-permissions.ts', repoRoot), 'utf8');
const routes = readFileSync(new URL('backend/src/routes/admin.ts', repoRoot), 'utf8');
const schema = readFileSync(new URL('backend/prisma/schema.prisma', repoRoot), 'utf8');

test('ADM-04 the financial module has two addressable sub-views', () => {
  assert.equal(parseAdminDestination('/admin/paiements').subview, 'verification');
  assert.equal(parseAdminDestination('/admin/paiements/verification').subview, 'verification');
  assert.equal(parseAdminDestination('/admin/paiements/remboursements').subview, 'remboursements');
  assert.equal(adminSubviewPath('finance', 'remboursements'), '/admin/paiements/remboursements');

  // A sub-view name must never be mistaken for a record identifier.
  assert.equal(parseAdminDestination('/admin/paiements/verification').reference, null);

  // The financial-task link printed in e-mails still resolves, and opens the refunds file.
  const task = parseAdminDestination('/admin/finance/task-123');
  assert.equal(task.area, 'finance');
  assert.equal(task.reference, 'task-123');
  assert.equal(task.subview, 'remboursements');
});

test('ADM-04 the expected amount and the declared amount are separate columns', () => {
  // Payment.amount is frozen from the package price; declaredAmount is what the studio
  // observed. Backfilling one from the other would invent a comparison.
  assert.match(schema, /declaredAmount\s+Int\?/);
  assert.match(schema, /duplicateOfPaymentId\s+String\?/);

  const migration = readFileSync(
    new URL('backend/prisma/migrations/20260829120000_admin_phase_3_payment_verification/migration.sql', repoRoot),
    'utf8',
  );
  assert.match(migration, /ADD COLUMN "declaredAmount" INTEGER/);
  assert.doesNotMatch(migration, /UPDATE "Payment"\s+SET "declaredAmount"/, 'declaredAmount must not be backfilled from amount');
});

test('ADM-04 an unrecorded amount is never presented as a matching amount', () => {
  assert.match(payments, /payment\.declaredAmount === null \|\| payment\.declaredAmount === undefined\s*\?\s*null/);
  // The record shows the absence explicitly rather than a zero or a false match.
  assert.match(record, /declaredAmount === null \? 'Non renseigné'/);
  assert.doesNotMatch(record, /const declaredAmount = payment\?\.amount/, 'the expected amount must not be relabelled as declared');
});

test('ADM-04 staff may read the queue while every money decision stays with the owner', () => {
  assert.match(permissions, /'PAYMENT_VIEW'/);
  assert.match(permissions, /\[AdminRole\.STAFF\]: new Set<AdminPermission>\(\['RESERVATION_CLOSE', 'PAYMENT_VIEW'\]\)/);

  // Reads use PAYMENT_VIEW; the export and both annotations use PAYMENT_DECIDE.
  const listRoute = /'\/payments',[\s\S]{0,300}?assertAdminPermission\(res\.locals\.admin, '([A-Z_]+)'\)/.exec(routes);
  assert.equal(listRoute?.[1], 'PAYMENT_VIEW');
  const exportRoute = /'\/payments\/export\.csv',[\s\S]{0,400}?assertAdminPermission\(admin, '([A-Z_]+)'\)/.exec(routes);
  assert.equal(exportRoute?.[1], 'PAYMENT_DECIDE');
});

test('ADM-04 the export is audited and neutralises spreadsheet formulas', () => {
  assert.match(routes, /writeAuditLog\(admin\?\.id, 'payment\.export'/);
  assert.match(routes, /writeAuditLog\(admin\?\.id, 'financial_task\.export'/);
  assert.match(payments, /\/\^\[=\+\\-@\\t\\r\]\/\.test\(cell\)/);
});

test('ADM-04 the report’s payment vocabulary is used in the order the report gives', () => {
  const listed = /PAYMENT_VERIFICATION_STATUSES = \[([\s\S]*?)\] as const;/.exec(payments)?.[1] ?? '';
  const order = [...listed.matchAll(/PaymentStatus\.([A-Z_]+)/g)].map((m) => m[1]);
  assert.deepEqual(order, ['PENDING', 'PAYMENT_INFO_REQUIRED', 'VERIFICATION_BLOCKED', 'VERIFIED', 'REJECTED']);
});
