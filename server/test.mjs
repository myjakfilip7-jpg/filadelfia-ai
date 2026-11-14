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
const USERS = { 'kod-wlasciciel': 'Wlasciciel', 'kod-obcy': 'ktos-inny', 'kod-pracownik': 'Pracownik1', 'kod-widz': 'Widz' };
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
  const afterStatus = (await (await get('/api/zgloszenia', { headers: { cookie: a.cookie } })).json()).zgloszenia[0];
  check('zmiana statusu trafia do historii z loginem', afterStatus.historia.length === 1 && afterStatus.historia[0].kto === 'Wlasciciel' && afterStatus.historia[0].co === 'status: nowe → w toku');
  check('nowe zgłoszenie jest nieprzeczytane', row.przeczytane === false);
  check('oznaczenie jako przeczytane', (await (await get('/api/zgloszenia/' + row.id, { method: 'PATCH', headers: auth, body: '{"przeczytane":true}' })).json()).przeczytane === true);
  check('pusty PATCH → 422', (await get('/api/zgloszenia/' + row.id, { method: 'PATCH', headers: auth, body: '{}' })).status === 422);
  const noted = await (await get('/api/zgloszenia/' + row.id + '/notatki', { method: 'POST', headers: auth, body: JSON.stringify({ tekst: ' Zadzwonić w piątek ' }) })).json();
  check('notatka dodana z autorem', noted.notatki.length === 1 && noted.notatki[0].tekst === 'Zadzwonić w piątek' && noted.notatki[0].kto === 'Wlasciciel');
  check('pusta notatka → 422', (await get('/api/zgloszenia/' + row.id + '/notatki', { method: 'POST', headers: auth, body: '{"tekst":"  "}' })).status === 422);
  check('notatka bez sesji → 401', (await get('/api/zgloszenia/' + row.id + '/notatki', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-fila': '1' }, body: '{"tekst":"x"}' })).status === 401);
  check('notatka z obcego źródła → 403', (await get('/api/zgloszenia/' + row.id + '/notatki', { method: 'POST', headers: { ...auth, Origin: 'https://zla-strona.example' }, body: '{"tekst":"x"}' })).status === 403);
  const csvNo = await get('/api/zgloszenia.csv');
  check('eksport CSV bez sesji → 401', csvNo.status === 401);
  const csvRes = await get('/api/zgloszenia.csv', { headers: { cookie: a.cookie } });
  const csv = await csvRes.text();
  check('eksport CSV: nagłówki i treść', csvRes.status === 200 && /text\/csv/.test(csvRes.headers.get('content-type')) && csv.includes('"Anna"') && csv.includes('Zadzwonić w piątek'), csv.slice(0, 200));
  check('usunięcie notatki', (await (await get('/api/zgloszenia/' + row.id + '/notatki/' + noted.notatki[0].id, { method: 'DELETE', headers: auth })).json()).notatki.length === 0);
  check('usunięcie nieistniejącej notatki → 404', (await get('/api/zgloszenia/' + row.id + '/notatki/nie-ma', { method: 'DELETE', headers: auth })).status === 404);
  const panelRes = await get('/panel.html');
  check('panel ma ścisłą politykę CSP i nie jest buforowany', /script-src 'self'/.test(panelRes.headers.get('content-security-policy') || '') && panelRes.headers.get('cache-control') === 'no-store');
  check('błędny status → 422', (await get('/api/zgloszenia/' + row.id, { method: 'PATCH', headers: auth, body: '{"status":"hack"}' })).status === 422);
  check('zmiana bez nagłówka x-fila → 403', (await get('/api/zgloszenia/' + row.id, { method: 'PATCH', headers: { cookie: a.cookie, 'Content-Type': 'application/json' }, body: '{"status":"zamknięte"}' })).status === 403);
  // role
  const usersApi = (method, pth, body, cookie = a.cookie) => get('/api/uzytkownicy' + pth, { method, headers: { cookie, 'Content-Type': 'application/json', 'x-fila': '1' }, body: body ? JSON.stringify(body) : undefined });
  check('pracownik przed dodaniem nie ma dostępu', (await login('kod-pracownik')).cb.headers.get('location') === '/panel.html?blad=brak-dostepu');
  check('api/me właściciela zwraca rolę i uprawnienia', await (async () => { const d = await (await get('/api/me', { headers: { cookie: a.cookie } })).json(); return d.rola === 'wlasciciel' && d.moze.includes('uzytkownicy'); })());
  check('dodanie pracownika → 201', (await usersApi('POST', '', { login: 'Pracownik1', rola: 'pracownik' })).status === 201);
  check('dodanie widza → 201', (await usersApi('POST', '', { login: '@Widz', rola: 'podglad' })).status === 201);
  check('duplikat → 409', (await usersApi('POST', '', { login: 'pracownik1', rola: 'podglad' })).status === 409);
  check('zły login → 422', (await usersApi('POST', '', { login: 'zły login!', rola: 'podglad' })).status === 422);
  check('nieznana rola → 422', (await usersApi('POST', '', { login: 'ktos', rola: 'admin' })).status === 422);
  check('stałego właściciela nie da się zmienić → 409', (await usersApi('PATCH', '/wlasciciel', { rola: 'podglad' })).status === 409);
  check('dodanie użytkownika z obcego źródła → 403', (await get('/api/uzytkownicy', { method: 'POST', headers: { cookie: a.cookie, 'Content-Type': 'application/json', 'x-fila': '1', Origin: 'https://zla-strona.example' }, body: '{"login":"x","rola":"podglad"}' })).status === 403);
  const prac = await login('kod-pracownik'), widz = await login('kod-widz');
  const as = (c) => ({ cookie: c, 'Content-Type': 'application/json', 'x-fila': '1' });
  check('pracownik loguje się i ma rolę pracownik', (await (await get('/api/me', { headers: { cookie: prac.cookie } })).json()).rola === 'pracownik');
  check('pracownik zmienia status', (await get('/api/zgloszenia/' + row.id, { method: 'PATCH', headers: as(prac.cookie), body: '{"status":"zamknięte"}' })).status === 200);
  check('pracownik nie usuwa → 403', (await get('/api/zgloszenia/' + row.id, { method: 'DELETE', headers: as(prac.cookie) })).status === 403);
  check('pracownik nie eksportuje → 403', (await get('/api/zgloszenia.csv', { headers: { cookie: prac.cookie } })).status === 403);
  check('pracownik nie widzi użytkowników → 403', (await usersApi('GET', '', null, prac.cookie)).status === 403);
  check('pracownik nie doda użytkownika → 403', (await usersApi('POST', '', { login: 'kolega', rola: 'wlasciciel' }, prac.cookie)).status === 403);
  check('widz czyta listę', (await get('/api/zgloszenia', { headers: { cookie: widz.cookie } })).status === 200);
  check('widz nie zmienia statusu → 403', (await get('/api/zgloszenia/' + row.id, { method: 'PATCH', headers: as(widz.cookie), body: '{"status":"nowe"}' })).status === 403);
  check('widz nie doda notatki → 403', (await get('/api/zgloszenia/' + row.id + '/notatki', { method: 'POST', headers: as(widz.cookie), body: '{"tekst":"x"}' })).status === 403);
  check('zmiana roli pracownika na podgląd', (await usersApi('PATCH', '/pracownik1', { rola: 'podglad' })).status === 200);
  check('zmiana roli działa od razu na trwającą sesję', (await get('/api/zgloszenia/' + row.id, { method: 'PATCH', headers: as(prac.cookie), body: '{"status":"nowe"}' })).status === 403);
  check('usunięcie widza', (await usersApi('DELETE', '/widz')).status === 200);
  check('usunięty użytkownik traci sesję od razu → 401', (await get('/api/me', { headers: { cookie: widz.cookie } })).status === 401);
  const ul = await (await usersApi('GET', '')).json();
  check('lista użytkowników: stały właściciel i ostatnie logowanie', ul.uzytkownicy.length === 2 && ul.uzytkownicy[0].staly === true && Boolean(ul.uzytkownicy[0].ostatnie) && ul.uzytkownicy[1].login === 'Pracownik1');

  // odsłony
  const UA1 = 'Mozilla/5.0 (Macintosh) Safari/605', UA2 = 'Mozilla/5.0 (Windows NT 10.0) Chrome/130';
  const view = (body, headers = {}) => get('/api/odslona', { method: 'POST', headers: { 'User-Agent': UA1, ...headers }, body: JSON.stringify(body) });
  const todayStats = async () => { const d = await (await get('/api/statystyki?dni=7', { headers: { cookie: a.cookie } })).json(); return { ...d.dni[d.dni.length - 1], strony: d.strony, zrodla: d.zrodla, n: d.dni.length }; };
  check('statystyki bez sesji → 401', (await get('/api/statystyki')).status === 401);
  check('odsłona przyjęta → 204', (await view({ sciezka: '/', ref: 'https://www.google.com/search?q=x' })).status === 204);
  await view({ sciezka: '/kampanie.html', ref: '' });
  await view({ sciezka: '/', ref: '' }, { 'User-Agent': UA2 });
  await view({ sciezka: '/', ref: '' }, { 'User-Agent': 'Googlebot/2.1' });
  await view({ sciezka: '/', ref: '' }, { DNT: '1' });
  await view({ sciezka: '/', ref: '' }, { cookie: a.cookie });
  await view({ sciezka: '/<script>', ref: '' });
  await view({ sciezka: '/panel.html', ref: '' });
  await view({ sciezka: '/', ref: '' }, { Origin: 'https://zla-strona.example' });
  const t = await todayStats();
  check('liczone 3 odsłony i 2 unikalnych (bot, DNT, panel, zła ścieżka, obce źródło pominięte)', t.odslony === 3 && t.unikalni === 2 && t.n === 7, JSON.stringify(t));
  check('strony i źródła zsumowane', t.strony[0].nazwa === '/' && t.strony[0].liczba === 2 && t.zrodla.some((z) => z.nazwa === 'google.com' && z.liczba === 1) && t.zrodla.some((z) => z.nazwa === 'bezpośrednio'), JSON.stringify(t));
  check('widok statystyk dostępny dla każdej roli', (await get('/api/statystyki', { headers: { cookie: prac.cookie } })).status === 200);
  const home = await (await get('/')).text();
  check('strona z serwera ma znacznik API, panel nie', home.includes('name="fila-api"') && !(await (await get('/panel.html')).text()).includes('fila-api'));

  check('usunięcie z obcego źródła → 403', (await get('/api/zgloszenia/' + row.id, { method: 'DELETE', headers: { ...auth, Origin: 'https://zla-strona.example' } })).status === 403);
  check('usunięcie bez sesji → 401', (await get('/api/zgloszenia/' + row.id, { method: 'DELETE', headers: { 'x-fila': '1' } })).status === 401);
  check('usunięcie przez właściciela', (await get('/api/zgloszenia/' + row.id, { method: 'DELETE', headers: auth })).status === 200);
  check('po usunięciu lista pusta', (await (await get('/api/zgloszenia', { headers: { cookie: a.cookie } })).json()).zgloszenia.length === 0);

  // limit zgłoszeń: 5 na 10 minut z jednego adresu (jedno już poszło)
  const evil = await post({ imie: '=HYPERLINK("http://x")', kontakt: 'a@example.com', opis: 'B' });
  const csv2 = await (await get('/api/zgloszenia.csv', { headers: { cookie: a.cookie } })).text();
  check('CSV: treść nie staje się formułą', evil.status === 201 && csv2.includes(`"'=HYPERLINK(""http://x"")"`), csv2.slice(0, 300));
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await post({ imie: 'A', kontakt: 'a@example.com', opis: 'B' })).status);
  check('limit zgłoszeń → 429', codes.slice(0, 3).every((c) => c === 201) && codes[3] === 429 && codes[4] === 429, codes.join(','));

  // wylogowanie
  const out = await get('/auth/logout', { method: 'POST', headers: { cookie: a.cookie } });
  check('wylogowanie czyści ciasteczko', out.status === 200 && /fila_session=;/.test(out.headers.getSetCookie().join('')));
} finally {
  app.kill(); mock.close(); await rm(dir, { recursive: true, force: true });
}
console.log(`\n${passed} ok, ${failed} błędów`);
process.exit(failed ? 1 : 0);
