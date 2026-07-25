import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectDir = path.resolve(backendDir, '..');
const publicDir = path.join(projectDir, 'frontend', 'public');
const privateSourceDir = path.join(projectDir, 'private-media', 'static-masters');
const outputDir = path.join(publicDir, 'images', 'optimized');

const assets = [
  ['hero-banner', 'hero_banner.png', [640, 1024]],
  ['engagement', 'images/engagement.png', [480, 1024]],
  ['about-studio', 'images/hero.png', [640, 1024]],
  ['portfolio-corporate', 'images/portfolio/corporate.png', [480, 1024]],
  ['portfolio-couple', 'images/portfolio/couple.png', [480, 1024]],
  ['portfolio-maternity', 'images/portfolio/maternity.png', [480, 1024]],
  ['portfolio-portrait-1', 'portfolio_portrait_1.png', [480, 1024]],
  ['portfolio-portrait-2', 'portfolio_portrait_2.png', [480, 1024]],
  ['portfolio-portrait-3', 'portfolio_portrait_3.png', [480, 1024]],
  ['brand-logo', '../supplied-masters/logo/vert_gold_blanc.svg', [160, 320]],
];

await fs.mkdir(outputDir, { recursive: true });

const manifest = [];
for (const [name, relativeSource, widths] of assets) {
  const source = path.join(privateSourceDir, relativeSource);
  const metadata = await sharp(source).metadata();
  const derivatives = [];

  for (const width of widths) {
    const filename = `${name}-${width}.webp`;
    const output = path.join(outputDir, filename);
    const info = await sharp(source)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: name === 'brand-logo' ? 74 : width <= 640 ? 78 : 84, effort: 4 })
      .toFile(output);

    derivatives.push({
      url: `/images/optimized/${filename}`,
      width: info.width,
      height: info.height,
      mimeType: 'image/webp',
      bytes: info.size,
    });
  }

  manifest.push({
    source: relativeSource,
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
    derivatives,
  });
}

await fs.writeFile(
  path.join(outputDir, 'manifest.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), assets: manifest }, null, 2)}\n`,
);

for (const asset of manifest) {
  const summary = asset.derivatives.map((item) => `${item.width}w:${item.bytes}B`).join(', ');
  console.log(`${asset.source}: ${summary}`);
}
