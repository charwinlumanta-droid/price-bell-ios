import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(root, 'dist');
const files = [
  'index.html',
  'app.js',
  'engine.js',
  'style.css',
  'service-worker.js',
  'manifest.webmanifest',
  'logo.png',
  'INSTALL-ON-IPHONE.html',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  '.nojekyll',
];

// Publish only these application files; source tests and configuration stay out.
for (const file of files) {
  const info = await stat(resolve(root, file));
  if (!info.isFile()) throw new Error(`Required application file is missing: ${file}`);
}

// The clean target is fixed inside this repository, never supplied by a user.
if (dirname(destination) !== root || destination !== resolve(root, 'dist')) {
  throw new Error('Build output must be the dist folder inside this repository.');
}
await rm(destination, { recursive: true, force: true });
await mkdir(resolve(destination, 'icons'), { recursive: true });
for (const file of files) {
  await cp(resolve(root, file), resolve(destination, file));
}
console.log(`Built ${files.length} website files in dist/. Ready for GitHub Pages.`);
