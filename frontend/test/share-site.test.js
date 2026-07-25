import assert from 'node:assert/strict';
import test from 'node:test';
import { getShareData, shareSite } from '../src/lib/share-site.js';

const documentFixture = () => ({
  title: 'Golden Studio Plus | Studio photo premium à Douala',
  querySelector(selector) {
    if (selector === 'link[rel="canonical"]') return { href: 'https://gsplus.vip/services' };
    if (selector === 'meta[name="description"]') return { content: 'Description Golden Studio Plus.' };
    return null;
  },
});

test('share data uses the canonical URL, route title and description', () => {
  assert.deepEqual(getShareData({
    documentRef: documentFixture(),
    locationRef: { href: 'https://gsplus.vip/services?tracking=1' },
  }), {
    title: 'Golden Studio Plus | Studio photo premium à Douala',
    text: 'Description Golden Studio Plus.',
    url: 'https://gsplus.vip/services',
  });
});

test('native sharing receives the canonical page data', async () => {
  let shared;
  const result = await shareSite({
    navigatorRef: { share: async (data) => { shared = data; } },
    documentRef: documentFixture(),
    locationRef: { href: 'https://gsplus.vip/services?tracking=1' },
  });

  assert.equal(result.status, 'shared');
  assert.equal(shared.url, 'https://gsplus.vip/services');
});

test('clipboard fallback copies the canonical URL when native sharing is unavailable', async () => {
  let copied;
  const result = await shareSite({
    navigatorRef: { clipboard: { writeText: async (value) => { copied = value; } } },
    documentRef: documentFixture(),
    locationRef: { href: 'https://gsplus.vip/services?tracking=1' },
  });

  assert.equal(result.status, 'copied');
  assert.equal(copied, 'https://gsplus.vip/services');
});

test('cancelling the native share sheet does not copy or report failure', async () => {
  let copied = false;
  const abort = new Error('cancelled');
  abort.name = 'AbortError';
  const result = await shareSite({
    navigatorRef: {
      share: async () => { throw abort; },
      clipboard: { writeText: async () => { copied = true; } },
    },
    documentRef: documentFixture(),
    locationRef: { href: 'https://gsplus.vip/services' },
  });

  assert.equal(result.status, 'aborted');
  assert.equal(copied, false);
});
