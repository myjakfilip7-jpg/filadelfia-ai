// Backend Filadelfia.ai — logowanie przez GitHub, role, panel, zgłoszenia z formularza, anonimowy licznik odsłon.
// Bez zależności: `node server/server.mjs`. Konfiguracja w server/.env (wzór: .env.example).
import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..'); // katalog ze stroną
try { process.loadEnvFile(path.join(HERE, '.env')); } catch { /* brak .env: zostają zmienne środowiska */ }

const env = process.env;
const PORT = Number(env.PORT || 8787);
const BASE_URL = (env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ORIGIN = new URL(BASE_URL).origin;
const SECURE = BASE_URL.startsWith('https://');
const SECRET = env.SESSION_SECRET || '';
const CLIENT_ID = env.GITHUB_CLIENT_ID || '';
const CLIENT_SECRET = env.GITHUB_CLIENT_SECRET || '';
const ADMINS = (env.ADMIN_GITHUB_LOGINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const GH_WEB = (env.GITHUB_WEB_BASE || 'https://github.com').replace(/\/$/, '');
const GH_API = (env.GITHUB_API_BASE || 'https://api.github.com').replace(/\/$/, '');
const DATA_FILE = env.DATA_FILE || path.join(HERE, 'data', 'zgloszenia.json');
const USERS_FILE = env.USERS_FILE || path.join(path.dirname(DATA_FILE), 'uzytkownicy.json');
const VIEWS_FILE = env.VIEWS_FILE || path.join(path.dirname(DATA_FILE), 'odslony.json');
const SESSION_DAYS = 7;

if (SECRET.length < 32) {
  console.error('Brak SESSION_SECRET (min. 32 znaki) w server/.env. Wygeneruj: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}
const configured = Boolean(CLIENT_ID && CLIENT_SECRET && ADMINS.length);

/* ---------- podpisane ciasteczka (HMAC-SHA256) ---------- */
const b64 = (buf) => Buffer.from(buf).toString('base64url');
const mac = (text) => createHmac('sha256', SECRET).update(text).digest('base64url');
function seal(obj, seconds) {
  const body = b64(JSON.stringify({ ...obj, exp: Math.floor(Date.now() / 1000) + seconds }));
  return `${body}.${mac(body)}`;
}
function open(token) {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot), given = Buffer.from(token.slice(dot + 1)), want = Buffer.from(mac(body));
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  try {
    const obj = JSON.parse(Buffer.from(body, 'base64url').toString());
    return obj.exp > Date.now() / 1000 ? obj : null;
  } catch { return null; }
}
function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
const cookie = (name, value, maxAge) => `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE ? '; Secure' : ''}`;

/* ---------- role ---------- */
// Właściciele z .env są stali (nie da się ich usunąć z panelu). Pozostałych dodaje właściciel w panelu.
const ROLES = { wlasciciel: 'Właściciel', pracownik: 'Pracownik', podglad: 'Podgląd' };
const CAN = {
  wlasciciel: ['czytac', 'zmieniac', 'usuwac', 'eksport', 'uzytkownicy'],
  pracownik: ['czytac', 'zmieniac'],
  podglad: ['czytac'],
};
let people = { uzytkownicy: [], logowania: {} }; // kopia pliku w pamięci, odświeżana przy każdym zapisie
const lower = (v) => String(v || '').toLowerCase();
function roleOf(login) {
  const l = lower(login);
  if (!l) return null;
  if (ADMINS.includes(l)) return 'wlasciciel';
  const u = people.uzytkownicy.find((x) => lower(x.login) === l);
  return u && ROLES[u.rola] ? u.rola : null;
}
function session(req) {
  const s = open(cookies(req).fila_session);
  if (!s) return null;
  // rola jest ustalana przy każdym żądaniu: zmiana albo odebranie dostępu działa od razu, bez czekania na koniec sesji
  const rola = roleOf(s.login);
  return rola ? { ...s, rola, moze: CAN[rola] } : null;
}

/* ---------- odpowiedzi ---------- */
const BASE_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' };
function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...BASE_HEADERS, ...headers });
  res.end(body);
}
const json = (res, status, obj, headers = {}) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
const redirect = (res, to, setCookie) => send(res, 302, '', { Location: to, 'Cache-Control': 'no-store', ...(setCookie ? { 'Set-Cookie': setCookie } : {}) });

function readJson(req, limit = 20000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    // po przekroczeniu limitu przestajemy zbierać dane, ale pozwalamy klientowi dostać odpowiedź 413;
    // dopiero przy naprawdę dużym strumieniu zrywamy połączenie
    req.on('data', (c) => { size += c.length; if (size > limit) { chunks.length = 0; reject(new Error('za-duze')); if (size > 1e6) req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch { reject(new Error('zly-json')); } });
    req.on('error', reject);
  });
}
// żądania zmieniające dane muszą przyjść z naszej strony (ochrona przed CSRF)
const sameOrigin = (req) => !req.headers.origin || req.headers.origin === ORIGIN;

/* ---------- zgłoszenia: plik JSON, zapisy po kolei ---------- */
const TOPICS = { kampanie: 'Kampanie reklamowe AI', automatyzacje: 'Agenci i automatyzacje', chatboty: 'Chatboty AI', strony: 'Strony, aplikacje, sklepy', inne: 'Jeszcze nie wiem' };
const STATUSES = ['nowe', 'w toku', 'zamknięte'];
// Mały magazyn na pliku JSON: odczyt, a zmiany jedna po drugiej, zapisywane przez plik tymczasowy.
function store(file, blank) {
  let queue = Promise.resolve();
  const load = async () => { try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return blank(); throw e; } };
  const mutate = (fn) => {
    const run = queue.then(async () => {
      const data = await load();
      const result = await fn(data);
      await mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(data, null, 2));
      await rename(tmp, file);
      return { result, data };
    });
    queue = run.catch(() => {});
    return run;
  };
  return { load, mutate };
}
const leads = store(DATA_FILE, () => []);
const load = leads.load;
const mutate = (fn) => leads.mutate(fn).then((r) => r.result);
const users = store(USERS_FILE, () => ({ uzytkownicy: [], logowania: {} }));
const saveUsers = (fn) => users.mutate(fn).then((r) => { people = r.data; return r.result; });
// starsze wpisy mogą nie mieć nowszych pól
const full = (r) => ({ ...r, kontakt: r.kontakt || '', przeczytane: Boolean(r.przeczytane), notatki: r.notatki || [], historia: r.historia || [] });
// komórka CSV: cudzysłowy podwojone, a treść zaczynająca się od = + - @ nie może stać się formułą w arkuszu
const csvCell = (v) => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

// najwyżej 5 zgłoszeń na 10 minut z jednego adresu
const hits = new Map();
function limited(ip) {
  const now = Date.now(), recent = (hits.get(ip) || []).filter((t) => now - t < 600000);
  if (recent.length >= 5) { hits.set(ip, recent); return true; }
  recent.push(now); hits.set(ip, recent);
  return false;
}

/* ---------- licznik odsłon: bez plików cookie, bez zapisywania adresu IP ---------- */
// Zapisujemy tylko sumy na dzień. „Unikalni” to liczba różnych skrótów (adres + przeglądarka + sól dnia);
// sól i skróty żyją tylko w pamięci i znikają o północy albo przy restarcie.
let viewsData = { dni: {} }, viewsDirty = false;
let today = { day: '', salt: '', seen: new Set() };
const dayFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' });
const dayKey = (d = new Date()) => dayFmt.format(d);
const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|node-fetch|^node$|undici/i;
const beacons = new Map();
function flushViews() {
  if (!viewsDirty) return;
  viewsDirty = false;
  try { mkdirSync(path.dirname(VIEWS_FILE), { recursive: true }); writeFileSync(VIEWS_FILE, JSON.stringify(viewsData)); } catch (e) { console.error('Odsłony:', e.message); }
}
setInterval(flushViews, 5000).unref();
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flushViews(); process.exit(0); });

function countView(req, body) {
  const ua = String(req.headers['user-agent'] || '');
  if (!ua || BOTS.test(ua)) return 'bot';
  if (req.headers.dnt === '1' || req.headers['sec-gpc'] === '1') return 'dnt'; // prośba „nie śledź” jest szanowana
  if (session(req)) return 'panel'; // własnych wejść nie liczymy
  let page = clean(body.sciezka, 120).replace(/index\.html$/, '');
  if (!/^\/[a-z0-9\-_.\/]*$/i.test(page) || page === '/panel.html') return 'sciezka';
  const ip = req.socket.remoteAddress || '?', now = Date.now();
  const recent = (beacons.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= 120) return 'limit';
  recent.push(now); beacons.set(ip, recent);

  const day = dayKey();
  if (today.day !== day) today = { day, salt: randomBytes(16).toString('hex'), seen: new Set() };
  const d = viewsData.dni[day] || (viewsData.dni[day] = { odslony: 0, unikalni: 0, strony: {}, zrodla: {} });
  d.odslony++;
  if (page in d.strony || Object.keys(d.strony).length < 200) d.strony[page] = (d.strony[page] || 0) + 1;
  const who = createHash('sha256').update(today.salt + ip + ua).digest('base64url');
  if (!today.seen.has(who)) {
    today.seen.add(who); d.unikalni++;
    let src = 'bezpośrednio';
    try { const h = new URL(String(body.ref || '')).host.toLowerCase().replace(/^www\./, ''); if (h && h !== new URL(BASE_URL).host) src = h.slice(0, 80); } catch { /* brak albo zły adres: wejście bezpośrednie */ }
    if (src in d.zrodla || Object.keys(d.zrodla).length < 200) d.zrodla[src] = (d.zrodla[src] || 0) + 1;
  }
  const keys = Object.keys(viewsData.dni).sort();
  while (keys.length > 400) delete viewsData.dni[keys.shift()];
  viewsDirty = true;
  return 'ok';
}
function stats(days) {
  const out = [], pages = {}, sources = {};
  let views = 0, uniq = 0;
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(new Date(Date.now() - i * 86400000)), d = viewsData.dni[key] || { odslony: 0, unikalni: 0, strony: {}, zrodla: {} };
    out.push({ dzien: key, odslony: d.odslony, unikalni: d.unikalni });
    views += d.odslony; uniq += d.unikalni;
    for (const [k, v] of Object.entries(d.strony)) pages[k] = (pages[k] || 0) + v;
    for (const [k, v] of Object.entries(d.zrodla)) sources[k] = (sources[k] || 0) + v;
  }
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([nazwa, liczba]) => ({ nazwa, liczba }));
  return { dni: out, razem: { odslony: views, unikalni: uniq }, strony: top(pages), zrodla: top(sources) };
}

/* ---------- pliki strony ---------- */
// panel nie ma skryptów ani stylów w treści strony, więc może mieć ścisłą politykę: tylko własne pliki i awatar z GitHuba
const PANEL_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self' https://avatars.githubusercontent.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
const API_MARK = '<meta name="fila-api" content="1">';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml; charset=utf-8' };
async function serveStatic(res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, 'Bad request'); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  const inside = file.startsWith(ROOT + path.sep);
  const hidden = rel.split('/').some((seg) => seg.startsWith('.')) || rel.startsWith('/server/') || rel.startsWith('/tools/') || rel === '/build.mjs' || rel === '/README.md';
  if (inside && !hidden) {
    try {
      let data = await readFile(file);
      const extra = rel === '/panel.html' ? { 'Cache-Control': 'no-store', 'Content-Security-Policy': PANEL_CSP } : {};
      // strony podawane przez ten serwer dostają znacznik, po którym skrypt wie, że może korzystać z API
      if (rel.endsWith('.html') && rel !== '/panel.html') data = data.toString().replace('</head>', API_MARK + '</head>');
      return send(res, 200, data, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', ...extra });
    } catch { /* niżej 404 */ }
  }
  const notFound = (await readFile(path.join(ROOT, '404.html'), 'utf8').catch(() => 'Nie znaleziono')).replace('</head>', API_MARK + '</head>');
  send(res, 404, notFound, { 'Content-Type': 'text/html; charset=utf-8' });
}

/* ---------- trasy ---------- */
async function handle(req, res) {
  const url = new URL(req.url, BASE_URL);
  const p = url.pathname, m = req.method;

  if (p === '/api/health' && m === 'GET') return json(res, 200, { ok: true, logowanie: configured });

  /* --- logowanie przez GitHub --- */
  if (p === '/auth/github' && m === 'GET') {
    if (!configured) return send(res, 503, 'Logowanie nie jest skonfigurowane. Uzupełnij GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET i ADMIN_GITHUB_LOGINS w server/.env.', { 'Content-Type': 'text/plain; charset=utf-8' });
    const state = randomBytes(24).toString('base64url');
    const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: `${BASE_URL}/auth/github/callback`, scope: 'read:user', state, allow_signup: 'false' });
    return redirect(res, `${GH_WEB}/login/oauth/authorize?${q}`, cookie('fila_state', seal({ state }, 600), 600));
  }

  if (p === '/auth/github/callback' && m === 'GET') {
    const fail = (why) => redirect(res, `/panel.html?blad=${why}`, cookie('fila_state', '', 0));
    if (!configured) return fail('konfiguracja');
    if (url.searchParams.get('error')) return fail('odmowa');
    const saved = open(cookies(req).fila_state), state = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
    if (!saved || !code || saved.state.length !== state.length || !timingSafeEqual(Buffer.from(saved.state), Buffer.from(state))) return fail('stan');
    try {
      const tokenRes = await fetch(`${GH_WEB}/login/oauth/access_token`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: `${BASE_URL}/auth/github/callback` }),
        signal: AbortSignal.timeout(10000),
      });
      const token = (await tokenRes.json()).access_token;
      if (!token) return fail('github');
      const userRes = await fetch(`${GH_API}/user`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'filadelfia-ai-panel' }, signal: AbortSignal.timeout(10000) });
      if (!userRes.ok) return fail('github');
      const user = await userRes.json();
      // token GitHuba służy tylko do sprawdzenia, kim jesteś — nigdzie go nie zapisujemy
      if (!user.login || !roleOf(user.login)) return fail('brak-dostepu');
      await saveUsers((d) => { d.logowania[lower(user.login)] = new Date().toISOString(); });
      const sess = seal({ login: user.login, name: clean(user.name || user.login, 80), avatar: clean(user.avatar_url, 300) }, SESSION_DAYS * 86400);
      res.writeHead(302, { ...BASE_HEADERS, Location: '/panel.html', 'Cache-Control': 'no-store', 'Set-Cookie': [cookie('fila_session', sess, SESSION_DAYS * 86400), cookie('fila_state', '', 0)] });
      return res.end();
    } catch (e) {
      console.error('Logowanie:', e.message);
      return fail('github');
    }
  }

  if (p === '/auth/logout' && m === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { blad: 'obce-zrodlo' });
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookie('fila_session', '', 0) });
  }

  if (p === '/api/me' && m === 'GET') {
    const s = session(req);
    return s ? json(res, 200, { login: s.login, name: s.name, avatar: s.avatar, rola: s.rola, moze: s.moze, role: ROLES }) : json(res, 401, { blad: 'niezalogowany', logowanie: configured });
  }

  /* --- zgłoszenia --- */
  if (p === '/api/zgloszenia' && m === 'POST') { // publiczne: formularz kontaktowy
    if (!sameOrigin(req)) return json(res, 403, { blad: 'obce-zrodlo' });
    const ip = req.socket.remoteAddress || '?';
    let body;
    try { body = await readJson(req); } catch (e) { return json(res, e.message === 'za-duze' ? 413 : 400, { blad: e.message }); }
    if (clean(body.www, 10)) return json(res, 200, { ok: true }); // pole-pułapka: bot dostaje „ok”, nic nie zapisujemy
    const item = { temat: TOPICS[body.temat] ? body.temat : 'inne', imie: clean(body.imie, 80), firma: clean(body.firma, 120), kontakt: clean(body.kontakt, 160), opis: clean(body.opis, 4000) };
    if (!item.imie || !item.opis || !item.kontakt) return json(res, 422, { blad: 'brak-pol' });
    if (limited(ip)) return json(res, 429, { blad: 'za-czesto' });
    const saved = await mutate((list) => { const row = { id: randomUUID(), at: new Date().toISOString(), status: 'nowe', przeczytane: false, ...item, notatki: [], historia: [] }; list.push(row); return row; });
    return json(res, 201, { ok: true, id: saved.id });
  }

  /* --- licznik odsłon (publiczny) i statystyki (dla zalogowanych) --- */
  if (p === '/api/odslona' && m === 'POST') {
    if (sameOrigin(req)) { try { countView(req, await readJson(req, 2000)); } catch { /* zły albo za duży pakiet: pomijamy */ } }
    return send(res, 204, '');
  }
  if (p === '/api/statystyki' && m === 'GET') {
    if (!session(req)) return json(res, 401, { blad: 'niezalogowany' });
    const days = [7, 30, 90].includes(Number(url.searchParams.get('dni'))) ? Number(url.searchParams.get('dni')) : 30;
    return json(res, 200, stats(days));
  }

  /* --- użytkownicy i role (tylko właściciel) --- */
  if (p === '/api/uzytkownicy' || p.startsWith('/api/uzytkownicy/')) {
    const me = session(req);
    if (!me) return json(res, 401, { blad: 'niezalogowany' });
    if (!me.moze.includes('uzytkownicy')) return json(res, 403, { blad: 'brak-uprawnien' });
    const listing = () => ({
      role: ROLES,
      uzytkownicy: [
        ...ADMINS.map((login) => ({ login, rola: 'wlasciciel', staly: true, ostatnie: people.logowania[login] || null })),
        ...people.uzytkownicy.filter((u) => !ADMINS.includes(lower(u.login))).map((u) => ({ login: u.login, rola: u.rola, staly: false, dodal: u.dodal, at: u.at, ostatnie: people.logowania[lower(u.login)] || null })),
      ],
    });
    if (p === '/api/uzytkownicy' && m === 'GET') return json(res, 200, listing());
    if (!sameOrigin(req) || req.headers['x-fila'] !== '1') return json(res, 403, { blad: 'obce-zrodlo' });
    const target = lower(decodeURIComponent(p.slice('/api/uzytkownicy/'.length)));
    let body = {};
    if (m === 'POST' || m === 'PATCH') { try { body = await readJson(req, 2000); } catch { return json(res, 400, { blad: 'zly-json' }); } }
    if (p === '/api/uzytkownicy' && m === 'POST') {
      const login = clean(body.login, 40).replace(/^@/, '');
      if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(login)) return json(res, 422, { blad: 'zly-login' });
      if (!ROLES[body.rola]) return json(res, 422, { blad: 'zla-rola' });
      if (roleOf(login)) return json(res, 409, { blad: 'juz-jest' });
      if (people.uzytkownicy.length >= 50) return json(res, 422, { blad: 'za-duzo' });
      await saveUsers((d) => { d.uzytkownicy.push({ login, rola: body.rola, dodal: me.login, at: new Date().toISOString() }); });
      return json(res, 201, listing());
    }
    if (target && (m === 'PATCH' || m === 'DELETE')) {
      if (ADMINS.includes(target)) return json(res, 409, { blad: 'staly-wlasciciel' }); // tych zmienia się tylko w .env
      if (!people.uzytkownicy.some((u) => lower(u.login) === target)) return json(res, 404, { blad: 'nie-ma' });
      if (m === 'PATCH' && !ROLES[body.rola]) return json(res, 422, { blad: 'zla-rola' });
      await saveUsers((d) => {
        if (m === 'DELETE') d.uzytkownicy = d.uzytkownicy.filter((u) => lower(u.login) !== target);
        else d.uzytkownicy.find((u) => lower(u.login) === target).rola = body.rola;
      });
      return json(res, 200, listing());
    }
    return json(res, 405, { blad: 'metoda' });
  }

  if (p.startsWith('/api/zgloszenia')) { // zgłoszenia: każda rola czyta, zmiany według uprawnień
    const me = session(req);
    if (!me) return json(res, 401, { blad: 'niezalogowany' });

    if (p === '/api/zgloszenia' && m === 'GET') {
      const list = (await load()).map(full);
      return json(res, 200, { tematy: TOPICS, statusy: STATUSES, zgloszenia: list.reverse() });
    }
    if (p === '/api/zgloszenia.csv' && m === 'GET') {
      if (!me.moze.includes('eksport')) return json(res, 403, { blad: 'brak-uprawnien' });
      const cols = ['data', 'status', 'temat', 'imie', 'firma', 'kontakt', 'opis', 'notatki'];
      const lines = (await load()).map(full).reverse().map((r) => [r.at, r.status, TOPICS[r.temat] || r.temat, r.imie, r.firma, r.kontakt, r.opis, r.notatki.map((n) => n.tekst).join(' | ')].map(csvCell).join(';'));
      return send(res, 200, '\uFEFF' + [cols.join(';'), ...lines].join('\r\n') + '\r\n', { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="zgloszenia-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' });
    }

    const [id, sub, subId] = p.slice('/api/zgloszenia/'.length).split('/');
    if (!id || !p.startsWith('/api/zgloszenia/')) return json(res, 405, { blad: 'metoda' });
    // każda zmiana musi przyjść z naszej strony i z nagłówkiem, którego obca strona nie doda
    if (!sameOrigin(req) || req.headers['x-fila'] !== '1') return json(res, 403, { blad: 'obce-zrodlo' });
    const stamp = (co) => ({ at: new Date().toISOString(), kto: me.login, co });
    const change = async (fn) => {
      const out = await mutate((list) => { const r = list.find((x) => x.id === id); if (!r) return null; Object.assign(r, full(r)); const err = fn(r); return err || full(r); });
      if (!out) return json(res, 404, { blad: 'nie-ma' });
      return out.blad ? json(res, out.kod || 422, { blad: out.blad }) : json(res, 200, out);
    };

    if (!me.moze.includes('zmieniac')) return json(res, 403, { blad: 'brak-uprawnien' });
    if (!sub && m === 'DELETE') {
      if (!me.moze.includes('usuwac')) return json(res, 403, { blad: 'brak-uprawnien' });
      const gone = await mutate((list) => { const i = list.findIndex((r) => r.id === id); if (i < 0) return false; list.splice(i, 1); return true; });
      return gone ? json(res, 200, { ok: true }) : json(res, 404, { blad: 'nie-ma' });
    }
    if (!sub && m === 'PATCH') {
      let body;
      try { body = await readJson(req); } catch { return json(res, 400, { blad: 'zly-json' }); }
      if (body.status !== undefined && !STATUSES.includes(body.status)) return json(res, 422, { blad: 'zly-status' });
      if (body.przeczytane !== undefined && typeof body.przeczytane !== 'boolean') return json(res, 422, { blad: 'zle-pole' });
      if (body.status === undefined && body.przeczytane === undefined) return json(res, 422, { blad: 'brak-zmian' });
      return change((r) => {
        if (body.status !== undefined && body.status !== r.status) { r.historia.push(stamp(`status: ${r.status} → ${body.status}`)); r.status = body.status; }
        if (body.przeczytane !== undefined) r.przeczytane = body.przeczytane;
      });
    }
    if (sub === 'notatki' && !subId && m === 'POST') {
      let body;
      try { body = await readJson(req); } catch { return json(res, 400, { blad: 'zly-json' }); }
      const tekst = clean(body.tekst, 2000);
      if (!tekst) return json(res, 422, { blad: 'pusta-notatka' });
      return change((r) => { if (r.notatki.length >= 200) return { blad: 'za-duzo-notatek' }; r.notatki.push({ id: randomUUID(), at: new Date().toISOString(), kto: me.login, tekst }); });
    }
    if (sub === 'notatki' && subId && m === 'DELETE') {
      return change((r) => { const i = r.notatki.findIndex((n) => n.id === subId); if (i < 0) return { blad: 'nie-ma', kod: 404 }; r.notatki.splice(i, 1); });
    }
    return json(res, 405, { blad: 'metoda' });
  }

  if (p.startsWith('/api/') || p.startsWith('/auth/')) return json(res, 404, { blad: 'nie-ma' });
  if (m !== 'GET' && m !== 'HEAD') return send(res, 405, 'Method not allowed');
  return serveStatic(res, p);
}

people = await users.load();
try { viewsData = JSON.parse(await readFile(VIEWS_FILE, 'utf8')); } catch { /* pierwszy start: brak pliku */ }

http.createServer((req, res) => {
  handle(req, res).catch((e) => { console.error(e); if (!res.headersSent) json(res, 500, { blad: 'serwer' }); else res.end(); });
}).listen(PORT, () => {
  console.log(`Filadelfia.ai: ${BASE_URL}  ·  panel: ${BASE_URL}/panel.html`);
  if (!configured) console.log('Logowanie wyłączone: uzupełnij GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET i ADMIN_GITHUB_LOGINS w server/.env.');
});
