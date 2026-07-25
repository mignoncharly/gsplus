import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(frontendRoot, 'src');
const forbiddenPackages = [
  '@react-router/dev',
  '@react-router/node',
  'react-server-dom-webpack',
  'react-server-dom-vite',
];
const forbiddenSource = [
  { label: 'server action directive', pattern: /["']use server["']/ },
  { label: 'React Router server/RSC import', pattern: /from\s+["'](?:react-router|react-router-dom)\/(?:server|rsc)/ },
  { label: 'React Server DOM import', pattern: /from\s+["']react-server-dom-/ },
];

const sourceFiles = [];
const visit = async (directory) => {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(absolute);
    else if (/\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name)) sourceFiles.push(absolute);
  }
};
await visit(sourceRoot);

const failures = [];
for (const file of sourceFiles) {
  if (/\.server\.[^.]+$/.test(file)) failures.push(`${path.relative(frontendRoot, file)}: server module filename`);
  const contents = await fs.readFile(file, 'utf8');
  for (const rule of forbiddenSource) {
    if (rule.pattern.test(contents)) failures.push(`${path.relative(frontendRoot, file)}: ${rule.label}`);
  }
}

const packageJson = JSON.parse(await fs.readFile(path.join(frontendRoot, 'package.json'), 'utf8'));
const packages = { ...packageJson.dependencies, ...packageJson.devDependencies };
for (const name of forbiddenPackages) {
  if (packages[name]) failures.push(`package.json: forbidden client-only dependency ${name}`);
}

if (failures.length > 0) {
  throw new Error(`Client-only assertion failed:\n${failures.join('\n')}`);
}

console.log(`Client-only assertion passed for ${sourceFiles.length} source modules.`);
