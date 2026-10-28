import { readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

// Include runtime dependencies' notices without adding a license plugin or
// loading any dependency code. Identical texts share a package heading.
export async function runtimeNotices(root) {
  const seen = new Set();
  const groups = new Map();
  async function resolvePackage(name, from) {
    let directory = from;
    while (true) {
      try { return await realpath(path.join(directory, 'node_modules', name)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      const parent = path.dirname(directory);
      if (parent === directory) throw new Error(`Missing runtime dependency: ${name}`);
      directory = parent;
    }
  }
  async function visit(name, from) {
    const directory = await resolvePackage(name, from);
    if (seen.has(directory)) return;
    seen.add(directory);
    const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    const filenames = (await readdir(directory)).filter(file => /^(?:license|licence)(?:\.[\w]+)?$/i.test(file)).sort();
    let notice;
    if (!filenames.length) {
      // This published package omits LICENSE. Preserve the verified upstream
      // notice locally; builds stay offline and unknown omissions still fail.
      if (pkg.name !== 'react-remove-scroll-bar' || pkg.version !== '2.3.8' || pkg.license !== 'MIT') throw new Error(`Missing license text for ${name}`);
      notice = await readFile(path.join(root, 'licenses/react-remove-scroll-bar-2.3.8.txt'), 'utf8');
    } else notice = (await Promise.all(filenames.map(file => readFile(path.join(directory, file), 'utf8')))).join('\n');
    const text = notice.replace(/\r\n/g, '\n').trim();
    groups.set(text, [...(groups.get(text) ?? []), `${pkg.name}@${pkg.version}`]);
    for (const dependency of Object.keys(pkg.dependencies ?? {}).sort()) await visit(dependency, directory);
  }
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  for (const name of Object.keys(pkg.dependencies).sort()) await visit(name, root);
  return 'ClipKnife website demo — third-party runtime notices\n\n' + [...groups.entries()]
    .map(([text, names]) => `${names.sort().join('\n')}\n${'='.repeat(72)}\n${text}\n`)
    .sort().join('\n').trimEnd() + '\n';
}
