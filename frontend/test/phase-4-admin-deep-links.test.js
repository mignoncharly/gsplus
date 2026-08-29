import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAdminDestination } from '../src/lib/admin-deep-links.js';

// Phase 2 of the administration plan extended the parser to resolve the view as well
// as the record, so the returned shape now carries `tab`. The Phase 4 guarantees below
// are unchanged: these URLs are embedded in delivered e-mails and Cal.com events.
const record = (destination) => ({ area: destination.area, reference: destination.reference });

test('Phase 4 parses stable authenticated admin destinations', () => {
  assert.deepEqual(record(parseAdminDestination('/admin/reservations/GSP-260820-ABCD')), { area: 'reservations', reference: 'GSP-260820-ABCD' });
  assert.deepEqual(record(parseAdminDestination('/admin/leads/B2B-260820-EFGH')), { area: 'leads', reference: 'B2B-260820-EFGH' });
  assert.deepEqual(record(parseAdminDestination('/admin/finance/task-123')), { area: 'finance', reference: 'task-123' });
  // A bare /admin addresses a view, not a record: there is nothing for the resolver to load.
  assert.equal(parseAdminDestination('/admin').area, null);
  assert.equal(parseAdminDestination('/admin').reference, null);
});

test('Phase 4 keeps historical query-string admin links usable', () => {
  assert.deepEqual(record(parseAdminDestination('/admin', '?reservation=reservation-id')), { area: 'reservations', reference: 'reservation-id' });
  assert.deepEqual(record(parseAdminDestination('/admin', '?lead=lead-id')), { area: 'leads', reference: 'lead-id' });
});

test('Phase 4 record links still select the view that shows the record', () => {
  assert.equal(parseAdminDestination('/admin/reservations/GSP-260820-ABCD').tab, 'reservations');
  assert.equal(parseAdminDestination('/admin/leads/B2B-260820-EFGH').tab, 'leads');
  assert.equal(parseAdminDestination('/admin/finance/task-123').tab, 'finance');
});
