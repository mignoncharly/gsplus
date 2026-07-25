import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from '../../backend/node_modules/sharp/dist/index.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const input = resolve(projectRoot, '../private-media/static-masters/images/hero.png');
const output = resolve(projectRoot, 'public/images/og-golden-studio-plus.jpg');

await sharp(input)
  .resize(1200, 630, { fit: 'cover', position: 'attention' })
  .jpeg({ quality: 82, progressive: true, mozjpeg: true })
  .toFile(output);

const metadata = await sharp(output).metadata();
console.log(`Created ${output} (${metadata.width}x${metadata.height}, ${metadata.format}).`);
