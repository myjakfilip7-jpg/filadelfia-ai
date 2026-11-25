// Paczka strony na zwykły hosting (np. Hostinger): `node tools/paczka.mjs https://habadzibadlo.pl/`
// Buduje strony pod podany adres, kopiuje same pliki statyczne do paczka/ i pakuje je do ZIP-a.
// Na końcu przywraca build pod adres domyślny, żeby repozytorium (GitHub Pages) zostało bez zmian.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = process.argv[2];
if (!/^https:\/\/[^/]+\/$/.test(site || '')) { console.error('Podaj adres z https i ukośnikiem na końcu, np. https://habadzibadlo.pl/'); process.exit(1); }
const name = new URL(site).host.replace(/\./g, '-');
const out = path.join(ROOT, 'paczka', name), zip = path.join(ROOT, 'paczka', name + '.zip');
const build = (env) => execFileSync(process.execPath, [path.join(ROOT, 'build.mjs')], { env: { ...process.env, ...env }, stdio: 'ignore' });

build({ SITE: site });
try {
  rmSync(out, { recursive: true, force: true }); rmSync(zip, { force: true }); mkdirSync(out, { recursive: true });
  // bez panelu i backendu: wymagają własnego serwera Node, którego na hostingu współdzielonym nie ma
  const files = ['index.html', 'kampanie.html', 'automatyzacje.html', 'chatboty.html', 'strony.html', 'kontakt.html', 'prywatnosc.html', 'marka.html', '404.html',
    'styles.css', 'script.js', 'favicon.svg', 'og.png', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'sitemap.xml', 'robots.txt'];
  for (const f of files) cpSync(path.join(ROOT, f), path.join(out, f));
  for (const d of ['fonts', 'media']) cpSync(path.join(ROOT, d), path.join(out, d), { recursive: true });
  writeFileSync(path.join(out, '.htaccess'), `# Filadelfia.ai — ustawienia dla serwera Apache / LiteSpeed (Hostinger)
ErrorDocument 404 /404.html
Options -Indexes
AddType application/manifest+json .webmanifest
AddType font/woff2 .woff2
AddType application/octet-stream .bin

<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set Referrer-Policy "strict-origin-when-cross-origin"
  # strony zawsze świeże; style i skrypt mają skrót treści w adresie, więc mogą leżeć w pamięci podręcznej rok
  <FilesMatch "\\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  <FilesMatch "\\.(css|js)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "\\.(woff2|jpg|png|svg|bin|webmanifest)$">
    Header set Cache-Control "public, max-age=2592000"
  </FilesMatch>
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript image/svg+xml application/manifest+json application/xml
</IfModule>
`);
  execFileSync('zip', ['-r', '-q', '-X', zip, '.'], { cwd: out });
  console.log('Paczka: ' + path.relative(ROOT, zip) + '  (rozpakowane pliki: ' + path.relative(ROOT, out) + '/)');
} finally {
  build({}); // z powrotem pod adres domyślny
}
if (!existsSync(zip)) process.exit(1);
