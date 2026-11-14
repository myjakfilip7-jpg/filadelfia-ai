/* Filadelfia.ai — pole punktów (WebGL), odczyty, menu, wiersz poleceń, formularz. Bez zależności. */
(function () {
  'use strict';

  var root = document.documentElement, body = document.body;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NAMES = ['Tęczówka', 'Siatka', 'Przepływ', 'Sfera', 'Punkt'];
  var scenes = Array.prototype.slice.call(document.querySelectorAll('[data-scene]'));
  // podstrony mają jedną, stałą formację; strona główna zmienia ją przewijaniem
  var pin = body.hasAttribute('data-form') ? +body.getAttribute('data-form') : null;
  var lost = body.hasAttribute('data-lost');
  function $(id) { return document.getElementById(id); }
  function read(store, k) { try { return store.getItem(k); } catch (e) { return null; } }
  function write(store, k, v) { try { store.setItem(k, v); } catch (e) {} }
  root.classList.add('js');

  if ($('year')) $('year').textContent = new Date().getFullYear();

  /* ---------- zegar (czas w Krynicy-Zdroju) ---------- */
  var clockEl = $('clock');
  if (clockEl) {
    var clockFmt = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var tick = function () { clockEl.textContent = clockFmt.format(new Date()); };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- wejście treści ---------- */
  var items = document.querySelectorAll('[data-r]');
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var sibs = Array.prototype.slice.call(e.target.parentNode.querySelectorAll(':scope > [data-r]'));
        e.target.style.transitionDelay = Math.min(sibs.indexOf(e.target), 6) * 70 + 'ms';
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- motyw (dzień / noc) ---------- */
  var onTheme = function () {};
  function setTheme(name) {
    if (name === 'noc') root.setAttribute('data-theme', 'noc'); else root.removeAttribute('data-theme');
    write(localStorage, 'fila-theme', name);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', name === 'noc' ? '#0A0B0D' : '#E8EAED');
    onTheme();
  }

  /* ---------- menu (telefon) ---------- */
  var menu = $('menu'), menuBtn = $('menuBtn');
  function setMenu(open) {
    menu.classList.toggle('open', open);
    menu.inert = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Zamknij' : 'Menu';
    body.style.overflow = open ? 'hidden' : '';
  }
  if (menu && menuBtn) {
    menuBtn.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 860 && menu.classList.contains('open')) setMenu(false); });
  }

  /* ---------- formacja: przewijanie albo stała ---------- */
  var hudIndex = $('hudIndex'), hudName = $('hudName'), hudStats = $('hudStats');
  var shownScene = -1, pulse = 0;

  function scrollMix() {
    if (pin !== null) return pin;
    if (!scenes.length) return 0;
    var yc = window.scrollY + window.innerHeight / 2;
    var c = scenes.map(function (s) { return s.offsetTop + s.offsetHeight / 2; });
    if (yc <= c[0]) return 0;
    for (var i = 0; i < c.length - 1; i++) {
      if (yc < c[i + 1]) {
        var t = (yc - c[i]) / (c[i + 1] - c[i]);
        t = Math.min(1, Math.max(0, (t - 0.28) / 0.44)); // formacja stoi, gdy czytasz; zmienia się pomiędzy
        return i + t * t * (3 - 2 * t);
      }
    }
    return c.length - 1;
  }
  function label(mix) {
    var i = Math.round(mix);
    if (i === shownScene || lost) return;
    shownScene = i;
    hudIndex.textContent = (i + 1) + '/' + NAMES.length;
    hudName.textContent = NAMES[i];
  }
  var mixTarget = scrollMix();
  function setForm(n) {
    if (scenes.length > 1) scenes[n].scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    else { pin = n; lost = false; mixTarget = n; }
  }

  /* ---------- wiersz poleceń ---------- */
  var cmd = $('cmd'), cmdIn = $('cmdIn'), cmdOut = $('cmdOut');
  var GO = {
    start: './', uslugi: './#uslugi', proces: './#proces', zasady: './#zasady',
    kampanie: 'kampanie.html', higgsfield: 'kampanie.html', reklamy: 'kampanie.html',
    agenci: 'automatyzacje.html', automatyzacje: 'automatyzacje.html',
    chatboty: 'chatboty.html', chatbot: 'chatboty.html',
    strony: 'strony.html', sklepy: 'strony.html', aplikacje: 'strony.html',
    kontakt: 'kontakt.html', marka: 'marka.html'
  };
  function say(text) { cmdOut.textContent = text; }
  function openCmd() {
    if (!cmd) return;
    cmd.hidden = false;
    say('Wpisz „pomoc”.');
    cmdIn.value = '';
    cmdIn.focus();
  }
  function closeCmd() { if (cmd) cmd.hidden = true; }
  function run(raw) {
    var text = raw.trim().toLowerCase().replace(/^\//, '');
    var parts = text.split(/\s+/), c = parts[0];
    if (!c) return;
    if (c === 'pomoc' || c === 'help' || c === '?') return say('kampanie · agenci · chatboty · strony · kontakt · marka\nnoc · dzien · forma 1–5 · puls · filadelfia');
    if (GO[c]) { say('Otwieram: ' + c); window.location.href = GO[c]; return; }
    if (c === 'noc') { setTheme('noc'); return say('Tryb nocny. Wróć poleceniem „dzien”.'); }
    if (c === 'dzien' || c === 'dzień') { setTheme('dzien'); return say('Tryb dzienny.'); }
    if (c === 'forma') {
      var n = parseInt(parts[1], 10);
      if (!(n >= 1 && n <= 5)) return say('Podaj numer od 1 do 5, np. „forma 3”.');
      setForm(n - 1);
      return say(n + '/5 ' + NAMES[n - 1]);
    }
    if (c === 'puls') { pulse = 1; return say('Puls.'); }
    if (c === 'filadelfia') return say('φιλαδέλφεια — braterska miłość. Stąd nazwa.');
    if (c === 'fps' || c === 'punkty') return say(hudStats && hudStats.textContent ? hudStats.textContent.replace(/^ · /, '') : 'Brak odczytu.');
    say('Nie znam polecenia „' + c + '”. Wpisz „pomoc”.');
  }
  if (cmd) {
    $('cmdForm').addEventListener('submit', function (e) { e.preventDefault(); run(cmdIn.value); cmdIn.value = ''; });
    $('cmdClose').addEventListener('click', closeCmd);
    $('hudBtn').addEventListener('click', function () { if (cmd.hidden) openCmd(); else closeCmd(); });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeCmd(); if (menu && menu.classList.contains('open')) setMenu(false); return; }
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    openCmd();
  });

  /* ---------- formularz kontaktowy: składa wiadomość i otwiera pocztę ---------- */
  var brief = $('brief');
  if (brief) {
    var status = $('briefStatus');
    var want = new URLSearchParams(window.location.search).get('temat');
    var pre = want && brief.querySelector('input[name="temat"][value="' + want.replace(/[^a-z]/g, '') + '"]');
    if (pre) pre.checked = true;
    var compose = function () {
      var topic = brief.querySelector('input[name="temat"]:checked');
      var lines = ['Temat: ' + topic.getAttribute('data-label'), 'Imię: ' + brief.imie.value.trim()];
      if (brief.firma.value.trim()) lines.push('Firma / strona: ' + brief.firma.value.trim());
      lines.push('', brief.opis.value.trim());
      return { subject: 'Rozmowa o AI — ' + topic.getAttribute('data-label'), text: lines.join('\n') };
    };
    brief.addEventListener('submit', function (e) {
      e.preventDefault();
      var m = compose();
      status.textContent = 'Otwieram pocztę. Wystarczy kliknąć „Wyślij”.';
      window.location.href = 'mailto:' + brief.getAttribute('data-mail') + '?subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.text);
    });
    $('briefCopy').addEventListener('click', function () {
      if (!brief.reportValidity()) return;
      var m = compose();
      if (!navigator.clipboard) { status.textContent = 'Ta przeglądarka nie pozwala kopiować. Użyj „Otwórz w poczcie”.'; return; }
      navigator.clipboard.writeText(m.text).then(
        function () { status.textContent = 'Skopiowano. Wklej do wiadomości na ' + brief.getAttribute('data-mail') + '.'; },
        function () { status.textContent = 'Nie udało się skopiować. Użyj „Otwórz w poczcie”.'; }
      );
    });
  }

  /* ---------- podpis w konsoli ---------- */
  try {
    console.log('%cfiladelfia%c.%cai', 'font: 300 26px Mona Sans, sans-serif; color: #0A0B0D; background: #E8EAED; padding: 10px 0 10px 14px', 'font: 700 26px sans-serif; color: #2B2BFF; background: #E8EAED; padding: 10px 0', 'font: 300 26px Mona Sans, sans-serif; color: #0A0B0D; background: #E8EAED; padding: 10px 14px 10px 0');
    console.log('Zaglądasz pod maskę. Naciśnij / na stronie i wpisz „pomoc”.');
  } catch (e) {}

  /* ---------- WebGL ---------- */
  var canvas = $('field');
  var gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true });
  if (!gl) {
    canvas.remove();
    window.addEventListener('scroll', function () { label(scrollMix()); }, { passive: true });
    label(mixTarget);
    return;
  }

  var VS = [
    'attribute vec3 aA; attribute vec2 aB; attribute vec2 aC; attribute vec3 aE;',
    'attribute float aD; attribute float aSeed; attribute float aKind;',
    'uniform float uT, uMix, uAspect, uDpr, uScale, uSize, uIntro, uPulse;',
    'uniform vec2 uTilt, uShift;',
    'varying float vAlpha; varying float vKind;',
    'mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }',
    'float w(float m, float i){ return clamp(1. - abs(m - i), 0., 1.); }',
    'void main(){',
    // każdy punkt przechodzi w swoim tempie, ale tylko w trakcie przejścia
    '  float m = clamp(uMix + (aSeed - .5) * .5 * sin(fract(uMix) * 3.14159), 0., 4.);',
    '  float f = fract(m); m = floor(m) + f * f * (3. - 2. * f);',
    // 0 tęczówka: pierścienie obracające się w przeciwne strony
    '  float ang = aA.y + uT * aA.z;',
    '  vec3 p0 = vec3(aA.x * cos(ang), aA.x * sin(ang), 0.);',
    // 1 siatka: pochylona płaszczyzna z wolną falą
    '  vec3 p1 = vec3(aB.x, aB.y, .09 * sin(aB.x * 3. + uT * .6) * cos(aB.y * 3. + uT * .4));',
    '  p1.yz = rot(-.86) * p1.yz; p1.y += .06;',
    // 2 przepływ: tory, po których punkty płyną w prawo
    '  float tt = fract(aC.x + uT * .018);',
    '  float x = (tt * 2. - 1.) * 1.0;',
    '  vec3 p2 = vec3(x, aC.y + .09 * sin(x * 2.6 + aC.y * 5. + uT * .5), .22 * cos(x * 2. + aC.y * 3. + uT * .3));',
    // 3 sfera
    '  vec3 p3 = aE; p3.xz = rot(uT * .14) * p3.xz;',
    // 4 punkt: jeden cienki pierścień
    '  float a4 = aD + uT * .22;',
    '  vec3 p4 = vec3(.19 * cos(a4), .19 * sin(a4), 0.);',
    '  vec3 p = p0 * w(m, 0.) + p1 * w(m, 1.) + p2 * w(m, 2.) + p3 * w(m, 3.) + p4 * w(m, 4.);',
    '  float edge = smoothstep(0., .1, tt) * smoothstep(1., .9, tt);',
    '  float al = mix(1., edge, w(m, 2.));',
    // wejście: z rozproszenia do formy
    '  float it = clamp(uIntro * 1.6 - aSeed * .6, 0., 1.); it = 1. - pow(1. - it, 3.);',
    '  p = mix(aE * (2.2 + aSeed * 1.6), p, it); al *= it;',
    // puls: dotknięcie tła rozsuwa punkty na chwilę
    '  p *= 1. + uPulse * (.1 + aSeed * .55);',
    '  p.yz = rot(uTilt.x) * p.yz; p.xz = rot(uTilt.y) * p.xz;',
    '  p *= uScale;',
    '  float d = 3.2; float k = d / (p.z + d);',
    '  gl_Position = vec4(p.x * k / uAspect + uShift.x, p.y * k + uShift.y, 0., 1.);',
    '  gl_PointSize = max(1., uSize * uDpr * k);',
    '  vAlpha = al * clamp(.35 + (k - .82) * 2.6, .28, 1.);',
    '  vKind = aKind * w(m, 0.);',
    '}'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'varying float vAlpha; varying float vKind;',
    'uniform vec3 uInk, uSignal; uniform float uAlpha;',
    'void main(){',
    '  float r = length(gl_PointCoord - .5);',
    '  float a = smoothstep(.5, .32, r) * vAlpha * uAlpha;',
    '  vec3 c = mix(uInk, uSignal, vKind);',
    '  gl_FragColor = vec4(c * a, a);',
    '}'
  ].join('\n');

  function shader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog = gl.createProgram();
  try {
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    console.error(err);
    canvas.remove();
    return;
  }
  gl.useProgram(prog);

  /* ---------- geometria ---------- */
  var small = Math.min(window.innerWidth, window.innerHeight) < 700 || window.innerWidth < 860;
  var N = small ? 4600 : 9000;
  var STRIDE = 13; // aA3 aB2 aC2 aE3 aD1 aSeed1 aKind1
  var data = new Float32Array(N * STRIDE);

  // deterministyczny generator: ta sama forma przy każdym wejściu
  var seed = 20261113;
  function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }

  // tęczówka: źrenica + pierścienie (część przerywana, jak łuki znaku)
  var RINGS = 15, pupilN = Math.round(N * 0.03);
  var rings = [], total = 0;
  for (var r = 0; r < RINGS; r++) {
    var rad = 0.2 + (r / (RINGS - 1)) * 0.8;
    var segs = r % 3 === 0 ? 1 : 1 + Math.floor(rnd() * 5);
    var duty = segs === 1 ? 1 : 0.45 + rnd() * 0.4;
    rings.push({ rad: rad, segs: segs, duty: duty, phase: rnd() * 6.283, speed: (r % 2 ? -1 : 1) * (0.03 + rnd() * 0.09) });
    total += rad * duty;
  }
  var cols = Math.round(Math.sqrt(N * 1.35)), rows = Math.ceil(N / cols);
  var LANES = 11, GOLD = Math.PI * (3 - Math.sqrt(5));
  var ri = 0, used = 0, quota = 0, ring = null;

  for (var i = 0; i < N; i++) {
    var o = i * STRIDE;
    // A
    if (i < pupilN) {
      var pr = i % 3; data[o] = 0.028 + pr * 0.026; data[o + 1] = (i / pupilN) * 6.283 * 3; data[o + 2] = pr === 1 ? -0.12 : 0.12; data[o + 12] = 1;
    } else {
      if (used >= quota && ri < RINGS) { ring = rings[ri++]; quota = Math.round((N - pupilN) * (ring.rad * ring.duty) / total); used = 0; }
      var g = ring, u = (used % Math.max(1, quota)) / Math.max(1, quota); used++;
      var seg = Math.floor(u * g.segs), fr = u * g.segs - seg;
      data[o] = g.rad; data[o + 1] = g.phase + (seg + fr * g.duty) / g.segs * 6.283; data[o + 2] = g.speed;
    }
    // B
    data[o + 3] = ((i % cols) / (cols - 1) * 2 - 1) * 1.0;
    data[o + 4] = (Math.floor(i / cols) / (rows - 1) * 2 - 1) * 0.92;
    // C
    var lane = i % LANES;
    data[o + 5] = rnd();
    data[o + 6] = (lane / (LANES - 1) * 2 - 1) * 0.62;
    // E
    var yy = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - yy * yy), th = GOLD * i;
    data[o + 7] = Math.cos(th) * rr * 0.84; data[o + 8] = yy * 0.84; data[o + 9] = Math.sin(th) * rr * 0.84;
    // D, seed
    data[o + 10] = (i / N) * 6.283;
    data[o + 11] = rnd();
  }

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  [['aA', 3, 0], ['aB', 2, 3], ['aC', 2, 5], ['aE', 3, 7], ['aD', 1, 10], ['aSeed', 1, 11], ['aKind', 1, 12]].forEach(function (a) {
    var loc = gl.getAttribLocation(prog, a[0]);
    if (loc < 0) return;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, a[1], gl.FLOAT, false, STRIDE * 4, a[2] * 4);
  });

  var U = {};
  ['uT', 'uMix', 'uAspect', 'uDpr', 'uScale', 'uSize', 'uIntro', 'uPulse', 'uTilt', 'uShift', 'uInk', 'uSignal', 'uAlpha'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  var needs = true;
  onTheme = function () {
    var night = root.getAttribute('data-theme') === 'noc';
    if (night) { gl.uniform3f(U.uInk, 232 / 255, 234 / 255, 237 / 255); gl.uniform3f(U.uSignal, 112 / 255, 112 / 255, 1); }
    else { gl.uniform3f(U.uInk, 10 / 255, 11 / 255, 13 / 255); gl.uniform3f(U.uSignal, 43 / 255, 43 / 255, 1); }
    needs = true;
  };
  onTheme();
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  /* ---------- rozmiar i kadr ---------- */
  var W = 0, H = 0, dpr = 1, narrow = false;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    narrow = W < 860;
    var aspect = W / H;
    gl.uniform1f(U.uAspect, aspect);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform1f(U.uSize, narrow ? 1.5 : 1.7);
    // na szerokim ekranie forma żyje po prawej, obok kolumny tekstu; na wąskim — nad nagłówkiem
    gl.uniform1f(U.uScale, narrow ? Math.min(0.46, aspect * 0.86) : Math.min(0.8, aspect * 0.46));
    needs = true;
  }

  /* ---------- pętla ---------- */
  var mix = mixTarget;
  var tiltX = 0, tiltY = 0, ptrX = 0, ptrY = 0;
  var t0 = performance.now(), last = t0;
  var frames = 0, fpsAt = t0, visible = true;
  // pierwsze wejście składa formę powoli; kolejne podstrony — szybciej
  var introTime = read(sessionStorage, 'fila-seen') ? 1.3 : 2.6;
  write(sessionStorage, 'fila-seen', '1');

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    ptrX = e.clientX / window.innerWidth - 0.5;
    ptrY = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    if (reduced || (e.target.closest && e.target.closest('a, button, input, textarea, label, .cmd'))) return;
    pulse = 1;
  }, { passive: true });
  window.addEventListener('scroll', function () { mixTarget = scrollMix(); needs = true; }, { passive: true });
  window.addEventListener('resize', function () { resize(); mixTarget = scrollMix(); });
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; last = performance.now(); });

  function wgt(m, i) { return Math.max(0, 1 - Math.abs(m - i)); }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var t = reduced ? 0 : (now - t0) / 1000;

    mix += (mixTarget - mix) * (reduced ? 1 : Math.min(1, dt * 5));
    pulse *= Math.exp(-dt * 3.2);
    // tęczówka patrzy za kursorem; pozostałe formy tylko lekko się przechylają
    var look = 0.35 + 0.65 * wgt(mix, 0);
    var tx = -0.22 + ptrY * 0.7 * look, ty = -0.3 + ptrX * 0.9 * look;
    tiltX += (tx - tiltX) * Math.min(1, dt * 3.5);
    tiltY += (ty - tiltY) * Math.min(1, dt * 3.5);

    if (reduced && !needs) return;
    needs = false;

    var intro = reduced ? 1 : Math.min(1, t / introTime);
    if (lost) intro = Math.min(intro, 0.34); // 404: forma nigdy się nie składa
    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uMix, mix);
    gl.uniform1f(U.uIntro, intro);
    gl.uniform1f(U.uPulse, pulse);
    gl.uniform2f(U.uTilt, reduced ? -0.22 : tiltX, reduced ? -0.3 : tiltY);
    if (narrow) {
      // na telefonie forma jest wyraźna tylko tam, gdzie ma miejsce: u góry strony i przy kontakcie
      var top, end;
      if (pin !== null) { top = Math.max(0, 1 - window.scrollY / (H * 0.55)); end = 0; }
      else { top = wgt(mix, 0); end = wgt(mix, 4); }
      gl.uniform2f(U.uShift, 0, 0.45 * top + 0.62 * end);
      gl.uniform1f(U.uAlpha, 0.16 + 0.6 * top + 0.5 * end);
    } else {
      gl.uniform2f(U.uShift, 0.5, 0.02);
      gl.uniform1f(U.uAlpha, 0.86);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, N);

    label(mix);
    frames++;
    if (now - fpsAt >= 500) {
      var fps = Math.round(frames * 1000 / (now - fpsAt));
      if (hudStats) hudStats.textContent = ' · ' + fps + ' kl/s · ' + N.toLocaleString('pl-PL') + ' pkt';
      frames = 0; fpsAt = now;
    }
  }

  resize();
  label(mix);
  requestAnimationFrame(frame);
})();
