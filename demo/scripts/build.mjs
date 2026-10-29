import { build } from 'vite';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, copyFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeNotices } from './notices.mjs';

const demo = fileURLToPath(new URL('..', import.meta.url));
const docs = path.resolve(demo, '../docs');
const stage = path.join(demo, '.build');
const manifestPath = path.join(docs, 'assets/demo/build-manifest.json');
const check = process.argv.includes('--check');
await build({ configFile: path.join(demo, 'vite.config.ts') });
await build({ configFile: path.join(demo, 'vite.config.ts'), mode: 'demo-runtime' });
// Vite processes the source as a module, but publishes a classic IIFE so local
// file previews do not require a CORS-enabled HTTP server. Keep script ordering.
const entryHtmlPath = path.join(stage, 'demo/index.html');
const entryHtml = await readFile(entryHtmlPath, 'utf8');
const moduleEntry = /<script type="module" crossorigin src="(\.\.\/assets\/demo\/entry\.js)"><\/script>/g;
if ([...entryHtml.matchAll(moduleEntry)].length !== 1) throw new Error('Missing expected demo entry script.');
await writeFile(entryHtmlPath, entryHtml.replace(moduleEntry, '<script defer src="$1"></script>')
  .replace('<link rel="stylesheet" crossorigin ', '<link rel="stylesheet" '), 'utf8');
await writeFile(path.join(stage, 'assets/demo/third-party-notices.txt'), await runtimeNotices(demo), 'utf8');

async function files(dir, relative = '') {
  const entries = await readdir(path.join(dir, relative), { withFileTypes: true });
  return (await Promise.all(entries.map(entry => {
    const name = path.posix.join(relative, entry.name);
    return entry.isDirectory() ? files(dir, name) : [name];
  }))).flat().sort();
}
function owned(name) {
  return name === 'demo/index.html' || /^assets\/demo\/\w[\w.-]*$/.test(name);
}
const generated = await files(stage);
if (!generated.includes('demo/index.html') || generated.some(name => !owned(name))) {
  throw new Error('Build produced a file outside the demo output boundary.');
}
const manifest = {};
for (const name of generated) {
  const data = await readFile(path.join(stage, name));
  manifest[name] = createHash('sha256').update(data).digest('hex');
  if (check) {
    const current = await readFile(path.join(docs, name)).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!current?.equals(data)) throw new Error(`Generated demo is stale: ${name}`);
  }
}
let previous = {};
try { previous = JSON.parse(await readFile(manifestPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (typeof previous !== 'object' || previous === null || Array.isArray(previous) || Object.keys(previous).some(name => !owned(name))) {
  throw new Error('Invalid demo build manifest; refusing to change files.');
}
const manifestText = JSON.stringify(manifest, null, 2) + '\n';
if (check) {
  if (JSON.stringify(previous) !== JSON.stringify(manifest)) throw new Error('Demo build manifest is stale.');
  console.log('Demo source and published static files match.');
} else {
  for (const name of generated) {
    const destination = path.join(docs, name);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(stage, name), destination);
  }
  for (const name of Object.keys(previous)) {
    if (!(name in manifest)) await unlink(path.join(docs, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  await writeFile(manifestPath, manifestText, 'utf8');
  console.log(`Published ${generated.length} demo files to docs; other site files untouched.`);
}
