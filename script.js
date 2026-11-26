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
  // Serwer z backendem dopisuje do strony znacznik; kopia statyczna (np. GitHub Pages) go nie ma i nie wysyła żadnych żądań do API.
  var HAS_API = !!document.querySelector('meta[name="fila-api"]');
  // Prywatność opisuje formularz w dwóch wersjach: z backendem zgłoszenie trafia na serwer, bez niego do programu pocztowego.
  if (HAS_API) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-z-api]'), function (el) { el.hidden = false; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-bez-api]'), function (el) { el.hidden = true; });
  }
  // anonimowa odsłona: sama ścieżka i adres strony odsyłającej, bez plików cookie
  if (HAS_API && navigator.sendBeacon) {
    try { navigator.sendBeacon('/api/odslona', JSON.stringify({ sciezka: body.hasAttribute('data-lost') ? '/404' : location.pathname, ref: document.referrer })); } catch (e) {}
  }

  if ($('year')) $('year').textContent = new Date().getFullYear();

  /* ---------- zegar (czas w Krynicy-Zdroju) ---------- */
  var clockEl = $('clock');
  if (clockEl) {
    var clockFmt = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var tick = function () { clockEl.textContent = clockFmt.format(new Date()); };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- nagłówki: słowa wjeżdżają po kolei ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('h1, .ask'), function (el) {
    if (el.children.length || el.isContentEditable) return;
    var words = el.textContent.split(' ');
    el.setAttribute('aria-label', el.textContent);
    el.textContent = '';
    words.forEach(function (wd, n) {
      var outer = document.createElement('span'), inner = document.createElement('span');
      outer.className = 'w'; outer.setAttribute('aria-hidden', 'true');
      inner.textContent = wd; inner.style.transitionDelay = (n * 70) + 'ms';
      outer.appendChild(inner); el.appendChild(outer);
      if (n < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

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
  var showText = function () { return false; }; // podmieniane, gdy działa WebGL
  var personHook = function () {}, aboutSpy = null; // sylwetki w „O nas”: też podmieniane, gdy działa WebGL
  function setTheme(name) {
    if (name === 'noc') root.setAttribute('data-theme', 'noc'); else root.removeAttribute('data-theme');
    write(localStorage, 'fila-theme', name);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', name === 'noc' ? '#0A0B0D' : '#E8EAED');
    var tb = $('themeBtn');
    if (tb) tb.setAttribute('aria-pressed', String(name === 'noc'));
    onTheme();
  }
  if ($('themeBtn')) {
    $('themeBtn').setAttribute('aria-pressed', String(root.getAttribute('data-theme') === 'noc'));
    $('themeBtn').addEventListener('click', function () { setTheme(root.getAttribute('data-theme') === 'noc' ? 'dzien' : 'noc'); });
  }

  /* ---------- nagłówek: szkło po przewinięciu, chowa się przy przewijaniu w dół ---------- */
  var bar = $('bar'), barY = window.scrollY;
  function barState() {
    var y = window.scrollY, open = menu && menu.classList.contains('open');
    bar.classList.toggle('is-stuck', y > 24 && !open);
    var room = root.scrollHeight - window.innerHeight;
    bar.style.setProperty('--p', room > window.innerHeight * 0.6 ? Math.min(1, Math.max(0, y / room)).toFixed(4) : '0');
    if (Math.abs(y - barY) > 6) { bar.classList.toggle('is-hidden', y > barY && y > 520 && !open && !bar.contains(document.activeElement)); barY = y; }
  }
  if (bar) { window.addEventListener('scroll', barState, { passive: true }); }

  /* ---------- menu (telefon) ---------- */
  var menu = $('menu'), menuBtn = $('menuBtn');
  function setMenu(open) {
    menu.classList.toggle('open', open);
    menu.inert = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Zamknij' : 'Menu';
    body.style.overflow = open ? 'hidden' : '';
    // gdy menu jest otwarte, reszta strony jest wyłączona z klawiatury i czytników
    Array.prototype.forEach.call(document.querySelectorAll('main, footer.end, .hud'), function (el) { el.inert = open; });
    // wymuszone przeliczenie stylu: bez niego menu jest w tej chwili jeszcze niewidoczne i nie przyjmuje fokusu
    if (open) { void menu.offsetWidth; var firstLink = menu.querySelector('summary, a'); if (firstLink) firstLink.focus({ preventScroll: true }); }
    else if (menu.contains(document.activeElement)) menuBtn.focus({ preventScroll: true });
    if (bar) { bar.classList.remove('is-hidden'); bar.classList.toggle('is-stuck', !open && window.scrollY > 24); }
  }
  if (menu && menuBtn) {
    menuBtn.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 860 && menu.classList.contains('open')) setMenu(false); });
  }

  /* ---------- formacja: przewijanie albo stała ---------- */
  var hudIndex = $('hudIndex'), hudName = $('hudName'), hudStats = $('hudStats');
  var shownScene = -1, pulse = 0, portraitShown = false;

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
    if (portraitShown) { if (shownScene !== 99) { shownScene = 99; hudIndex.textContent = '·'; hudName.textContent = 'Portret'; } return; }
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

  /* ---------- wiersz poleceń: dziennik, historia, podpowiedzi, niespodzianki ---------- */
  var cmd = $('cmd'), cmdIn = $('cmdIn'), cmdOut = $('cmdOut'), cmdGhost = $('cmdGhost'), hudBtn = $('hudBtn');
  var forceForm = function () { return false; }; // podmieniane, gdy działa WebGL: chwilowo wymusza formację
  var GO = {
    start: './', uslugi: './#uslugi', proces: './#proces', zasady: './#zasady',
    kampanie: 'kampanie.html', higgsfield: 'kampanie.html', reklamy: 'kampanie.html',
    agenci: 'automatyzacje.html', automatyzacje: 'automatyzacje.html',
    chatboty: 'chatboty.html', chatbot: 'chatboty.html',
    strony: 'strony.html', sklepy: 'strony.html', aplikacje: 'strony.html',
    kontakt: 'kontakt.html', marka: 'marka.html', onas: './#o-nas', 'o-nas': './#o-nas', pytania: './#faq', faq: './#faq', prywatnosc: 'prywatnosc.html'
  };
  var PAGES = ['kampanie', 'agenci', 'chatboty', 'strony', 'onas', 'proces', 'zasady', 'pytania', 'kontakt', 'marka'];
  var ALIAS = {
    help: 'pomoc', '?': 'pomoc', clear: 'wyczysc', cls: 'wyczysc', exit: 'zamknij', quit: 'zamknij', q: 'zamknij',
    date: 'data', time: 'czas', godzina: 'czas', theme: 'motyw', history: 'historia', random: 'losuj', top: 'gora', bottom: 'dol',
    hello: 'czesc', hi: 'czesc', hej: 'czesc', siema: 'czesc', coffee: 'kawa', email: 'mail', 'e-mail': 'mail',
    cena: 'cennik', ile: 'cennik', koszt: 'cennik', who: 'kto', autor: 'kto', zespol: 'kto', love: 'filadelfia', milosc: 'filadelfia',
    1337: 'hack', hacker: 'hack', impreza: 'disco', party: 'disco', secrets: 'sekrety', eggs: 'sekrety', shortcuts: 'skroty', fps: 'status', punkty: 'status'
  };
  var plain = function (s) { s = s.toLowerCase(); return (s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s).replace(/ł/g, 'l'); };
  var timeFmt = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  var mailLink = document.querySelector('a[href^="mailto:"]');
  var MAIL = mailLink ? mailLink.getAttribute('href').replace(/^mailto:/, '').split('?')[0] : 'business@filadelfia.ai';

  // dziennik: kolejne wiersze zamiast jednego komunikatu; najstarsze znikają
  function addLine(cls) {
    var d = document.createElement('div');
    d.className = cls;
    cmdOut.appendChild(d);
    while (cmdOut.children.length > 60) cmdOut.removeChild(cmdOut.firstChild);
    return d;
  }
  function toEnd() { cmdOut.scrollTop = cmdOut.scrollHeight; }
  function say(text) { if (!cmdOut) return; addLine('cmd__line').textContent = text; toEnd(); }
  // polecenia do kliknięcia: wygodne na telefonie; „…” na końcu oznacza, że polecenie czeka na dopisanie słowa
  function chips(list, label) {
    var d = addLine('cmd__line cmd__chips');
    if (label) { var l = document.createElement('span'); l.className = 'cmd__label'; l.textContent = label; d.appendChild(l); }
    list.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cmd__chip'; b.textContent = c;
      d.appendChild(b);
    });
    toEnd();
  }

  // komunikat nad dolnym paskiem: dla zdarzeń poza wierszem poleceń
  var toastEl = null, toastTimer = 0;
  function toast(text) {
    if (!toastEl) { toastEl = document.createElement('p'); toastEl.className = 'toast mono'; toastEl.setAttribute('role', 'status'); body.appendChild(toastEl); void toastEl.offsetWidth; }
    toastEl.textContent = text;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 3400);
  }

  // niespodzianki: lista znalezionych zostaje w przeglądarce
  var EGGS = ['sudo', 'kawa', '42', 'rm', 'disco', 'konami', 'krynica', 'matrix', 'filadelfia', 'hack'];
  var eggs = (read(localStorage, 'fila-eggs') || '').split(',').filter(function (k, n, all) { return EGGS.indexOf(k) >= 0 && all.indexOf(k) === n; });
  function egg(k) {
    if (eggs.indexOf(k) >= 0) return;
    eggs.push(k);
    write(localStorage, 'fila-eggs', eggs.join(','));
    if (eggs.length === EGGS.length) setTimeout(function () { say('Komplet: ' + EGGS.length + '/' + EGGS.length + '. Znasz tę stronę lepiej niż my.'); showText('brawo', 5000); pulse = 1; }, 1200);
    else say('Niespodzianka ' + eggs.length + '/' + EGGS.length + '. Lista: sekrety');
  }

  var discoTimer = 0, clockTimer = 0;
  function disco() {
    if (reduced || forceForm(0) === false) return false;
    clearInterval(discoTimer);
    var n = 0;
    discoTimer = setInterval(function () {
      n++;
      if (n > 14) { clearInterval(discoTimer); forceForm(null); return; }
      forceForm(n % NAMES.length); pulse = 0.7;
    }, 380);
    return true;
  }
  function pointClock() {
    clearInterval(clockTimer);
    var n = 0, now = function () { return timeFmt.format(new Date()); };
    if (!showText(now(), 2600)) return false;
    if (!reduced) clockTimer = setInterval(function () { n++; if (n > 9) { clearInterval(clockTimer); return; } showText(now(), 2600); }, 1000);
    return true;
  }

  // historia poleceń: strzałki w górę i w dół; zostaje do zamknięcia karty
  var hist = [], histAt = 0, draft = '';
  try { hist = JSON.parse(read(sessionStorage, 'fila-cmd') || '[]'); if (!Array.isArray(hist)) hist = []; } catch (e) { hist = []; }
  histAt = hist.length;
  function remember(raw) {
    if (hist[hist.length - 1] !== raw) hist.push(raw);
    if (hist.length > 30) hist = hist.slice(-30);
    histAt = hist.length;
    write(sessionStorage, 'fila-cmd', JSON.stringify(hist));
  }

  var CMD = {
    pomoc: function () {
      chips(PAGES, 'strony');
      chips(['noc', 'dzien', 'forma …', 'losuj', 'puls'], 'wygląd');
      chips(['napisz …', 'zegar', 'czas', 'kto', 'mail'], 'punkty');
      chips(['historia', 'wyczysc', 'skroty', 'status', 'sekrety'], 'terminal');
    },
    skroty: function () { say('/ albo Ctrl+K — otwórz   ·   Esc — zamknij\n↑ ↓ — historia   ·   Tab — dopełnij   ·   Ctrl+L — wyczyść'); },
    wyczysc: function () { cmdOut.textContent = ''; },
    zamknij: function () { closeCmd(); },
    historia: function () { say(hist.length > 1 ? hist.slice(0, -1).slice(-12).join('\n') : 'Historia jest pusta.'); },
    noc: function () { setTheme('noc'); say('Tryb nocny. Wróć poleceniem „dzien”.'); },
    dzien: function () { setTheme('dzien'); say('Tryb dzienny.'); },
    motyw: function () { var night = root.getAttribute('data-theme') === 'noc'; setTheme(night ? 'dzien' : 'noc'); say(night ? 'Tryb dzienny.' : 'Tryb nocny.'); },
    forma: function (parts) {
      var n = parseInt(parts[1], 10);
      if (!(n >= 1 && n <= 5)) return say('Podaj numer od 1 do 5, np. „forma 3”.');
      setForm(n - 1);
      say(n + '/5 ' + NAMES[n - 1]);
    },
    losuj: function () {
      var n = Math.floor(Math.random() * NAMES.length);
      if (n === Math.round(mixTarget)) n = (n + 1) % NAMES.length;
      setForm(n);
      say((n + 1) + '/5 ' + NAMES[n]);
    },
    puls: function () { pulse = 1; say('Puls.'); },
    napisz: function (parts, rest) {
      var word = rest.slice(0, 14);
      if (!word) return say('Podaj słowo, np. „napisz cześć”.');
      say(showText(word, 7000) ? 'Punkty piszą: ' + word : 'Tutaj nie mogę rysować.');
    },
    zegar: function () { say(pointClock() ? 'Punkty pokazują czas w Krynicy-Zdroju.' : 'Tutaj nie mogę rysować. Jest ' + timeFmt.format(new Date()) + '.'); },
    czas: function () { say('W Krynicy-Zdroju jest ' + timeFmt.format(new Date()) + '.'); },
    data: function () { say(new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())); },
    status: function () {
      var i = Math.round(mixTarget);
      say('forma ' + (i + 1) + '/5 ' + NAMES[i] + '   ·   motyw ' + (root.getAttribute('data-theme') === 'noc' ? 'noc' : 'dzień') + (hudStats && hudStats.textContent ? hudStats.textContent.replace(/ · /g, '   ·   ') : '') + '\nstrona ' + location.pathname);
    },
    kto: function () { say('Filip Myjak — AI, automatyzacje, strony.\nDawid Borzęcki — wideo, strategia, social media.'); chips(['onas', 'kontakt']); },
    mail: function () {
      if (!navigator.clipboard) return say(MAIL);
      navigator.clipboard.writeText(MAIL).then(function () { say('Skopiowano: ' + MAIL); }, function () { say(MAIL); });
    },
    cennik: function () { say('Zależy od zakresu, a zaczynamy od jednego obszaru. Odpowiedź jest w pytaniach: „Ile to kosztuje?”.'); chips(['pytania', 'kontakt']); },
    gora: function () { window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); say('Na górę.'); },
    dol: function () { window.scrollTo({ top: root.scrollHeight, behavior: reduced ? 'auto' : 'smooth' }); say('Na dół.'); },
    czesc: function () { say('Cześć. Wpisz „pomoc” albo od razu „kontakt”.'); },
    echo: function (parts, rest) { say(rest || '…'); },
    ping: function () { say('pong'); },
    whoami: function () { say('gość. Miło, że zaglądasz pod maskę.'); },
    pwd: function () { say(location.pathname); },
    ls: function () { chips(PAGES.concat(['prywatnosc', 'start'])); },
    sekrety: function () {
      say('Niespodzianki: ' + eggs.length + '/' + EGGS.length + (eggs.length ? '' : '. Podpowiedź: pierwsze litery.'));
      say(EGGS.map(function (k) { return eggs.indexOf(k) >= 0 ? k : k.charAt(0) + new Array(k.length).join('·'); }).join('   '));
    },
    // --- niespodzianki ---
    sudo: function () { say('Brak uprawnień. I dobrze: człowiek ma tu ostatnie słowo.'); egg('sudo'); },
    kawa: function () { showText('kawa', 5000); say('Parzę. To jedyna rzecz, której AI za Ciebie nie wypije.'); egg('kawa'); },
    42: function () { showText('42', 5000); say('Odpowiedź się zgadza. Gorzej z pytaniem.'); egg('42'); },
    rm: function () { say('Spokojnie. Tu niczego nie da się usunąć.'); pulse = 1; egg('rm'); },
    disco: function () { say(disco() ? 'Punkty tańczą.' : 'Ruch jest ograniczony albo nie mam czym rysować.'); egg('disco'); },
    krynica: function () { showText('Krynica', 6000); say('49.4217° N 20.9594° E. Stąd pracujemy.'); egg('krynica'); },
    matrix: function () { showText('2B2BFF', 6000); say('Czerwona czy niebieska? U nas jest tylko jedna: #2B2BFF.'); egg('matrix'); },
    filadelfia: function () { showText('♥', 5000); say('φιλαδέλφεια — braterska miłość. Stąd nazwa.'); egg('filadelfia'); },
    hack: function () { say('Dostęp przyznany.'); setTimeout(function () { say('Żartuję. Kod i tak jest otwarty: zajrzyj w źródło strony.'); }, 900); egg('hack'); }
  };
  var NAMES_ALL = PAGES.concat(Object.keys(CMD), Object.keys(GO));

  // odległość edycyjna: „czy chodziło o…”
  function dist(a, b) {
    var row = [], i, j, prev, tmp;
    for (j = 0; j <= b.length; j++) row[j] = j;
    for (i = 1; i <= a.length; i++) {
      prev = row[0]; row[0] = i;
      for (j = 1; j <= b.length; j++) { tmp = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)); prev = tmp; }
    }
    return row[b.length];
  }
  function go(c) {
    say('Otwieram: ' + c);
    write(sessionStorage, 'fila-cmd-open', '1'); // wiersz poleceń wraca na następnej stronie
    window.location.href = GO[c];
  }
  function run(raw) {
    raw = raw.trim();
    var text = plain(raw).replace(/^\//, '');
    var parts = text.split(/\s+/), c = parts[0], rest = raw.replace(/^\/?\S+\s*/, '');
    if (!c) return;
    if (ALIAS[c]) c = ALIAS[c];
    if (c === 'cd' || c === 'idz' || c === 'cat' || c === 'otworz' || c === 'open') {
      c = (parts[1] || '').replace(/^[.\/]+/, '').replace(/\.html$/, '');
      if (!c || c === '~') c = 'start';
      if (!GO[c]) return say('Nie znam takiej strony. Lista: ls');
    }
    if (GO[c]) return go(c);
    if (Object.prototype.hasOwnProperty.call(CMD, c)) return CMD[c](parts, rest);
    var best = null, bestD = 3;
    NAMES_ALL.forEach(function (n) { var d = dist(c, n); if (d < bestD) { bestD = d; best = n; } });
    say('Nie znam polecenia „' + c + '”.' + (best ? ' Czy chodziło o:' : ' Wpisz „pomoc”.'));
    if (best) chips([best, 'pomoc']);
  }
  function exec(raw) {
    raw = raw.trim();
    if (!raw) return;
    addLine('cmd__line cmd__echo').textContent = raw;
    remember(raw);
    run(raw);
    toEnd();
  }

  // podpowiedź za kursorem: Tab dopełnia
  function hint() {
    var v = plain(cmdIn.value);
    if (!v || /\s/.test(v)) return '';
    for (var i = 0; i < NAMES_ALL.length; i++) {
      var n = NAMES_ALL[i];
      if (EGGS.indexOf(n) >= 0 && eggs.indexOf(n) < 0) continue; // nieodkrytych niespodzianek nie podpowiadamy
      if (n.length > v.length && n.indexOf(v) === 0) return n;
    }
    return '';
  }
  function ghost() {
    if (!cmdGhost) return;
    var h = hint();
    cmdGhost.textContent = '';
    if (!h) return;
    var typed = document.createElement('i'), tail = document.createElement('span');
    typed.textContent = cmdIn.value; tail.textContent = h.slice(cmdIn.value.length);
    cmdGhost.appendChild(typed); cmdGhost.appendChild(tail);
  }
  function setIn(v) { cmdIn.value = v; ghost(); try { cmdIn.setSelectionRange(v.length, v.length); } catch (e) {} }

  function openCmd(quiet) {
    if (!cmd) return;
    var was = cmd.hidden;
    cmd.hidden = false;
    if (hudBtn) hudBtn.setAttribute('aria-expanded', 'true');
    if (was && !cmdOut.children.length) {
      var h = new Date().getHours();
      say((h < 5 ? 'Późno już.' : h < 12 ? 'Dzień dobry.' : h < 18 ? 'Cześć.' : 'Dobry wieczór.') + ' Wpisz polecenie albo wybierz:');
      chips(['pomoc', 'kontakt', root.getAttribute('data-theme') === 'noc' ? 'dzien' : 'noc', 'sekrety']);
    }
    setIn('');
    toEnd();
    if (!quiet) cmdIn.focus({ preventScroll: true });
  }
  function closeCmd() {
    if (!cmd || cmd.hidden) return;
    var inside = cmd.contains(document.activeElement);
    cmd.hidden = true;
    write(sessionStorage, 'fila-cmd-open', '');
    if (hudBtn) { hudBtn.setAttribute('aria-expanded', 'false'); if (inside) hudBtn.focus({ preventScroll: true }); }
  }
  if (cmd) {
    $('cmdForm').addEventListener('submit', function (e) { e.preventDefault(); var v = cmdIn.value; setIn(''); exec(v); });
    $('cmdClose').addEventListener('click', closeCmd);
    hudBtn.addEventListener('click', function () { if (cmd.hidden) openCmd(); else closeCmd(); });
    cmdIn.addEventListener('input', ghost);
    cmdIn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!hist.length) return;
        e.preventDefault();
        if (histAt === hist.length) draft = cmdIn.value;
        histAt = Math.max(0, Math.min(hist.length, histAt + (e.key === 'ArrowUp' ? -1 : 1)));
        setIn(histAt === hist.length ? draft : hist[histAt]);
      } else if (e.key === 'Tab' && !e.shiftKey) {
        var h = hint();
        if (h) { e.preventDefault(); setIn(h); }
      } else if ((e.key === 'l' || e.key === 'L') && e.ctrlKey) { e.preventDefault(); cmdOut.textContent = ''; }
    });
    cmdOut.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.cmd__chip');
      if (!b) return;
      var t = b.textContent;
      if (/ …$/.test(t)) { setIn(t.replace(/…$/, '')); cmdIn.focus({ preventScroll: true }); }
      else { exec(t); if (!window.matchMedia('(pointer: coarse)').matches) cmdIn.focus({ preventScroll: true }); }
    });
    // przejście na inną stronę poleceniem: wiersz poleceń zostaje otwarty (na telefonie bez wysuwania klawiatury)
    if (read(sessionStorage, 'fila-cmd-open') === '1') {
      openCmd(window.matchMedia('(pointer: coarse)').matches);
      say('Jesteś tutaj: ' + (location.pathname.split('/').pop() || 'start') + (location.hash || ''));
    }
  }

  // kod Konami: ↑ ↑ ↓ ↓ ← → ← → B A
  var KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'], konamiAt = 0;
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeCmd(); if (menu && menu.classList.contains('open')) setMenu(false); return; }
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && cmd) {
      e.preventDefault();
      if (cmd.hidden) openCmd(); else closeCmd();
      return;
    }
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      var k = String(e.key).toLowerCase();
      konamiAt = k === KONAMI[konamiAt] ? konamiAt + 1 : (k === KONAMI[0] ? 1 : 0);
      if (konamiAt === KONAMI.length) {
        konamiAt = 0;
        toast(disco() ? 'Kod Konami · punkty tańczą' : 'Kod Konami');
        egg('konami');
      }
    }
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || typing) return;
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
    var openMail = function () {
      var m = compose();
      window.location.href = 'mailto:' + brief.getAttribute('data-mail') + '?subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.text);
    };
    // jeśli strona działa z backendem, formularz zapisuje zgłoszenie w panelu; bez niego otwiera pocztę
    var backend = HAS_API, sendBtn = $('briefSend'), contact = $('briefContact');
    if (backend) {
      contact.hidden = false; brief.kontakt.required = true;
      sendBtn.textContent = 'Wyślij';
      $('briefHint').textContent = 'Wiadomość trafi prosto do nas. Odpiszemy na podany kontakt.';
    }
    // własne komunikaty przy polach zamiast dymków przeglądarki
    brief.setAttribute('novalidate', '');
    var MSG = { imie: 'Podaj imię.', kontakt: 'Podaj e-mail albo telefon, żebyśmy mogli odpisać.', opis: 'Napisz choć jedno zdanie o tym, co chcesz usprawnić.' };
    var setErr = function (input, text) {
      var field = input.closest('.field'), old = field.querySelector('.field__err');
      if (old) old.remove();
      field.classList.toggle('is-bad', !!text);
      input.setAttribute('aria-invalid', text ? 'true' : 'false');
      if (text) { var er = document.createElement('span'); er.className = 'field__err'; er.id = 'err-' + input.name; er.textContent = text; field.appendChild(er); input.setAttribute('aria-describedby', er.id); } else input.removeAttribute('aria-describedby');
    };
    var validate = function () {
      var first = null;
      ['imie', 'kontakt', 'opis'].forEach(function (name) {
        var input = brief[name], need = input.required && !input.closest('[hidden]'), bad = need && !input.value.trim();
        if (name === 'kontakt' && need && !bad && !/@|\d{7,}/.test(input.value.replace(/[\s-]/g, ''))) bad = true;
        setErr(input, bad ? MSG[name] : '');
        if (bad && !first) first = input;
      });
      if (first) first.focus();
      return !first;
    };
    ['imie', 'kontakt', 'opis'].forEach(function (name) { brief[name].addEventListener('input', function () { if (brief[name].getAttribute('aria-invalid') === 'true') setErr(brief[name], ''); }); });
    brief.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) { status.textContent = ''; return; }
      if (!backend) { status.textContent = 'Otwieram pocztę. Wystarczy kliknąć „Wyślij”.'; return openMail(); }
      var topic = brief.querySelector('input[name="temat"]:checked');
      sendBtn.disabled = true; status.textContent = 'Wysyłam…';
      fetch('api/zgloszenia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temat: topic.value, imie: brief.imie.value, firma: brief.firma.value, kontakt: brief.kontakt.value, opis: brief.opis.value, www: brief.www.value })
      }).then(function (r) {
        sendBtn.disabled = false;
        if (r.status === 201 || r.status === 200) { brief.reset(); status.textContent = 'Wysłano. Odpiszemy na podany kontakt.'; pulse = 1; return; }
        if (r.status === 429) { status.textContent = 'Za dużo zgłoszeń z tego adresu. Spróbuj za kilka minut albo napisz na ' + brief.getAttribute('data-mail') + '.'; return; }
        status.textContent = 'Nie udało się wysłać. Otwieram pocztę z tą samą treścią.'; openMail();
      }).catch(function () { sendBtn.disabled = false; status.textContent = 'Nie udało się wysłać. Otwieram pocztę z tą samą treścią.'; openMail(); });
    });
    $('briefCopy').addEventListener('click', function () {
      if (!validate()) return;
      var m = compose();
      if (!navigator.clipboard) { status.textContent = 'Ta przeglądarka nie pozwala kopiować. Użyj „Otwórz w poczcie”.'; return; }
      navigator.clipboard.writeText(m.text).then(
        function () { status.textContent = 'Skopiowano. Wklej do wiadomości na ' + brief.getAttribute('data-mail') + '.'; },
        function () { status.textContent = 'Nie udało się skopiować. Użyj „Otwórz w poczcie”.'; }
      );
    });
  }

  /* ---------- manifest: słowa zapalają się przy przewijaniu; kroki: aktywny ten na środku ---------- */
  var fills = Array.prototype.map.call(document.querySelectorAll('.fill'), function (el) {
    var words = el.textContent.trim().split(/\s+/);
    // słowa zostają zwykłym tekstem: czytnik ekranu czyta je jak zdanie (aria-label na akapicie bywa pomijany)
    el.textContent = '';
    var spans = words.map(function (wd, n) {
      var sp = document.createElement('span');
      sp.textContent = wd;
      el.appendChild(sp);
      if (n < words.length - 1) el.appendChild(document.createTextNode(' '));
      return sp;
    });
    return { el: el, spans: spans };
  });
  var stepLists = Array.prototype.slice.call(document.querySelectorAll('.steps:not(.steps--row)'));
  stepLists.forEach(function (l) { l.classList.add('spy'); });
  var spyQueued = false;
  function spy() {
    spyQueued = false;
    var vh = window.innerHeight;
    fills.forEach(function (f) {
      var r = f.el.getBoundingClientRect();
      var p = reduced ? 1 : (vh * 0.82 - r.top) / (r.height + vh * 0.3);
      var lit = Math.round(Math.min(1, Math.max(0, p)) * f.spans.length);
      f.spans.forEach(function (sp, n) { sp.classList.toggle('on', n < lit); });
    });
    stepLists.forEach(function (l) {
      var best = null, bestD = 1e9;
      Array.prototype.forEach.call(l.children, function (li) {
        var r = li.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - vh * 0.5);
        if (d < bestD) { bestD = d; best = li; }
      });
      Array.prototype.forEach.call(l.children, function (li) { li.classList.toggle('on', li === best && bestD < vh * 0.5); });
    });
  }
  function queueSpy() { if (!spyQueued) { spyQueued = true; requestAnimationFrame(spy); } }
  if (fills.length || stepLists.length) {
    window.addEventListener('scroll', queueSpy, { passive: true });
    window.addEventListener('resize', queueSpy);
    spy();
  }

  function whenSeen(el, fn) {
    if (!('IntersectionObserver' in window)) return fn();
    var o = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { o.disconnect(); fn(); } }, { threshold: 0.35 });
    o.observe(el);
  }

  /* ---------- podział pracy: te same kroki dziś i po wdrożeniu ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-shift]'), function (el) {
    var tabs = el.querySelectorAll('.shift__tabs button'), modes = el.querySelectorAll('.shift__mode button');
    var lists = el.querySelectorAll('.shift__list'), sum = el.querySelector('.shift__sum');
    var WHO = { ai: 'AI', ty: 'Ty', x: 'niepotrzebne' }, cur = 0, mode = 'dzis', touched = false;
    function plural(n, one, few, many) { return n === 1 ? one : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many); }
    function draw() {
      el.setAttribute('data-mode', mode);
      Array.prototype.forEach.call(tabs, function (b, n) { b.setAttribute('aria-pressed', String(n === cur)); });
      Array.prototype.forEach.call(modes, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === mode)); });
      var count = { ai: 0, ty: 0, x: 0 }, total = 0;
      Array.prototype.forEach.call(lists, function (l, n) {
        l.hidden = n !== cur;
        if (n !== cur) return;
        Array.prototype.forEach.call(l.children, function (li) {
          var who = li.getAttribute('data-who'); count[who]++; total++;
          li.querySelector('.shift__who').textContent = mode === 'ai' ? WHO[who] : 'Ty';
        });
      });
      if (mode === 'dzis') sum.textContent = 'Dziś: ' + total + ' ' + plural(total, 'krok', 'kroki', 'kroków') + ', wszystkie robisz sam.';
      else sum.textContent = 'Z nami: u Ciebie ' + plural(count.ty, 'zostaje', 'zostają', 'zostaje') + ' ' + count.ty + ' ' + plural(count.ty, 'krok', 'kroki', 'kroków') + ', ' + count.ai + ' ' + plural(count.ai, 'robi', 'robi', 'robi') + ' AI' + (count.x ? ', a ' + count.x + ' ' + plural(count.x, 'znika', 'znikają', 'znika') : '') + '.';
    }
    Array.prototype.forEach.call(tabs, function (b, n) { b.addEventListener('click', function () { touched = true; cur = n; draw(); }); });
    Array.prototype.forEach.call(modes, function (b) { b.addEventListener('click', function () { touched = true; mode = b.getAttribute('data-mode'); draw(); if (mode === 'ai') pulse = 1; }); });
    draw();
    // pokaz: zaczynamy od „dziś”, a po chwili sami przełączamy, żeby było widać różnicę
    whenSeen(el, function () { setTimeout(function () { if (!touched) { mode = 'ai'; draw(); } }, reduced ? 0 : 1600); });
  });

  /* ---------- czat-przykład: wybierasz pytanie albo wpisujesz własne; bot odpowiada przygotowaną odpowiedzią i pokazuje źródło ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-chat]'), function (el) {
    var log = el.querySelector('.chatbox__log'), asks = Array.prototype.slice.call(el.querySelectorAll('[data-a]')), reset = el.querySelector('[data-reset]');
    var form = el.querySelector('.chatbox__form'), field = form && form.q, send = form && form.querySelector('button');
    var sources = Array.prototype.slice.call(document.querySelectorAll('.sources [data-src]'));
    var first = log.innerHTML, busy = false;
    function say(cls, text) { var p = document.createElement('p'); p.className = cls; p.textContent = text; log.appendChild(p); log.scrollTop = log.scrollHeight; return p; }
    // bez polskich znaków i wielkich liter, żeby „Ile to KOSZTUJE?” i „cena” trafiały w ten sam temat
    function norm(t) { return t.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function match(q) {
      var n = norm(q), hit = null;
      asks.forEach(function (b) { if (!hit && (b.getAttribute('data-k') || '').split(',').some(function (k) { return k && n.indexOf(k) > -1; })) hit = b; });
      return hit || el.querySelector('[data-fallback]');
    }
    function lock(on) { busy = on; if (send) send.disabled = on; }
    function ask(text, b, typed) {
      if (busy || !b) return;
      lock(true); reset.hidden = false; if (!typed) b.disabled = true; // wpisane pytanie nie wyłącza gotowej podpowiedzi
      say('chat__me', text);
      var dots = say('chat__bot chat__typing', '···');
      setTimeout(function () {
        dots.remove();
        say('chat__bot', b.getAttribute('data-a'));
        var src = b.getAttribute('data-src');
        sources.forEach(function (sp) { if (sp.getAttribute('data-src') === src) { sp.classList.add('is-used'); say('chat__src mono', 'Źródło · ' + sp.textContent); } });
        if (b.getAttribute('data-sys')) say('chat__sys mono', b.getAttribute('data-sys'));
        lock(false);
      }, reduced ? 0 : 750);
    }
    asks.forEach(function (b) { b.addEventListener('click', function () { ask(b.textContent, b); }); });
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = field.value.trim();
      if (!q || busy) return;
      field.value = '';
      ask(q, match(q), true);
    });
    reset.addEventListener('click', function () {
      log.innerHTML = first; asks.forEach(function (b) { b.disabled = false; });
      sources.forEach(function (sp) { sp.classList.remove('is-used'); });
      reset.hidden = true; lock(false);
    });
  });

  /* ---------- kadr reklamy: produkt, format, hasło i strefa bezpieczna ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-formats]'), function (el) {
    var frame = el.querySelector('.formats__frame'), img = frame.querySelector('img'), meta = el.querySelector('.formats__meta'), copy = frame.querySelector('.formats__copy');
    var fBtns = Array.prototype.slice.call(el.querySelectorAll('button[data-f]')), iBtns = Array.prototype.slice.call(el.querySelectorAll('button[data-img]'));
    var cBtns = Array.prototype.slice.call(el.querySelectorAll('button[data-copy]')), safe = el.querySelector('[data-safe]');
    var cur = 0, auto = 0;
    function press(list, n) { list.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === n)); }); }
    function setFormat(n) { cur = n; frame.setAttribute('data-f', fBtns[n].getAttribute('data-f')); meta.textContent = fBtns[n].getAttribute('data-meta'); press(fBtns, n); }
    fBtns.forEach(function (b, k) { b.addEventListener('click', function () { clearInterval(auto); setFormat(k); }); });
    iBtns.forEach(function (b, k) { b.addEventListener('click', function () { clearInterval(auto); img.src = b.getAttribute('data-img'); press(iBtns, k); }); });
    cBtns.forEach(function (b, k) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-copy');
        if (t) copy.textContent = t; // przy „Bez napisu” tekst zostaje i tylko gaśnie, żeby nie skakał
        frame.classList.toggle('is-plain', !t);
        press(cBtns, k);
      });
    });
    if (safe) safe.addEventListener('change', function () { frame.classList.toggle('is-safe', safe.checked); });
    setFormat(0);
    whenSeen(el, function () {
      // pozostałe kadry pobieramy z wyprzedzeniem, żeby zmiana produktu była natychmiastowa
      iBtns.forEach(function (b) { new Image().src = b.getAttribute('data-img'); });
      // dopóki nikt nie kliknie formatu, formaty zmieniają się same
      if (!reduced) auto = setInterval(function () { setFormat((cur + 1) % fBtns.length); }, 2800);
    });
  });

  /* ---------- mini panel treści: pola, kolor i widok zmieniają podgląd strony ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-cms]'), function (el) {
    var form = el.querySelector('form'), site = el.querySelector('.site'), saved = el.querySelector('.site__saved'), outs = {}, savedTimer = 0;
    var colors = Array.prototype.slice.call(el.querySelectorAll('[data-acc]')), views = Array.prototype.slice.call(el.querySelectorAll('[data-view]')).filter(function (b) { return b.tagName === 'BUTTON'; });
    Array.prototype.forEach.call(el.querySelectorAll('[data-out]'), function (o) { outs[o.getAttribute('data-out')] = o; });
    function press(list, n) { list.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === n)); }); }
    function flash() { if (!saved) return; saved.classList.add('is-on'); clearTimeout(savedTimer); savedTimer = setTimeout(function () { saved.classList.remove('is-on'); }, 1400); }
    function sync() {
      ['h', 'p', 'b'].forEach(function (k) { outs[k].textContent = form[k].value.trim() || '…'; });
      outs.hours.hidden = !form.hours.checked;
    }
    form.addEventListener('input', function () { sync(); flash(); }); form.addEventListener('change', sync);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    colors.forEach(function (b, k) { b.addEventListener('click', function () { site.style.setProperty('--acc', b.getAttribute('data-acc')); press(colors, k); flash(); }); });
    views.forEach(function (b, k) { b.addEventListener('click', function () { site.setAttribute('data-view', b.getAttribute('data-view')); press(views, k); }); });
    sync();
  });

  /* ---------- obrazy: pojawiają się po wczytaniu; błąd zostawia opis zamiast pustego pola ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.shot img'), function (img) {
    var ok = function () { img.classList.add('is-loaded'); }, bad = function () { img.parentNode.classList.add('is-broken'); };
    if (img.complete) { if (img.naturalWidth) ok(); else bad(); return; }
    img.addEventListener('load', ok); img.addEventListener('error', bad);
  });

  /* ---------- nawigacja: podkreślona sekcja, w której jesteś (tylko strona główna) ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.bar__nav > a, .nav__has > a')).map(function (a) {
    var hash = a.getAttribute('href').split('#')[1], target = hash && document.getElementById(hash);
    return target ? { a: a, target: target } : null;
  }).filter(Boolean);
  if (navLinks.length) {
    var navQueued = false;
    var navSpy = function () {
      navQueued = false;
      var mid = window.innerHeight * 0.4, here = null;
      navLinks.forEach(function (n) { var r = n.target.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) here = n; });
      navLinks.forEach(function (n) { n.a.classList.toggle('is-here', n === here); });
    };
    window.addEventListener('scroll', function () { if (!navQueued) { navQueued = true; requestAnimationFrame(navSpy); } }, { passive: true });
    navSpy();
  }

  /* ---------- O nas: układ stoi, przewijanie zmienia osobę ---------- */
  var aboutEl = document.querySelector('[data-people]');
  if (aboutEl) {
    var aSlides = Array.prototype.slice.call(aboutEl.querySelectorAll('.about__slide'));
    var aDots = Array.prototype.slice.call(aboutEl.querySelectorAll('.about__dots button'));
    var aCur = -1, aKey = '', aQueued = false;
    aboutSpy = function (force) {
      aQueued = false;
      var r = aboutEl.getBoundingClientRect(), vh = window.innerHeight;
      var idx = Math.max(0, Math.min(aSlides.length - 1, Math.round(-r.top / vh)));
      if (idx !== aCur) {
        aCur = idx;
        aSlides.forEach(function (sl, n) { sl.classList.toggle('is-active', n === idx); sl.inert = n !== idx; });
        aDots.forEach(function (d, n) { if (n === idx) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
        $('aboutN').textContent = idx + 1;
      }
      // sylwetka tylko wtedy, gdy sekcja zajmuje środek ekranu
      var key = r.top <= vh * 0.5 && r.bottom >= vh * 0.5 ? aSlides[idx].getAttribute('data-portrait') : '';
      if (key !== aKey || force) { aKey = key; personHook(key || null, +aSlides[idx].getAttribute('data-ratio') || 1); }
    };
    window.addEventListener('scroll', function () { if (!aQueued) { aQueued = true; requestAnimationFrame(function () { aboutSpy(); }); } }, { passive: true });
    window.addEventListener('resize', function () { aboutSpy(); });
    aDots.forEach(function (d, n) { d.addEventListener('click', function () { window.scrollTo({ top: aboutEl.getBoundingClientRect().top + window.scrollY + n * window.innerHeight, behavior: reduced ? 'auto' : 'smooth' }); }); });
    aboutSpy();
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

  var needs = true;
  var VS = [
    'attribute vec3 aA; attribute vec2 aB; attribute vec2 aC; attribute vec3 aE;',
    'attribute float aD; attribute float aSeed; attribute float aKind; attribute vec2 aF;',
    'uniform float uT, uMix, uAspect, uDpr, uScale, uSize, uIntro, uPulse, uText, uPtrOn;',
    'uniform vec2 uTilt, uShift, uPtr;',
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
    // napis: punkty układają się w litery
    '  float tw = clamp(uText * 1.5 - aSeed * .5, 0., 1.); tw = tw * tw * (3. - 2. * tw);',
    '  p = mix(p, vec3(aF, 0.), tw); al = mix(al, 1., tw);',
    // puls: dotknięcie tła rozsuwa punkty na chwilę
    '  p *= 1. + uPulse * (.1 + aSeed * .55);',
    '  p.yz = rot(uTilt.x) * p.yz; p.xz = rot(uTilt.y) * p.xz;',
    '  p *= uScale;',
    '  float d = 3.2; float k = d / (p.z + d);',
    '  vec2 q = vec2(p.x * k / uAspect + uShift.x, p.y * k + uShift.y);',
    // kursor odpycha punkty
    '  vec2 dq = (q - uPtr) * vec2(uAspect, 1.); float dd = length(dq);',
    '  q += dq / (dd + .0001) / vec2(uAspect, 1.) * uPtrOn * smoothstep(.36, 0., dd) * .12;',
    '  gl_Position = vec4(q, 0., 1.);',
    '  gl_PointSize = max(1., uSize * uDpr * k);',
    '  vAlpha = al * clamp(.35 + (k - .82) * 2.6, .28, 1.);',
    '  vKind = aKind * w(m, 0.) * (1. - tw);',
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
  var ATTR = [['aA', 3, 0], ['aB', 2, 3], ['aC', 2, 5], ['aE', 3, 7], ['aD', 1, 10], ['aSeed', 1, 11], ['aKind', 1, 12]].map(function (a) { return [gl.getAttribLocation(prog, a[0]), a[1], a[2]]; });
  (function bindParticles() {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    ATTR.forEach(function (a) {
      if (a[0] < 0) return;
      gl.enableVertexAttribArray(a[0]);
      gl.vertexAttribPointer(a[0], a[1], gl.FLOAT, false, STRIDE * 4, a[2] * 4);
    });
  })();

  // osobny bufor na cele napisu — podmieniany przy każdym nowym słowie
  var tbuf = gl.createBuffer(), tdata = new Float32Array(N * 2), locF = gl.getAttribLocation(prog, 'aF');
  gl.bindBuffer(gl.ARRAY_BUFFER, tbuf);
  gl.bufferData(gl.ARRAY_BUFFER, tdata, gl.DYNAMIC_DRAW);
  if (locF >= 0) { gl.enableVertexAttribArray(locF); gl.vertexAttribPointer(locF, 2, gl.FLOAT, false, 0, 0); } // bufor napisu musi być podpięty zaraz po utworzeniu
  var textW = 0, textTarget = 0, textTimer = 0;
  function makeText(str) {
    var cw = 1024, ch = 512, c2 = document.createElement('canvas');
    c2.width = cw; c2.height = ch;
    var x2 = c2.getContext('2d');
    if (!x2) return false;
    var fam = 'px "Mona Sans", "Helvetica Neue", Arial, sans-serif', size = 300;
    x2.font = '300 ' + size + fam;
    var mw = x2.measureText(str).width;
    if (!mw) return false;
    size = Math.min(430, size * cw * 0.94 / mw);
    x2.font = '300 ' + size + fam;
    x2.textAlign = 'center'; x2.textBaseline = 'middle';
    x2.fillText(str, cw / 2, ch / 2);
    var px = x2.getImageData(0, 0, cw, ch).data, pts = [];
    for (var ty = 0; ty < ch; ty += 2) for (var txx = 0; txx < cw; txx += 2) if (px[(ty * cw + txx) * 4 + 3] > 128) pts.push(txx, ty);
    if (!pts.length) return false;
    var cnt = pts.length / 2;
    for (var k = 0; k < N; k++) {
      var j = Math.floor(Math.random() * cnt);
      tdata[k * 2] = (pts[j * 2] + Math.random() * 2) / cw * 2 - 1;
      tdata[k * 2 + 1] = -((pts[j * 2 + 1] + Math.random() * 2) - ch / 2) / (cw / 2);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, tbuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, tdata);
    return true;
  }
  // sylwetki w „O nas”: gotowe współrzędne punktów (media/osoba-*.bin), układane tym samym mechanizmem co napisy
  var people = {}, shownRatio = 1, portraitOn = false, shownKey = null, wantKey = null, swapTimer = 0;
  function personSize() { return !narrow ? 1.0 : H < 620 ? 0.5 : H < 720 ? 0.62 : 0.8; }
  function fillPerson(pts, ratio) {
    // połowa wysokości postaci w jednostkach sceny; na telefonie mniejsza (a na niskim jeszcze mniejsza), żeby nie wchodziła na tekst
    var n = pts.length / 2, hh = personSize();
    for (var k = 0; k < N; k++) {
      var j = k % n;
      tdata[k * 2] = (pts[j * 2] / 255 * 2 - 1) * hh * ratio + (Math.random() - 0.5) * 0.008;
      tdata[k * 2 + 1] = -(pts[j * 2 + 1] / 255 * 2 - 1) * hh + (Math.random() - 0.5) * 0.008;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, tbuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, tdata);
  }
  function showPerson(key, ratio) {
    wantKey = key;
    if (!key) {
      clearTimeout(swapTimer);
      if (portraitOn) { textTarget = 0; portraitOn = false; portraitShown = false; shownKey = null; shownScene = -1; needs = true; }
      return;
    }
    if (people[key] === undefined) { // pierwsze wejście: pobierz punkty tej osoby
      people[key] = null;
      fetch('media/osoba-' + key + '.bin').then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (b) { if (b) { people[key] = new Uint8Array(b); if (wantKey === key) showPerson(key, ratio); } }).catch(function () {});
      return;
    }
    if (!people[key] || shownKey === key) return;
    clearTimeout(textTimer); clearTimeout(swapTimer);
    var go = function () { shownRatio = ratio; fillPerson(people[key], ratio); textTarget = 1; portraitOn = true; portraitShown = true; shownKey = key; shownScene = -1; needs = true; };
    // zmiana osoby: najpierw punkty się rozchodzą, potem składają nową sylwetkę
    if (portraitOn && textW > 0.3) { textTarget = 0; shownKey = null; swapTimer = setTimeout(function () { if (wantKey === key) go(); }, 450); } else go();
  }
  personHook = showPerson;
  if (aboutSpy) aboutSpy(true);

  showText = function (str, hold) {
    if (!makeText(str)) return false;
    portraitOn = false; portraitShown = false; shownKey = null;
    textTarget = 1; needs = true;
    clearTimeout(textTimer);
    if (hold) textTimer = setTimeout(function () { textTarget = 0; }, hold);
    return true;
  };

  var U = {};
  ['uT', 'uMix', 'uAspect', 'uDpr', 'uScale', 'uSize', 'uIntro', 'uPulse', 'uText', 'uPtrOn', 'uPtr', 'uTilt', 'uShift', 'uInk', 'uSignal', 'uAlpha'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
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
  var formTag = document.querySelector('.scene--form .tag');
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // wąski ekran = forma nad tekstem; telefon poziomo liczy się jak szeroki (ten sam warunek co w styles.css)
    narrow = W < 860 && !(H <= 520 && W / H >= 1.3);
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
  var ptrOn = 0, ptrSeen = 0, cx = 0, cy = 0, cxT = 0, cyT = 0, lastY = window.scrollY, hoverForm = null;
  function retarget() { mixTarget = hoverForm !== null ? hoverForm : scrollMix(); needs = true; }
  forceForm = function (n) { hoverForm = n; retarget(); return true; };
  var t0 = performance.now(), last = t0;
  var frames = 0, fpsAt = t0, visible = true;
  // pierwsze wejście składa formę powoli; kolejne podstrony — szybciej
  var introTime = read(sessionStorage, 'fila-seen') ? 1.3 : 2.6;
  write(sessionStorage, 'fila-seen', '1');

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    ptrX = e.clientX / window.innerWidth - 0.5;
    ptrY = e.clientY / window.innerHeight - 0.5;
    cxT = ptrX * 2; cyT = -ptrY * 2;
    if (!ptrSeen) { cx = cxT; cy = cyT; }
    ptrSeen = 1;
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    if (reduced || (e.target.closest && e.target.closest('a, button, input, textarea, label, .cmd'))) return;
    pulse = 1;
  }, { passive: true });
  root.addEventListener('mouseleave', function () { ptrSeen = 0; });
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    if (!reduced) pulse = Math.max(pulse, Math.min(0.2, Math.abs(y - lastY) / 1100)); // przewijanie lekko rozsuwa formę
    lastY = y;
    retarget();
  }, { passive: true });
  window.addEventListener('resize', function () {
    var was = personSize();
    resize(); retarget();
    // obrót telefonu albo zmiana okna: sylwetka ma inny rozmiar w każdym układzie, więc trzeba ją ułożyć od nowa
    // (ale nie przy samym chowaniu się paska adresu, gdy rozmiar zostaje ten sam)
    if (portraitOn && shownKey && people[shownKey] && was !== personSize()) fillPerson(people[shownKey], shownRatio);
  });
  // najechanie na usługę pokazuje jej formę
  Array.prototype.forEach.call(document.querySelectorAll('[data-hover-form]'), function (el) {
    el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'touch') return; hoverForm = +el.getAttribute('data-hover-form'); retarget(); });
    el.addEventListener('pointerleave', function () { hoverForm = null; retarget(); });
  });
  var pageText = body.getAttribute('data-text');
  if (pageText) (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { setTimeout(function () { showText(pageText); }, reduced ? 0 : 700); });
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; last = performance.now(); });

  function wgt(m, i) { return Math.max(0, 1 - Math.abs(m - i)); }

  // pole punktów widać tylko przez przezroczyste sekcje; gdy żadnej nie ma na ekranie, nie rysujemy (bateria)
  var shown = true;
  if ('IntersectionObserver' in window) {
    var clear = Array.prototype.slice.call(document.querySelectorAll('.scene, .block')), onNow = 0;
    if (clear.length) {
      var seeIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { var was = !!e.target._on; e.target._on = e.isIntersecting; onNow += (e.isIntersecting ? 1 : 0) - (was ? 1 : 0); });
        shown = onNow > 0; needs = true;
        body.classList.toggle('is-covered', !shown);
      });
      clear.forEach(function (el) { seeIO.observe(el); });
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    if (!shown && textTarget === 0) { last = now; fpsAt = now; frames = 0; return; }
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var t = reduced ? 0 : (now - t0) / 1000;

    mix += (mixTarget - mix) * (reduced ? 1 : Math.min(1, dt * 5));
    pulse *= Math.exp(-dt * 3.2);
    textW += (textTarget - textW) * (reduced ? 1 : Math.min(1, dt * 2.4));
    ptrOn += ((ptrSeen && !reduced ? 1 : 0) - ptrOn) * Math.min(1, dt * 4);
    cx += (cxT - cx) * Math.min(1, dt * 9); cy += (cyT - cy) * Math.min(1, dt * 9);
    // tęczówka patrzy za kursorem; pozostałe formy tylko lekko się przechylają
    var look = 0.35 + 0.65 * wgt(mix, 0);
    var tx = -0.22 + ptrY * 0.7 * look, ty = -0.3 + ptrX * 0.9 * look;
    tiltX += (tx - tiltX) * Math.min(1, dt * 3.5);
    tiltY += (ty - tiltY) * Math.min(1, dt * 3.5);

    if (reduced && !needs) return;
    needs = false;

    var intro = reduced ? 1 : Math.min(1, t / introTime);
    var top = 1, end = 0;
    if (narrow) {
      // na telefonie obiekt jest widoczny tylko tam, gdzie ma miejsce: u góry strony i przy kontakcie
      if (pin !== null) { top = Math.max(0, 1 - window.scrollY / (H * 0.32)); end = 0; }
      else { top = wgt(mix, 0); end = wgt(mix, 4); }
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uMix, mix);
    gl.uniform1f(U.uIntro, intro);
    gl.uniform1f(U.uPulse, pulse);
    var flat = 1 - 0.9 * textW; // napis ma być czytelny, więc prostuje formę
    gl.uniform1f(U.uText, textW);
    gl.uniform1f(U.uPtrOn, ptrOn);
    gl.uniform2f(U.uPtr, cx, cy);
    gl.uniform2f(U.uTilt, (reduced ? -0.22 : tiltX) * flat, (reduced ? -0.3 : tiltY) * flat);
    var sx = narrow ? 0 : 0.5;
    var sy = narrow ? (0.45 * top + 0.62 * end) * (1 - textW) + (portraitOn ? 0.46 : 0.4) * textW : 0.02;
    // za tekstem obiekt jest ledwie widoczny, żeby nie utrudniał czytania
    var al = narrow ? Math.max(0.1 + 0.66 * top + 0.56 * end, 0.85 * textW) : 0.86;
    if (narrow && formTag) {
      // strona z formularzem nie ma nad nagłówkiem miejsca na obiekt: punkt stoi w wolnym polu obok etykiety i przewija się razem z nią
      var fr = formTag.getBoundingClientRect();
      sx = 0.62 * (1 - textW);
      sy = (1 - 2 * (fr.top + fr.height / 2) / H) * (1 - textW) + 0.4 * textW;
      al = Math.max(0.8, 0.85 * textW);
    }
    gl.uniform2f(U.uShift, sx, sy);
    gl.uniform1f(U.uAlpha, al);
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
