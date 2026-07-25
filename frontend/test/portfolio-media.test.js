import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalPortfolioCategory,
  curatePortfolioMedia,
  responsiveImageData,
} from '../src/lib/portfolio-media.js';

const fallback = [
  { id: 'local-1', title: 'Portrait local', category: 'Portrait', url: '/portrait.webp' },
  { id: 'local-2', title: 'Couple local', category: 'Couple', url: '/couple.webp' },
];

test('database media augment curated fallback items without exposing technical categories', () => {
  const result = curatePortfolioMedia([
    { id: 'api-1', title: 'Famille', category: 'Famille', url: '/uploads/famille.webp' },
    { id: 'api-2', title: 'Hero', category: 'hero', url: '/images/hero.png' },
    { id: 'api-3', title: 'QA', category: 'QA_TEST', url: '/uploads/qa.png' },
  ], fallback);

  assert.deepEqual(result.map((item) => item.id), ['api-1', 'local-1', 'local-2']);
  assert.deepEqual(result.map((item) => item.category), ['Famille', 'Portrait', 'Couple']);
});

test('category aliases are normalized to the public editorial vocabulary', () => {
  assert.equal(canonicalPortfolioCategory('Maternite'), 'Maternité');
  assert.equal(canonicalPortfolioCategory('Évènementiel'), 'Événementiel');
  assert.equal(canonicalPortfolioCategory('QA_TEST'), null);
});

test('responsive image data maps thumbnail and primary derivatives into a width descriptor srcset', () => {
  const data = responsiveImageData({
    url: '/uploads/photo-1600.webp',
    width: 1200,
    height: 800,
    thumbnailUrl: '/uploads/photo-640.webp',
    thumbnailWidth: 640,
    thumbnailHeight: 427,
  }, (url) => `https://api.example.test${url}`);

  assert.equal(data.src, 'https://api.example.test/uploads/photo-640.webp');
  assert.equal(data.srcSet, 'https://api.example.test/uploads/photo-640.webp 640w, https://api.example.test/uploads/photo-1600.webp 1200w');
  assert.equal(data.width, 640);
  assert.equal(data.height, 427);
});
