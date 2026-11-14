// Backend Filadelfia.ai — logowanie przez GitHub, panel właściciela, zgłoszenia z formularza.
// Bez zależności: `node server/server.mjs`. Konfiguracja w server/.env (wzór: .env.example).
import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
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

function session(req) {
  const s = open(cookies(req).fila_session);
  // lista dopuszczonych jest sprawdzana przy każdym żądaniu: usunięcie loginu z .env od razu odbiera dostęp
  return s && ADMINS.includes(String(s.login).toLowerCase()) ? s : null;
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
let queue = Promise.resolve();
async function load() {
  try { return JSON.parse(await readFile(DATA_FILE, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
function mutate(fn) {
  const run = queue.then(async () => {
    const list = await load();
    const result = await fn(list);
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(list, null, 2));
    await rename(tmp, DATA_FILE);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}
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

/* ---------- pliki strony ---------- */
// panel nie ma skryptów ani stylów w treści strony, więc może mieć ścisłą politykę: tylko własne pliki i awatar z GitHuba
const PANEL_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self' https://avatars.githubusercontent.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
async function serveStatic(res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, 'Bad request'); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  const inside = file.startsWith(ROOT + path.sep);
  const hidden = rel.split('/').some((seg) => seg.startsWith('.')) || rel.startsWith('/server/') || rel === '/build.mjs' || rel === '/README.md';
  if (inside && !hidden) {
    try {
      const data = await readFile(file);
      const extra = rel === '/panel.html' ? { 'Cache-Control': 'no-store', 'Content-Security-Policy': PANEL_CSP } : {};
      return send(res, 200, data, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', ...extra });
    } catch { /* niżej 404 */ }
  }
  const notFound = await readFile(path.join(ROOT, '404.html')).catch(() => 'Nie znaleziono');
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
      if (!user.login || !ADMINS.includes(String(user.login).toLowerCase())) return fail('brak-dostepu');
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
    return s ? json(res, 200, { login: s.login, name: s.name, avatar: s.avatar }) : json(res, 401, { blad: 'niezalogowany', logowanie: configured });
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

  if (p.startsWith('/api/zgloszenia')) { // reszta tylko dla zalogowanego właściciela
    const me = session(req);
    if (!me) return json(res, 401, { blad: 'niezalogowany' });

    if (p === '/api/zgloszenia' && m === 'GET') {
      const list = (await load()).map(full);
      return json(res, 200, { tematy: TOPICS, statusy: STATUSES, zgloszenia: list.reverse() });
    }
    if (p === '/api/zgloszenia.csv' && m === 'GET') {
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

    if (!sub && m === 'DELETE') {
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

http.createServer((req, res) => {
  handle(req, res).catch((e) => { console.error(e); if (!res.headersSent) json(res, 500, { blad: 'serwer' }); else res.end(); });
}).listen(PORT, () => {
  console.log(`Filadelfia.ai: ${BASE_URL}  ·  panel: ${BASE_URL}/panel.html`);
  if (!configured) console.log('Logowanie wyłączone: uzupełnij GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET i ADMIN_GITHUB_LOGINS w server/.env.');
});
