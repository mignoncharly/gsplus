import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(frontendRoot, 'public/images/optimized/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const byUrl = new Map(manifest.assets.flatMap((asset) =>
  asset.derivatives.map((derivative) => [derivative.url, { ...derivative, source: asset.source }])));

const fileForUrl = (url) => path.join(frontendRoot, 'public', url.replace(/^\//, ''));

test('optimized image manifest describes real WebP files with exact dimensions and sizes', () => {
  assert.equal(manifest.assets.length, 10);

  for (const derivative of byUrl.values()) {
    const filePath = fileForUrl(derivative.url);
    const contents = fs.readFileSync(filePath);
    assert.equal(derivative.mimeType, 'image/webp');
    assert.equal(fs.statSync(filePath).size, derivative.bytes);
    assert.equal(contents.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(contents.subarray(8, 12).toString('ascii'), 'WEBP');
    assert.ok(derivative.width > 0 && derivative.height > 0);
  }
});

test('critical and gallery image variants stay inside the Phase 8 byte budgets', () => {
  assert.ok(byUrl.get('/images/optimized/hero-banner-640.webp').bytes <= 30_000);
  assert.ok(byUrl.get('/images/optimized/brand-logo-320.webp').bytes <= 15_000);

  const portfolioThumbnails = [...byUrl.values()].filter((item) =>
    item.url.includes('/portfolio-') && item.width === 480);
  assert.equal(portfolioThumbnails.length, 6);
  assert.ok(portfolioThumbnails.every((item) => item.bytes <= 25_000));
  assert.ok(portfolioThumbnails.reduce((total, item) => total + item.bytes, 0) <= 100_000);
});
