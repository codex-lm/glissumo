import { readFile, writeFile, mkdir, readdir, stat, copyFile } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
const files = [
  'index.html', 'style.css', 'app.js', 'engine.js', 'network.js', 'renderer.js', 'i18n.js', 'audio.js', 'icon.svg',
  'LOB7-GAME.json', 'LICENSE', 'CREDITS.md', 'README.md',
  'vendor/lob7-rooms.js', 'vendor/lob7-rooms-p2p.js', 'vendor/LICENSE-LOB7.txt',
  'assets/audio/music.mp3', 'assets/audio/collect.mp3', 'assets/audio/bank.mp3', 'assets/audio/steal.mp3', 'assets/audio/PROVENANCE.md',
];
const allowed = new Set([...files, 'BUILD.json']);

async function inspect(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Build output contains a symlink: ${path}`);
    if (entry.isDirectory()) await inspect(path);
    else if (!allowed.has(relative(output, path).replaceAll('\\', '/'))) {
      throw new Error(`Unexpected output file: ${path}. Inspect it before rebuilding.`);
    }
  }
}

await inspect(output);
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(root, 'LOB7-GAME.json'), 'utf8'));
if (manifest.multiplayer?.mode !== 'p2p' || manifest.multiplayer?.maxPlayers !== 2 || 'network' in manifest) {
  throw new Error('Expected the two-player LOB7 p2p manifest without network.');
}
const digests = {};
for (const file of files) {
  const input = join(root, file), destination = join(output, file);
  if (!(await stat(input)).isFile()) throw new Error(`Missing source file: ${file}`);
  const bytes = await readFile(input);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(input, destination);
  digests[file] = createHash('sha256').update(bytes).digest('hex');
}
await writeFile(join(output, 'BUILD.json'), `${JSON.stringify({ name: pkg.name, version: pkg.version, sha256: digests }, null, 2)}\n`);
console.log(`Prepared ${files.length + 1} allowlisted files in ${output} (${pkg.version}).`);
