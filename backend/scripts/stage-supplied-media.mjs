import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectDir = path.resolve(backendDir, '..');
const sourceDir = path.join(projectDir, 'docs', 'images_logos', 'Image Page Portfolio');
const outputDir = path.join(projectDir, 'private-media', 'phase8-curated');

const categoryForName = (name) => {
  const normalized = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (normalized.startsWith('corporate')) return 'Corporate';
  if (normalized.startsWith('maternite')) return 'Maternité';
  if (normalized.startsWith('couple')) return 'Couple';
  if (normalized.startsWith('famille')) return 'Famille';
  if (normalized.startsWith('portrait')) return 'Portrait';
  if (normalized.startsWith('evenementiel')) return 'Événementiel';
  return null;
};

const slugForName = (name) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

await fs.mkdir(outputDir, { recursive: true, mode: 0o700 });
const entries = await fs.readdir(sourceDir, { withFileTypes: true });
const manifest = [];

for (const entry of entries) {
  if (!entry.isFile() || !/\.(png|jpe?g|webp)$/i.test(entry.name)) continue;

  const category = categoryForName(entry.name);
  if (!category) continue;

  const source = path.join(sourceDir, entry.name);
  const slug = slugForName(entry.name);
  const categoryDir = path.join(outputDir, slugForName(category));
  await fs.mkdir(categoryDir, { recursive: true, mode: 0o700 });
  const derivatives = [];

  for (const width of [480, 1024]) {
    const filename = `${slug}-${width}.webp`;
    const output = path.join(categoryDir, filename);
    const info = await sharp(source)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: width === 480 ? 78 : 84, effort: 4 })
      .toFile(output);
    await fs.chmod(output, 0o600);
    derivatives.push({
      path: path.relative(projectDir, output),
      width: info.width,
      height: info.height,
      mimeType: 'image/webp',
      bytes: info.size,
    });
  }

  manifest.push({
    source: path.relative(projectDir, source),
    category,
    titleDraft: `${category} — Golden Studio Plus`,
    altDraft: `Photographie ${category.toLowerCase()} réalisée par Golden Studio Plus`,
    publicationApproved: false,
    derivatives,
  });
}

const manifestPath = path.join(outputDir, 'manifest.json');
await fs.writeFile(
  manifestPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), publicationApproved: false, items: manifest }, null, 2)}\n`,
  { mode: 0o600 },
);
await fs.chmod(manifestPath, 0o600);
console.log(`Staged ${manifest.length} supplied images with publicationApproved=false.`);
