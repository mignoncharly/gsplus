import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const header = readFileSync(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../src/components/Footer.jsx', import.meta.url), 'utf8');
const manager = readFileSync(new URL('../src/components/ScrollManager.jsx', import.meta.url), 'utf8');
const creativeServices = readFileSync(new URL('../src/pages/CreativeServices.jsx', import.meta.url), 'utf8');

test('P2-05 couvre toutes les destinations internes du header et du footer', () => {
  for (const path of ['/', '/a-propos', '/services', '/portfolio', '/corporate', '/contact']) {
    assert.match(header, new RegExp(`path: '${path.replace('/', '\\/')}'`));
  }
  assert.match(header, /to="\/reservation"/);

  for (const path of [
    '/', '/portfolio', '/services-creatifs#devis-creatif', '/a-propos',
    '/services', '/corporate', '/cgv', '/confidentialite',
    '/mentions-legales', '/admin',
  ]) {
    assert.match(footer, new RegExp(`to="${path.replaceAll('/', '\\/')}"`));
  }
});

test('P2-05 conserve ScrollManager et coordonne scroll, hash et focus sur chaque transition', () => {
  assert.match(manager, /createScrollPositionStore/);
  assert.match(manager, /location\.hash/);
  assert.match(manager, /MutationObserver/);
  assert.match(manager, /main\?\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(manager, /if \(navigationType !== 'POP'\) \{\s*const main/);
  assert.match(creativeServices, /id="devis-creatif"[\s\S]{0,160}tabIndex="-1"/);
});
