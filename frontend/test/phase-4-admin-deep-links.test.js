import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAdminDestination } from '../src/lib/admin-deep-links.js';

test('Phase 4 parses stable authenticated admin destinations', () => {
  assert.deepEqual(parseAdminDestination('/admin/reservations/GSP-260820-ABCD'), { area: 'reservations', reference: 'GSP-260820-ABCD' });
  assert.deepEqual(parseAdminDestination('/admin/leads/B2B-260820-EFGH'), { area: 'leads', reference: 'B2B-260820-EFGH' });
  assert.deepEqual(parseAdminDestination('/admin/finance/task-123'), { area: 'finance', reference: 'task-123' });
  assert.equal(parseAdminDestination('/admin'), null);
});

test('Phase 4 keeps historical query-string admin links usable', () => {
  assert.deepEqual(parseAdminDestination('/admin', '?reservation=reservation-id'), { area: 'reservations', reference: 'reservation-id' });
  assert.deepEqual(parseAdminDestination('/admin', '?lead=lead-id'), { area: 'leads', reference: 'lead-id' });
});
