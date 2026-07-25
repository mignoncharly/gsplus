import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { SERVICE_MEDIA, groupServiceMedia, serviceMediaFor } from '../src/content/service-media.js';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(frontendRoot, '..');
const privateManifestPath = path.join(projectRoot, 'private-media/phase13-services/manifest.json');
const privateManifest = JSON.parse(fs.readFileSync(privateManifestPath, 'utf8'));

test('the supplied realization catalog contains 9 Design and 3 Impression images', () => {
  assert.equal(SERVICE_MEDIA.length, 12);
  assert.equal(serviceMediaFor('design').length, 9);
  assert.equal(serviceMediaFor('print').length, 3);
  assert.equal(new Set(SERVICE_MEDIA.map((item) => item.slug)).size, 12);
  assert.deepEqual(groupServiceMedia('design').map((group) => group.category), [
    'Retouche photo',
    'Flyers et affiches',
    'Identité visuelle',
    'Objets personnalisés',
  ]);
  assert.deepEqual(groupServiceMedia('print').map((group) => group.category), [
    'Albums',
    'Cadres et tirages',
  ]);
});

test('each catalog item has French accessibility text and two real responsive WebP derivatives', () => {
  for (const item of SERVICE_MEDIA) {
    assert.ok(item.alt.length >= 40, item.slug);
    assert.equal(item.width, 1024);
    assert.equal(item.height, 1024);
    assert.match(item.srcSet, /-480\.webp 480w, \/images\/services\/.+-1024\.webp 1024w$/);

    for (const width of [480, 1024]) {
      const file = path.join(frontendRoot, 'public/images/services', `${item.slug}-${width}.webp`);
      const bytes = fs.readFileSync(file);
      assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', file);
      assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP', file);
      assert.ok(fs.statSync(file).size <= 250_000, file);
    }
  }
});

test('protected manifest records rights approval, source hashes and derivative dimensions', () => {
  assert.equal(fs.statSync(privateManifestPath).mode & 0o777, 0o600);
  assert.equal(privateManifest.items.length, 12);
  assert.equal(privateManifest.publicationApproval.publicationApproved, true);
  assert.equal(privateManifest.canonicalLogo.sourceFilename, 'vert_gold_blanc.svg');
  assert.match(privateManifest.canonicalLogo.sha256, /^[a-f0-9]{64}$/);

  for (const item of privateManifest.items) {
    assert.equal(item.publicationApproved, true);
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.equal(item.derivatives.length, 2);
    assert.deepEqual(item.derivatives.map((derivative) => derivative.width), [480, 1024]);
  }
});

test('raw supplied masters and the canonical SVG are not public files', () => {
  const logoMaster = path.join(projectRoot, 'private-media/supplied-masters/logo/vert_gold_blanc.svg');
  assert.equal(fs.statSync(logoMaster).mode & 0o777, 0o600);
  assert.equal(fs.existsSync(path.join(frontendRoot, 'public/vert_gold_blanc.svg')), false);
  assert.equal(fs.existsSync(path.join(frontendRoot, 'public/images/services/retouche_1.png')), false);
});
