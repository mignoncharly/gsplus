import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = (path) => readFileSync(`${root}${path}`, 'utf8');
const optionalSource = (path) => existsSync(`${root}${path}`) ? source(path) : '';

test('UI-WA-01 uses a local official white WhatsApp mark on the brand green', () => {
  const app = source('src/App.jsx');
  const fab = optionalSource('src/components/WhatsAppFab.jsx');
  const css = source('src/index.css');
  const mark = optionalSource('public/images/whatsapp-mark-white.svg');

  assert.match(app, /WhatsAppFab/);
  assert.doesNotMatch(app, /MessageCircle/);
  assert.match(fab, /\/images\/whatsapp-mark-white\.svg/);
  assert.match(fab, /Contacter Golden Studio Plus sur WhatsApp/);
  assert.match(css, /background:\s*#25D366/i);
  assert.match(mark, /viewBox="0 0 24 24"/);
  assert.match(mark, /fill="#fff"/i);
});

test('UI-WA-01 encodes safe-area insets, keyboard handling and collision avoidance', () => {
  const fab = optionalSource('src/components/WhatsAppFab.jsx');
  const css = source('src/index.css');

  assert.match(css, /--whatsapp-fab-safe-inline/);
  assert.match(css, /--whatsapp-fab-safe-block/);
  assert.match(css, /env\(safe-area-inset-right/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /min-width:\s*44px/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(fab, /visualViewport/);
  assert.match(fab, /data-obscured/);
  assert.match(fab, /input, select, textarea/);
});
