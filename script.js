/* Filadelfia.ai — pole punktów (WebGL), odczyty i wejście treści. Bez zależności. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scenes = Array.prototype.slice.call(document.querySelectorAll('[data-scene]'));
  root.classList.add('js');

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- zegar (czas w Krynicy-Zdroju) ---------- */
  var clockEl = document.getElementById('clock');
  var clockFmt = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  function tick() { clockEl.textContent = clockFmt.format(new Date()); }
  tick();
  setInterval(tick, 1000);

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
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- przewijanie -> numer formacji (0..4, płynnie) ---------- */
  var hudIndex = document.getElementById('hudIndex');
  var hudName = document.getElementById('hudName');
  var hudStats = document.getElementById('hudStats');
  var shownScene = -1;

  function scrollMix() {
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
    if (i === shownScene) return;
    shownScene = i;
    hudIndex.textContent = (i + 1) + '/' + scenes.length;
    hudName.textContent = scenes[i].getAttribute('data-scene');
  }

  /* ---------- WebGL ---------- */
  var canvas = document.getElementById('field');
  var gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true });
  if (!gl) {
    canvas.remove();
    window.addEventListener('scroll', function () { label(scrollMix()); }, { passive: true });
    label(0);
    return;
  }

  var VS = [
    'attribute vec3 aA; attribute vec2 aB; attribute vec2 aC; attribute vec3 aE;',
    'attribute float aD; attribute float aSeed; attribute float aKind;',
    'uniform float uT, uMix, uAspect, uDpr, uScale, uSize, uIntro;',
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

  // tęczówka: źrenica + pierścienie (część przerywana, jak łuki sygnetu)
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
  ['uT', 'uMix', 'uAspect', 'uDpr', 'uScale', 'uSize', 'uIntro', 'uTilt', 'uShift', 'uInk', 'uSignal', 'uAlpha'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform3f(U.uInk, 10 / 255, 11 / 255, 13 / 255);
  gl.uniform3f(U.uSignal, 43 / 255, 43 / 255, 1);
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
  var mix = scrollMix(), mixTarget = mix;
  var tiltX = 0, tiltY = 0, ptrX = 0, ptrY = 0;
  var t0 = performance.now(), last = t0, needs = true;
  var frames = 0, fpsAt = t0, visible = true;

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    ptrX = e.clientX / window.innerWidth - 0.5;
    ptrY = e.clientY / window.innerHeight - 0.5;
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
    // tęczówka patrzy za kursorem; pozostałe formy tylko lekko się przechylają
    var look = 0.35 + 0.65 * wgt(mix, 0);
    var tx = -0.22 + ptrY * 0.7 * look, ty = -0.3 + ptrX * 0.9 * look;
    tiltX += (tx - tiltX) * Math.min(1, dt * 3.5);
    tiltY += (ty - tiltY) * Math.min(1, dt * 3.5);

    if (reduced && !needs) return;
    needs = false;

    var intro = reduced ? 1 : Math.min(1, t / 2.6);
    var hero = wgt(mix, 0), end = wgt(mix, 4);
    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uMix, mix);
    gl.uniform1f(U.uIntro, intro);
    gl.uniform2f(U.uTilt, reduced ? -0.22 : tiltX, reduced ? -0.3 : tiltY);
    if (narrow) {
      gl.uniform2f(U.uShift, 0, 0.45 * hero + 0.62 * end);
      gl.uniform1f(U.uAlpha, 0.16 + 0.6 * hero + 0.5 * end);
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
      hudStats.textContent = ' · ' + fps + ' kl/s · ' + N.toLocaleString('pl-PL') + ' pkt';
      frames = 0; fpsAt = now;
    }
  }

  resize();
  label(mix);
  requestAnimationFrame(frame);
})();
