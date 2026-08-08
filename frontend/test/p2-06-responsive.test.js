import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const admin = readFileSync(new URL('../src/pages/AdminDashboard.jsx', import.meta.url), 'utf8');
const adminCss = readFileSync(new URL('../src/pages/AdminDashboard.css', import.meta.url), 'utf8');
const responsiveE2e = readFileSync(new URL('../e2e/p2-06.spec.js', import.meta.url), 'utf8');

test('P2-06 verrouille la matrice responsive publique et administrateur', () => {
  for (const width of [320, 390, 768, 992, 1280]) {
    assert.match(responsiveE2e, new RegExp(`width: ${width}`));
  }
  assert.match(responsiveE2e, /mobile-390-landscape/);
  assert.match(responsiveE2e, /200%-zoom reflow/);
  assert.match(responsiveE2e, /publicRoutes/);
  assert.match(responsiveE2e, /admin\/dashboard/);
  assert.match(adminCss, /@media \(max-width: 991px\)/);
});

test('P2-06 protège le tiroir admin et restitue le focus au clavier', () => {
  assert.match(admin, /adminSidebarFocusableSelector/);
  assert.match(admin, /event\.key !== 'Tab'/);
  assert.match(admin, /event\.key === 'Escape'/);
  assert.match(admin, /element\.inert = true/);
  assert.match(admin, /aria-modal=\{isSidebarOpen \? 'true'/);
  assert.match(admin, /requestAnimationFrame\(\(\) => sidebarToggleRef\.current\?\.focus\(\)\)/);
});
