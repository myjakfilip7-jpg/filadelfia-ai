// Test całego przepływu bez prawdziwego GitHuba: `node server/test.mjs`.
// Uruchamia atrapę GitHuba i serwer na losowych portach, z tymczasowym plikiem danych.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
const check = (name, ok, extra = '') => { ok ? passed++ : failed++; console.log(`${ok ? '  ok ' : 'BŁĄD '} ${name}${ok ? '' : '  ' + extra}`); };
const port = (srv) => new Promise((r) => srv.listen(0, () => r(srv.address().port)));

// atrapa GitHuba: kod → token → użytkownik
const USERS = { 'kod-wlasciciel': 'Wlasciciel', 'kod-obcy': 'ktos-inny' };
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/login/oauth/access_token') {
      const { code, client_secret } = JSON.parse(body);
      return res.end(JSON.stringify(USERS[code] && client_secret === 'sekret-testowy' ? { access_token: 'tok-' + USERS[code] } : { error: 'bad_verification_code' }));
    }
    if (req.url === '/user') {
      const login = (req.headers.authorization || '').replace('Bearer tok-', '');
      return res.end(JSON.stringify({ login, name: 'Test', avatar_url: 'https://example.invalid/a.png' }));
    }
    res.statusCode = 404; res.end('{}');
  });
});
const mockPort = await port(mock);
const probe = http.createServer(); const appPort = await port(probe); await new Promise((r) => probe.close(r));
const dir = await mkdtemp(path.join(tmpdir(), 'fila-test-'));
const BASE = `http://localhost:${appPort}`;

const app = spawn(process.execPath, [path.join(HERE, 'server.mjs')], {
  env: { ...process.env, PORT: String(appPort), BASE_URL: BASE, SESSION_SECRET: 'x'.repeat(48), GITHUB_CLIENT_ID: 'id-testowe', GITHUB_CLIENT_SECRET: 'sekret-testowy', ADMIN_GITHUB_LOGINS: 'wlasciciel', GITHUB_WEB_BASE: `http://localhost:${mockPort}`, GITHUB_API_BASE: `http://localhost:${mockPort}`, DATA_FILE: path.join(dir, 'z.json') },
  stdio: ['ignore', 'ignore', 'inherit'],
});
for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }

const get = (p, o = {}) => fetch(BASE + p, { redirect: 'manual', ...o });
const setCookies = (res) => res.headers.getSetCookie().map((c) => c.split(';')[0]).filter((c) => !c.endsWith('=')).join('; ');
async function login(code) {
  const start = await get('/auth/github');
  const loc = new URL(start.headers.get('location'));
  const cb = await get(`/auth/github/callback?code=${code}&state=${loc.searchParams.get('state')}`, { headers: { cookie: setCookies(start) } });
  return { start, loc, cb, cookie: setCookies(cb) };
}

try {
  // strona i pliki, których nie wolno wydać
  check('strona główna', (await get('/')).status === 200);
  check('server/.env niedostępny', (await get('/server/.env')).status === 404);
  check('server/server.mjs niedostępny', (await get('/server/server.mjs')).status === 404);
  check('.git niedostępny', (await get('/.git/config')).status === 404);
  check('wyjście poza katalog zablokowane', (await get('/..%2f..%2fetc/passwd')).status === 404);

  // bez logowania
  check('api/me bez sesji → 401', (await get('/api/me')).status === 401);
  check('lista zgłoszeń bez sesji → 401', (await get('/api/zgloszenia')).status === 401);

  // formularz
  const post = (body, headers = {}) => get('/api/zgloszenia', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const made = await post({ temat: 'chatboty', imie: ' Anna ', firma: 'Gabinet', kontakt: 'anna@example.com', opis: 'Chcę bota <script>alert(1)</script>' });
  check('zgłoszenie zapisane → 201', made.status === 201);
  check('brak wymaganych pól → 422', (await post({ imie: '', opis: '' })).status === 422);
  check('brak kontaktu → 422', (await post({ imie: 'A', opis: 'B' })).status === 422);
  check('pole-pułapka: udaje sukces', (await post({ imie: 'Bot', opis: 'spam', www: 'http://x' })).status === 200);
  check('obce źródło → 403', (await post({ imie: 'A', kontakt: 'a@example.com', opis: 'B' }, { Origin: 'https://zla-strona.example' })).status === 403);
  check('za duże żądanie → 413', (await post({ imie: 'A', kontakt: 'a@example.com', opis: 'x'.repeat(30000) })).status === 413);

  // logowanie
  const a = await login('kod-wlasciciel');
  check('start przekierowuje do GitHuba', a.start.status === 302 && a.loc.pathname === '/login/oauth/authorize' && a.loc.searchParams.get('scope') === 'read:user');
  check('właściciel zalogowany → /panel.html', a.cb.status === 302 && a.cb.headers.get('location') === '/panel.html' && a.cookie.includes('fila_session='));
  check('ciasteczko sesji jest HttpOnly i SameSite', /fila_session=[^;]+;.*HttpOnly.*SameSite=Lax/.test(a.cb.headers.getSetCookie().join('\n')));
  const me = await get('/api/me', { headers: { cookie: a.cookie } });
  check('api/me zwraca login', me.status === 200 && (await me.json()).login === 'Wlasciciel');

  const b = await login('kod-obcy');
  check('obcy użytkownik GitHuba odrzucony', b.cb.headers.get('location') === '/panel.html?blad=brak-dostepu' && !b.cookie.includes('fila_session='));
  const s0 = await get('/auth/github');
  const bad = await get('/auth/github/callback?code=kod-wlasciciel&state=podrobiony', { headers: { cookie: setCookies(s0) } });
  check('podrobiony state odrzucony', bad.headers.get('location') === '/panel.html?blad=stan');
  check('callback bez ciasteczka state odrzucony', (await get('/auth/github/callback?code=kod-wlasciciel&state=abc')).headers.get('location') === '/panel.html?blad=stan');
  check('podrobiona sesja odrzucona', (await get('/api/me', { headers: { cookie: 'fila_session=' + a.cookie.split('fila_session=')[1].slice(0, -3) + 'AAA' } })).status === 401);

  // panel
  const list = await (await get('/api/zgloszenia', { headers: { cookie: a.cookie } })).json();
  const row = list.zgloszenia[0];
  check('właściciel widzi jedno zgłoszenie (pułapka i błędne pominięte)', list.zgloszenia.length === 1 && row.imie === 'Anna' && row.status === 'nowe');
  const auth = { cookie: a.cookie, 'Content-Type': 'application/json', 'x-fila': '1' };
  check('zmiana statusu', (await (await get('/api/zgloszenia/' + row.id, { method: 'PATCH', headers: auth, body: '{"status":"w toku"}' })).json()).status === 'w toku');
  check('błędny status → 422', (await get('/api/zgloszenia/' + row.id, { method: 'PATCH', headers: auth, body: '{"status":"hack"}' })).status === 422);
  check('zmiana bez nagłówka x-fila → 403', (await get('/api/zgloszenia/' + row.id, { method: 'PATCH', headers: { cookie: a.cookie, 'Content-Type': 'application/json' }, body: '{"status":"zamknięte"}' })).status === 403);
  check('usunięcie z obcego źródła → 403', (await get('/api/zgloszenia/' + row.id, { method: 'DELETE', headers: { ...auth, Origin: 'https://zla-strona.example' } })).status === 403);
  check('usunięcie bez sesji → 401', (await get('/api/zgloszenia/' + row.id, { method: 'DELETE', headers: { 'x-fila': '1' } })).status === 401);
  check('usunięcie przez właściciela', (await get('/api/zgloszenia/' + row.id, { method: 'DELETE', headers: auth })).status === 200);
  check('po usunięciu lista pusta', (await (await get('/api/zgloszenia', { headers: { cookie: a.cookie } })).json()).zgloszenia.length === 0);

  // limit zgłoszeń: 5 na 10 minut z jednego adresu (jedno już poszło)
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await post({ imie: 'A', kontakt: 'a@example.com', opis: 'B' })).status);
  check('limit zgłoszeń → 429', codes.slice(0, 4).every((c) => c === 201) && codes[4] === 429 && codes[5] === 429, codes.join(','));

  // wylogowanie
  const out = await get('/auth/logout', { method: 'POST', headers: { cookie: a.cookie } });
  check('wylogowanie czyści ciasteczko', out.status === 200 && /fila_session=;/.test(out.headers.getSetCookie().join('')));
} finally {
  app.kill(); mock.close(); await rm(dir, { recursive: true, force: true });
}
console.log(`\n${passed} ok, ${failed} błędów`);
process.exit(failed ? 1 : 0);
