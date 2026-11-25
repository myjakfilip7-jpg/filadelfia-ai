// Paczka strony RAZEM z backendem (panel, logowanie przez GitHub) na hosting z Node.js, np. Hostinger:
//   node tools/paczka-node.mjs https://habadzibadlo.pl/
// Tworzy paczka/<domena>-node.zip: strony zbudowane pod podany adres, pliki panelu, server/server.mjs i package.json.
// Sekrety (SESSION_SECRET, klucze GitHub) ustawia się w zmiennych środowiska hostingu, nie w paczce.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = process.argv[2];
if (!/^https:\/\/[^/]+\/$/.test(site || '')) { console.error('Podaj adres z https i ukośnikiem na końcu, np. https://habadzibadlo.pl/'); process.exit(1); }
const name = new URL(site).host.replace(/\./g, '-') + '-node';
const out = path.join(ROOT, 'paczka', name), zip = path.join(ROOT, 'paczka', name + '.zip');
const build = (env) => execFileSync(process.execPath, [path.join(ROOT, 'build.mjs')], { env: { ...process.env, ...env }, stdio: 'ignore' });

build({ SITE: site });
try {
  rmSync(out, { recursive: true, force: true }); rmSync(zip, { force: true }); mkdirSync(path.join(out, 'server'), { recursive: true });
  const files = ['index.html', 'kampanie.html', 'automatyzacje.html', 'chatboty.html', 'strony.html', 'kontakt.html', 'prywatnosc.html', 'marka.html', '404.html',
    'panel.html', 'panel.js', 'panel.css', 'theme.js', 'styles.css', 'script.js', 'favicon.svg', 'og.png', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'sitemap.xml', 'robots.txt'];
  for (const f of files) cpSync(path.join(ROOT, f), path.join(out, f));
  for (const d of ['fonts', 'media']) cpSync(path.join(ROOT, d), path.join(out, d), { recursive: true });
  cpSync(path.join(ROOT, 'server/server.mjs'), path.join(out, 'server/server.mjs'));
  writeFileSync(path.join(out, 'package.json'), JSON.stringify({ name: 'filadelfia-ai', version: '1.0.0', private: true, main: 'server/server.mjs',
    scripts: { start: 'node server/server.mjs', build: 'node -e ""' }, engines: { node: '>=22' } }, null, 2) + '\n');
  execFileSync('zip', ['-r', '-q', '-X', zip, '.'], { cwd: out });
  console.log('Paczka: ' + path.relative(ROOT, zip));
} finally {
  build({}); // z powrotem pod adres domyślny
}
