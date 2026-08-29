import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import {
  NOTIFICATION_AUDIENCE_LABELS,
  NOTIFICATION_TYPE_LABELS,
  STATUS_LABELS,
  notificationTypeDescriptor,
  notificationTypeLabel,
  statusLabel,
} from '../src/lib/status-labels.js';

const repoRoot = new URL('../../', import.meta.url);
const backendSrc = new URL('backend/src/', repoRoot);
const schemaPath = new URL('backend/prisma/schema.prisma', repoRoot);

const readAllBackendSources = () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
      // The generated Prisma client is machine output, not a source of message codes.
      if (entry.isDirectory()) {
        if (entry.name !== 'generated') walk(child);
      } else if (entry.name.endsWith('.ts')) {
        files.push(readFileSync(child, 'utf8'));
      }
    }
  };
  walk(backendSrc);
  return files.join('\n');
};

const enumMembers = (schema, name) => {
  const block = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema);
  assert.ok(block, `enum ${name} must exist in schema.prisma`);
  return block[1].split('\n').map((line) => line.trim()).filter(Boolean);
};

test('ADM-07/ADM-08 every status enum member resolves to a business label', () => {
  const schema = readFileSync(schemaPath, 'utf8');
  const enums = [
    'ReservationStatus',
    'PaymentStatus',
    'LeadStatus',
    'NotificationStatus',
    'PackageVersionStatus',
    'AdminRole',
  ];

  const missing = [];
  for (const name of enums) {
    for (const member of enumMembers(schema, name)) {
      if (!STATUS_LABELS[member]) missing.push(`${name}.${member}`);
    }
  }

  assert.deepEqual(missing, [], `these enum members would render "Statut non reconnu": ${missing.join(', ')}`);
});

test('ADM-08 every queued notification type has a business name, audience and trigger', () => {
  const sources = readAllBackendSources();
  // NotificationEvent.type values are queued as `type: 'snake_case_code'`.
  const queued = new Set(
    [...sources.matchAll(/\btype:\s*'([a-z][a-z0-9]*(?:_[a-z0-9]+)+)'/g)].map((match) => match[1]),
  );
  // Not outbox codes: an OAuth grant type and WhatsApp payload component types.
  for (const notACode of ['refresh_token']) queued.delete(notACode);

  assert.ok(queued.size >= 21, `expected the outbox codes to be discovered, found ${queued.size}`);

  const missing = [...queued].filter((code) => !NOTIFICATION_TYPE_LABELS[code]).sort();
  assert.deepEqual(missing, [], `notification types absent from NOTIFICATION_TYPE_LABELS: ${missing.join(', ')}`);

  for (const [code, entry] of Object.entries(NOTIFICATION_TYPE_LABELS)) {
    assert.ok(entry.name && entry.name.trim(), `${code} needs a business name`);
    assert.ok(entry.trigger && entry.trigger.trim(), `${code} needs a trigger description`);
    assert.ok(NOTIFICATION_AUDIENCE_LABELS[entry.audience], `${code} needs a known audience, got ${entry.audience}`);
    assert.doesNotMatch(entry.name, /_/, `${code} business name must not be a raw code`);
  }
});

test('ADM-08 notification types never fall through to the status vocabulary', () => {
  for (const code of Object.keys(NOTIFICATION_TYPE_LABELS)) {
    assert.notEqual(notificationTypeLabel(code), 'Statut non reconnu');
    assert.equal(statusLabel(code), 'Statut non reconnu', `${code} is not a status and must not be one`);
  }

  // An unregistered code degrades to something readable, never to the status fallback.
  const unknown = notificationTypeDescriptor('brand_new_message_customer');
  assert.equal(unknown.isRegistered, false);
  assert.equal(unknown.name, 'Brand new message customer');
  assert.equal(unknown.audience, 'CLIENT');
  assert.notEqual(unknown.name, 'Statut non reconnu');

  assert.equal(notificationTypeDescriptor('').name, '—');
  assert.equal(Object.isFrozen(NOTIFICATION_TYPE_LABELS), true);
});

test('ADM-07 the reference count no longer travels through the status formatter', () => {
  const panel = readFileSync(new URL('../src/components/AdminPackagesPanel.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(panel, /pill\(`\$\{packageReferenceCount/, 'the count must not be rendered as a status pill');
  assert.match(panel, /countChip\(packageReferenceCount\(pack\)\)/);
  assert.match(panel, /admin-pill--count/);

  // Exactly one status pill per card: the publication status.
  const cardRow = /admin-pill--count/.exec(panel);
  assert.ok(cardRow, 'the neutral count chip must be rendered');
});

test('ADM-08 the journal renders the business name, not the raw outbox code', () => {
  const dashboard = readFileSync(new URL('../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(dashboard, /statusLabel\(item\.type\)/, 'item.type is not a status');
  assert.match(dashboard, /notificationTypeDescriptor\(item\.type\)/);
  assert.match(dashboard, /messageType\.name/);
  assert.match(dashboard, /NOTIFICATION_AUDIENCE_LABELS\[messageType\.audience\]/);
  // The template code stays available as secondary technical detail.
  assert.match(dashboard, /Modèle \{item\.templateCode\}/);
});
