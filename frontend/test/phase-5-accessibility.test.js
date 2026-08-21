import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('Phase 5 keeps shared route headings and documented dark tokens global', () => {
  const globalCss = read('../src/index.css');
  const homeCss = read('../src/pages/Home.css');
  assert.match(globalCss, /Semantic foregrounds[\s\S]*primary 16\.03:1[\s\S]*--dark-disabled/);
  assert.match(globalCss, /\.home-section-label\s*\{[\s\S]*--dark-accent/);
  assert.doesNotMatch(homeCss, /(^|\n)\.home-section-label\s*\{/);
});

test('Phase 5 gives compact public and admin controls an explicit 44px floor', () => {
  const globalCss = read('../src/index.css');
  const servicesCss = read('../src/pages/Services.css');
  const portfolioCss = read('../src/pages/Portfolio.css');
  const adminCss = read('../src/pages/AdminDashboard.css');
  const languageCss = read('../src/components/LanguageSwitcher.css');
  const governanceCss = read('../src/components/AdminDataGovernancePanel.css');
  assert.match(globalCss, /\.btn\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(servicesCss, /\.service-category-filter\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(portfolioCss, /\.filter-btn\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(languageCss, /\.language-switcher button\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(adminCss, /\.admin-sm-btn\s*\{[\s\S]*min-height:\s*44px/);
  assert.match(governanceCss, /\.admin-governance-policies summary\s*\{[\s\S]*min-height:\s*44px/);
});

test('Phase 5 inserts named h2 group headings before public card collections', () => {
  const expectations = {
    'Services.jsx': /<h2[^>]*>\{t\('Formules et séances photo'/,
    'Portfolio.jsx': /<h2[^>]*portfolio-gallery-title/,
    'Corporate.jsx': /<h2[^>]*>\{t\('Solutions pour votre organisation'/,
    'Contact.jsx': /<h2>\{copy\.infoHeading\}<\/h2>/,
    'CreativeServices.jsx': /<h2[^>]*>\{t\('Nos services créatifs'/,
  };
  for (const [file, pattern] of Object.entries(expectations)) {
    assert.match(read(`../src/pages/${file}`), pattern);
  }
});
