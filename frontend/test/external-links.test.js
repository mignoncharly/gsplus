import test from 'node:test';
import assert from 'node:assert/strict';
import { safeExternalHttpsUrl } from '../src/lib/external-links.js';

test('accepts configured HTTPS social links', () => {
  assert.equal(safeExternalHttpsUrl('https://www.instagram.com/goldenstudio'), 'https://www.instagram.com/goldenstudio');
});

test('rejects placeholders, relative links, insecure URLs and invalid values', () => {
  for (const value of [undefined, '', '#', '/instagram', 'http://example.com', 'javascript:alert(1)']) {
    assert.equal(safeExternalHttpsUrl(value), null);
  }
});
