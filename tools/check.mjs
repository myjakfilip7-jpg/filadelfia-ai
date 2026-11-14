// Kontrola frontendu bez przeglądarki: `node tools/check.mjs`.
// Sprawdza zbudowane pliki HTML: odnośniki, kotwice, nagłówki, opisy obrazów, aktualność builda i wagę strony.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');
let passed = 0, failed = 0;
const check = (name, ok, extra = '') => { ok ? passed++ : failed++; console.log(`${ok ? '  ok ' : 'BŁĄD '} ${name}${ok || !extra ? '' : '  → ' + extra}`); };

const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const ids = Object.fromEntries(pages.map((f) => [f, new Set([...read(f).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));

for (const file of pages) {
  const html = read(file).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (m) => m.replace(/>[\s\S]*</, '><')); // treść skryptów nie jest odnośnikami
  const problems = [];
  if (!/<html lang="pl">/.test(html)) problems.push('brak lang');
  if (!/<title>[^<]{5,70}<\/title>/.test(html)) problems.push('tytuł');
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) problems.push('liczba h1 ≠ 1');
  if (file !== 'panel.html' && !/<meta name="description" content="[^"]{20,200}">/.test(html)) problems.push('opis');
  if (!/<meta name="viewport"/.test(html)) problems.push('viewport');

  const seen = new Set();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) { if (seen.has(m[1])) problems.push('powtórzone id: ' + m[1]); seen.add(m[1]); }

  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="/.test(m[0])) problems.push('obraz bez alt');
    if (/\ssrc="media\//.test(m[0]) && /class="shot"|srcset/.test(html) && /srcset/.test(m[0]) && !/\swidth="\d+"\s+height="\d+"/.test(m[0])) problems.push('obraz bez wymiarów');
  }

  // lokalne odnośniki i pliki
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|data:|api\/|auth\/)/.test(url)) continue; // api/ i auth/ obsługuje backend
    const [beforeHash, hash] = url.split('#');
    const target = beforeHash.split('?')[0];
    const targetFile = target === '' || target === './' ? (target === '' ? file : 'index.html') : target;
    if (!existsSync(path.join(ROOT, targetFile))) { problems.push('nie ma pliku: ' + url); continue; }
    if (hash && targetFile.endsWith('.html') && !ids[targetFile].has(hash)) problems.push('nie ma kotwicy: ' + url);
    // skrót w adresie musi odpowiadać treści pliku (inaczej build jest nieaktualny)
    const ver = /\?v=([a-f0-9]+)/.exec(url);
    if (ver && createHash('sha256').update(readFileSync(path.join(ROOT, targetFile))).digest('hex').slice(0, 10) !== ver[1]) problems.push('nieaktualny build: ' + targetFile);
  }
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) for (const part of m[1].split(',')) { const f = part.trim().split(/\s+/)[0]; if (!existsSync(path.join(ROOT, f))) problems.push('nie ma pliku: ' + f); }

  // przyciski i linki muszą mieć nazwę
  for (const m of html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const text = m[3].replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').trim();
    if (!text && !/aria-label="[^"]+"/.test(m[2])) problems.push(`<${m[1]}> bez nazwy`);
  }
  check(file, problems.length === 0, [...new Set(problems)].join('; '));
}

// waga: to, co przeglądarka musi pobrać, żeby pokazać stronę główną (bez obrazów i fontów)
const kb = (f) => gzipSync(readFileSync(path.join(ROOT, f))).length / 1024;
const core = kb('index.html') + kb('styles.css') + kb('script.js');
check(`waga HTML + CSS + JS strony głównej: ${core.toFixed(1)} KB po kompresji (limit 60)`, core < 60);
const fonts = readdirSync(path.join(ROOT, 'fonts')).reduce((a, f) => a + readFileSync(path.join(ROOT, 'fonts', f)).length, 0) / 1024;
check(`fonty: ${fonts.toFixed(0)} KB (limit 200)`, fonts < 200);
for (const f of readdirSync(path.join(ROOT, 'media'))) { const size = readFileSync(path.join(ROOT, 'media', f)).length / 1024; check(`media/${f}: ${size.toFixed(0)} KB (limit 250)`, size < 250); }
check('mapa strony i manifest istnieją', existsSync(path.join(ROOT, 'sitemap.xml')) && existsSync(path.join(ROOT, 'manifest.webmanifest')) && existsSync(path.join(ROOT, 'icon-180.png')));
check('w stylach nie ma warstw „wersja N”', !/===== wersja/.test(read('styles.css')));

console.log(`\n${passed} ok, ${failed} błędów`);
process.exit(failed ? 1 : 0);
