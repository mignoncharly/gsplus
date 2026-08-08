import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const businessUiSources = [
  '../src/pages/AdminDashboard.jsx',
  '../src/components/AdminRescheduleRequestsPanel.jsx',
].map((path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

test('P1-03 removes every native business prompt, confirm and alert', () => {
  assert.doesNotMatch(businessUiSources, /window\.(?:prompt|confirm|alert)\s*\(/);
});

test('P1-03 exposes a reusable accessible action dialog contract', () => {
  const source = fs.readFileSync(new URL('../src/components/AdminActionDialog.jsx', import.meta.url), 'utf8');
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby=/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /focusableElements/);
  assert.match(source, /aria-busy=/);
});
