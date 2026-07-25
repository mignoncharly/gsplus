import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectDir = path.resolve(backendDir, '..');
const masterRoot = path.join(projectDir, 'private-media', 'supplied-masters');
const privateOutputRoot = path.join(projectDir, 'private-media', 'phase13-services');
const publicServiceRoot = path.join(projectDir, 'frontend', 'public', 'images', 'services');
const publicOptimizedRoot = path.join(projectDir, 'frontend', 'public', 'images', 'optimized');
const publicImageRoot = path.join(projectDir, 'frontend', 'public', 'images');
const publicRoot = path.join(projectDir, 'frontend', 'public');
const approval = {
  publicationApproved: true,
  approvedAt: '2026-07-25T00:00:00.000Z',
  approvalBasis: 'Owner instruction to publish the supplied Design, Impression and canonical logo assets on 2026-07-25.',
};

const assets = [
  { source: 'design/retouche_1.png', slug: 'design-retouche-1', section: 'design', category: 'Retouche photo', title: 'Retouche photo — réalisation 1', alt: 'Exemple de retouche photo réalisé par Golden Studio Plus à Douala.' },
  { source: 'design/retouche_2.png', slug: 'design-retouche-2', section: 'design', category: 'Retouche photo', title: 'Retouche photo — réalisation 2', alt: 'Deuxième exemple de retouche photo réalisé par Golden Studio Plus à Douala.' },
  { source: 'design/retouche_3.png', slug: 'design-retouche-3', section: 'design', category: 'Retouche photo', title: 'Retouche photo — réalisation 3', alt: 'Troisième exemple de retouche photo réalisé par Golden Studio Plus à Douala.' },
  { source: 'design/Cadres_Affiches_3.png', slug: 'design-affiche-cadre', section: 'design', category: 'Flyers et affiches', title: 'Affiche et mise en cadre', alt: 'Création d’affiche et présentation encadrée conçues par Golden Studio Plus.' },
  { source: 'design/flyer_1.png', slug: 'design-flyer-1', section: 'design', category: 'Flyers et affiches', title: 'Flyer de communication', alt: 'Flyer de communication conçu par Golden Studio Plus à Douala.' },
  { source: 'design/Carte de visite.png', slug: 'design-carte-visite', section: 'design', category: 'Identité visuelle', title: 'Carte de visite', alt: 'Exemple de carte de visite et papeterie de marque conçu par Golden Studio Plus.' },
  { source: 'design/Services Design_1.png', slug: 'design-identite-visuelle', section: 'design', category: 'Identité visuelle', title: 'Identité visuelle', alt: 'Présentation d’identité visuelle conçue par Golden Studio Plus à Douala.' },
  { source: 'design/objet_2.png', slug: 'design-objet-personnalise-2', section: 'design', category: 'Objets personnalisés', title: 'Objet personnalisé — réalisation 1', alt: 'Premier exemple d’objet personnalisé conçu par Golden Studio Plus.' },
  { source: 'design/objet_3.png', slug: 'design-objet-personnalise-3', section: 'design', category: 'Objets personnalisés', title: 'Objet personnalisé — réalisation 2', alt: 'Deuxième exemple d’objet personnalisé conçu par Golden Studio Plus.' },
  { source: 'print/print_1.png', slug: 'impression-album-1', section: 'print', category: 'Albums', title: 'Album photo personnalisé', alt: 'Exemple d’album photo personnalisé imprimé par Golden Studio Plus.' },
  { source: 'print/print_2.png', slug: 'impression-cadre-tirage-2', section: 'print', category: 'Cadres et tirages', title: 'Cadre et tirage photo — réalisation 1', alt: 'Premier exemple de cadre et tirage photo proposé par Golden Studio Plus.' },
  { source: 'print/print_3.png', slug: 'impression-cadre-tirage-3', section: 'print', category: 'Cadres et tirages', title: 'Cadre et tirage photo — réalisation 2', alt: 'Deuxième exemple de cadre et tirage photo proposé par Golden Studio Plus.' },
];

const sha256 = (input) => createHash('sha256').update(input).digest('hex');
const publicDescriptor = async (file, publicPath) => {
  const metadata = await sharp(file).metadata();
  const stat = await fs.stat(file);
  return {
    path: publicPath,
    width: metadata.width,
    height: metadata.height,
    mimeType: metadata.format === 'jpeg' ? 'image/jpeg' : `image/${metadata.format}`,
    bytes: stat.size,
  };
};

await fs.mkdir(privateOutputRoot, { recursive: true, mode: 0o700 });
await fs.mkdir(publicServiceRoot, { recursive: true });
await fs.mkdir(publicOptimizedRoot, { recursive: true });

const manifestItems = [];
for (const asset of assets) {
  const source = path.join(masterRoot, asset.source);
  const sourceBytes = await fs.readFile(source);
  const derivatives = [];

  for (const width of [480, 1024]) {
    const filename = `${asset.slug}-${width}.webp`;
    const output = path.join(publicServiceRoot, filename);
    await sharp(source)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: width === 480 ? 79 : 85, effort: 5 })
      .toFile(output);
    await fs.chmod(output, 0o644);
    derivatives.push(await publicDescriptor(output, `/images/services/${filename}`));
  }

  manifestItems.push({
    sourceFilename: path.basename(asset.source),
    protectedSource: `private-media/supplied-masters/${asset.source}`,
    sha256: sha256(sourceBytes),
    sourceBytes: sourceBytes.length,
    section: asset.section,
    category: asset.category,
    title: asset.title,
    alt: asset.alt,
    ...approval,
    derivatives,
  });
}

const logoSource = path.join(masterRoot, 'logo', 'vert_gold_blanc.svg');
const logoSourceBytes = await fs.readFile(logoSource);
const logoDerivatives = [];
for (const width of [160, 320]) {
  const filename = `brand-logo-${width}.webp`;
  const output = path.join(publicOptimizedRoot, filename);
  await sharp(logoSource, { density: 240 })
    .resize(width, width, { fit: 'contain' })
    .webp({ quality: 74, alphaQuality: 100, effort: 5 })
    .toFile(output);
  await fs.chmod(output, 0o644);
  logoDerivatives.push(await publicDescriptor(output, `/images/optimized/${filename}`));
}

for (const { width, filename } of [
  { width: 32, filename: 'favicon-32.png' },
  { width: 180, filename: 'apple-touch-icon.png' },
  { width: 192, filename: 'favicon-192.png' },
  { width: 512, filename: 'favicon-512.png' },
]) {
  const output = path.join(publicRoot, filename);
  await sharp(logoSource, { density: 300 })
    .resize(width, width, { fit: 'contain' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);
  await fs.chmod(output, 0o644);
  logoDerivatives.push(await publicDescriptor(output, `/${filename}`));
}

const heroSource = path.join(projectDir, 'private-media', 'static-masters', 'images', 'hero.png');
const socialOutput = path.join(publicImageRoot, 'og-golden-studio-plus-2026.jpg');
const socialLogo = await sharp(logoSource, { density: 300 })
  .resize(340, 340, { fit: 'contain' })
  .png()
  .toBuffer();
const socialText = Buffer.from(`
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#0D1311" fill-opacity="0.72"/>
    <rect x="470" y="105" width="2" height="420" fill="#C8A75A"/>
    <text x="530" y="215" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="58" font-weight="700">Golden Studio Plus</text>
    <text x="530" y="285" fill="#D9B967" font-family="Arial, sans-serif" font-size="34" font-weight="600">Studio photo premium à Douala</text>
    <text x="530" y="365" fill="#F2F3F1" font-family="Arial, sans-serif" font-size="28">Portraits · Familles · Maternité</text>
    <text x="530" y="410" fill="#F2F3F1" font-family="Arial, sans-serif" font-size="28">Événements · Corporate · Design</text>
    <text x="530" y="490" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="25">gsplus.vip</text>
  </svg>
`);
await sharp(heroSource)
  .resize(1200, 630, { fit: 'cover', position: 'attention' })
  .modulate({ brightness: 0.58, saturation: 0.72 })
  .composite([
    { input: socialText, left: 0, top: 0 },
    { input: socialLogo, left: 70, top: 145 },
  ])
  .jpeg({ quality: 86, progressive: true, mozjpeg: true, chromaSubsampling: '4:4:4' })
  .toFile(socialOutput);
await fs.chmod(socialOutput, 0o644);
const socialDerivative = await publicDescriptor(socialOutput, '/images/og-golden-studio-plus-2026.jpg');

const webManifest = {
  name: 'Golden Studio Plus',
  short_name: 'GS Plus',
  description: 'Studio photo premium à Douala.',
  start_url: '/',
  display: 'standalone',
  background_color: '#0D1311',
  theme_color: '#0D1311',
  icons: [
    { src: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
  ],
};
await fs.writeFile(path.join(publicRoot, 'site.webmanifest'), `${JSON.stringify(webManifest, null, 2)}\n`, 'utf8');

const optimizedManifestPath = path.join(publicOptimizedRoot, 'manifest.json');
const optimizedManifest = JSON.parse(await fs.readFile(optimizedManifestPath, 'utf8'));
const canonicalLogoMetadata = await sharp(logoSource, { density: 240 }).metadata();
const canonicalLogoAsset = optimizedManifest.assets.find((asset) =>
  asset.derivatives.some((derivative) => derivative.url === '/images/optimized/brand-logo-320.webp'));
if (!canonicalLogoAsset) throw new Error('Canonical logo entry is missing from the optimized-image manifest.');
canonicalLogoAsset.source = 'vert_gold_blanc.svg';
canonicalLogoAsset.sourceWidth = canonicalLogoMetadata.width;
canonicalLogoAsset.sourceHeight = canonicalLogoMetadata.height;
canonicalLogoAsset.derivatives = logoDerivatives
  .filter((derivative) => derivative.path.startsWith('/images/optimized/'))
  .map(({ path: url, width, height, mimeType, bytes }) => ({ url, width, height, mimeType, bytes }));
optimizedManifest.generatedAt = new Date().toISOString();
await fs.writeFile(optimizedManifestPath, `${JSON.stringify(optimizedManifest, null, 2)}\n`, 'utf8');
const manifest = {
  generatedAt: new Date().toISOString(),
  publicationApproval: approval,
  canonicalLogo: {
    sourceFilename: 'vert_gold_blanc.svg',
    protectedSource: 'private-media/supplied-masters/logo/vert_gold_blanc.svg',
    sha256: sha256(logoSourceBytes),
    sourceBytes: logoSourceBytes.length,
    ...approval,
    derivatives: logoDerivatives,
    socialPreview: socialDerivative,
  },
  items: manifestItems,
};
const manifestPath = path.join(privateOutputRoot, 'manifest.json');
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
await fs.chmod(manifestPath, 0o600);
console.log(`Prepared ${manifestItems.length} service images, ${logoDerivatives.length} logo/icon derivatives and one 1200x630 social preview.`);
