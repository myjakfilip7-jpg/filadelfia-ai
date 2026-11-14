/* Panel właściciela Filadelfia.ai: skrzynka zgłoszeń. Wymaga backendu (server/server.mjs). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var gate = $('gate'), gateBody = $('gateBody'), desk = $('desk');
  if (!gate) return;

  var ERRORS = {
    odmowa: 'Logowanie przerwane po stronie GitHuba.',
    stan: 'Sesja logowania wygasła albo nie pasuje. Spróbuj jeszcze raz.',
    'brak-dostepu': 'To konto GitHub nie ma dostępu do panelu.',
    github: 'GitHub nie potwierdził logowania. Spróbuj jeszcze raz.',
    konfiguracja: 'Logowanie nie jest jeszcze skonfigurowane na serwerze.'
  };
  var state = { me: null, items: [], tematy: {}, statusy: [], tab: 'wszystkie', topic: '', q: '', sel: null, view: 'zgloszenia', days: 30 };
  function can(what) { return !!state.me && state.me.moze.indexOf(what) >= 0; }

  /* ---------- narzędzia ---------- */
  // Wszystko, co pochodzi od obcych osób, trafia na stronę jako tekst (textContent), nigdy jako HTML.
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function empty(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ Accept: 'application/json', 'x-fila': '1' }, opts.body ? { 'Content-Type': 'application/json' } : {});
    return fetch(path, opts).then(function (r) {
      if (r.status === 401 && state.me) { location.reload(); throw new Error('sesja'); }
      return r;
    });
  }
  var fmtFull = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Warsaw' });
  var fmtDay = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', timeZone: 'Europe/Warsaw' });
  var fmtTime = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
  function shortDate(iso) {
    var d = new Date(iso), now = new Date();
    return fmtDay.format(d) === fmtDay.format(now) && now - d < 864e5 ? fmtTime.format(d) : fmtDay.format(d);
  }
  var toastEl = $('toast'), toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text; toastEl.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 2600);
  }
  function find(id) { for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i]; return null; }
  function replace(row) { for (var i = 0; i < state.items.length; i++) if (state.items[i].id === row.id) state.items[i] = row; }

  /* ---------- brama ---------- */
  function showGate(nodes) { desk.hidden = true; gate.hidden = false; empty(gateBody); nodes.forEach(function (n) { gateBody.appendChild(n); }); }
  function showOffline() { showGate([el('p', 'lead', 'Panel działa tylko tam, gdzie uruchomiony jest backend. Ta kopia strony to same pliki statyczne.')]); }
  function showLogin(canLogin) {
    var nodes = [], err = ERRORS[new URLSearchParams(location.search).get('blad')];
    if (err) nodes.push(el('p', 'gate__err mono', err));
    if (!canLogin) { nodes.push(el('p', 'lead', 'Logowanie nie jest jeszcze skonfigurowane. Uzupełnij dane aplikacji GitHub w pliku server/.env i uruchom serwer ponownie.')); return showGate(nodes); }
    nodes.push(el('p', 'lead', 'Dostęp mają tylko konta GitHub wpisane na listę właścicieli.'));
    var p = el('p', 'actions'), a = el('a', 'pill gh');
    a.href = 'auth/github';
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path');
    svg.setAttribute('width', '18'); svg.setAttribute('height', '18'); svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('fill', 'currentColor');
    path.setAttribute('d', 'M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8 8 0 0 0 8 0Z');
    svg.appendChild(path); a.appendChild(svg); a.appendChild(document.createTextNode('Zaloguj przez GitHub'));
    p.appendChild(a); nodes.push(p);
    showGate(nodes);
  }

  /* ---------- filtrowanie ---------- */
  function visible() {
    var q = state.q.trim().toLowerCase();
    return state.items.filter(function (z) {
      if (state.tab !== 'wszystkie' && z.status !== state.tab) return false;
      if (state.topic && z.temat !== state.topic) return false;
      if (!q) return true;
      return [z.imie, z.firma, z.kontakt, z.opis].join('\n').toLowerCase().indexOf(q) >= 0;
    });
  }

  /* ---------- zakładki z licznikami ---------- */
  function renderTabs() {
    var tabs = $('tabs'), counts = { wszystkie: state.items.length };
    state.statusy.forEach(function (s) { counts[s] = 0; });
    state.items.forEach(function (z) { counts[z.status] = (counts[z.status] || 0) + 1; });
    empty(tabs);
    state.statusy.concat(['wszystkie']).forEach(function (key) {
      var b = el('button', 'tab mono' + (key === 'nowe' && counts.nowe ? ' tab--new' : ''));
      b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(state.tab === key));
      b.appendChild(el('b', null, String(counts[key] || 0)));
      b.appendChild(document.createTextNode(key));
      b.addEventListener('click', function () { state.tab = key; render(); });
      tabs.appendChild(b);
    });
    document.title = (counts.nowe ? '(' + counts.nowe + ') ' : '') + 'Panel — Filadelfia.ai';
  }

  /* ---------- lista ---------- */
  function renderList() {
    var inbox = $('inbox'), list = visible();
    empty(inbox);
    if (!list.length) {
      inbox.appendChild(el('li', 'inbox__empty', state.items.length ? 'Nic nie pasuje do filtrów.' : 'Nie ma jeszcze zgłoszeń. Pojawią się tu po wysłaniu formularza kontaktowego.'));
      return;
    }
    list.forEach(function (z) {
      var li = el('li'), b = el('button', 'row' + (z.przeczytane ? '' : ' row--unread') + (z.status === 'zamknięte' ? ' row--done' : ''));
      b.type = 'button'; b.setAttribute('data-id', z.id);
      if (z.id === state.sel) b.setAttribute('aria-current', 'true');
      var top = el('span', 'row__top');
      top.appendChild(el('span', 'row__name', z.imie));
      top.appendChild(el('span', 'row__time mono', shortDate(z.at)));
      b.appendChild(top);
      b.appendChild(el('span', 'row__sub', [z.firma, state.tematy[z.temat] || z.temat].filter(Boolean).join(' · ')));
      b.appendChild(el('span', 'row__text', z.opis.replace(/\s+/g, ' ')));
      b.addEventListener('click', function () { select(z.id, true); });
      li.appendChild(b); inbox.appendChild(li);
    });
  }

  /* ---------- szczegóły ---------- */
  function section(label) { var s = el('section', 'sec'); s.appendChild(el('span', 'mono', label)); return s; }
  function contactLink(z) {
    var c = z.kontakt.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return { href: 'mailto:' + c + '?subject=' + encodeURIComponent('Filadelfia.ai — odpowiedź na zapytanie') + '&body=' + encodeURIComponent('Dzień dobry,\n\n'), label: 'Odpisz e-mailem' };
    var tel = c.replace(/[^\d+]/g, '');
    if (tel.length >= 7) return { href: 'tel:' + tel, label: 'Zadzwoń' };
    return null;
  }
  function renderDetail() {
    var box = $('detail'), z = state.sel && find(state.sel);
    empty(box);
    if (!z) { box.appendChild(el('p', 'detail__empty', state.items.length ? 'Wybierz zgłoszenie z listy.' : '')); return; }

    var back = el('button', 'more detail__back', '← Lista'); back.type = 'button';
    back.addEventListener('click', function () { $('deskBody').classList.remove('is-open'); });
    box.appendChild(back);

    var meta = el('p', 'detail__meta mono');
    meta.appendChild(el('span', null, state.tematy[z.temat] || z.temat));
    meta.appendChild(el('span', null, fmtFull.format(new Date(z.at))));
    box.appendChild(meta);
    box.appendChild(el('h1', null, z.imie));
    box.appendChild(el('p', 'detail__who', [z.firma, z.kontakt].filter(Boolean).join(' · ') || 'Brak danych kontaktowych'));

    var act = el('p', 'detail__act'), link = contactLink(z);
    if (link) { var a = el('a', 'pill', link.label); a.href = link.href; act.appendChild(a); }
    if (z.kontakt) {
      var copy = el('button', 'more', 'Kopiuj kontakt'); copy.type = 'button';
      copy.addEventListener('click', function () {
        if (!navigator.clipboard) return toast('Ta przeglądarka nie pozwala kopiować');
        navigator.clipboard.writeText(z.kontakt).then(function () { toast('Skopiowano kontakt'); }, function () { toast('Nie udało się skopiować'); });
      });
      act.appendChild(copy);
    }
    if (can('zmieniac')) {
      var unread = el('button', 'more', 'Oznacz jako nieprzeczytane'); unread.type = 'button';
      unread.addEventListener('click', function () { patch(z.id, { przeczytane: false }).then(function () { state.sel = null; $('deskBody').classList.remove('is-open'); render(); }); });
      act.appendChild(unread);
    }
    box.appendChild(act);

    box.appendChild(el('p', 'detail__text', z.opis));

    var st = section('Status'), seg = el('div', 'seg');
    seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Status zgłoszenia');
    state.statusy.forEach(function (s) {
      var b = el('button', null, s); b.type = 'button'; b.setAttribute('aria-pressed', String(s === z.status)); b.disabled = !can('zmieniac');
      b.addEventListener('click', function () { if (s !== z.status) patch(z.id, { status: s }).then(function () { toast('Status: ' + s); render(); }); });
      seg.appendChild(b);
    });
    st.appendChild(seg); box.appendChild(st);

    var notes = section('Notatki — widoczne tylko w panelu');
    z.notatki.forEach(function (n) {
      var item = el('div', 'note'), m = el('div', 'note__meta mono');
      item.appendChild(el('p', null, n.tekst));
      m.appendChild(el('span', null, fmtFull.format(new Date(n.at)) + ' · @' + n.kto));
      if (can('zmieniac')) {
        var del = el('button', null, 'Usuń'); del.type = 'button';
        del.addEventListener('click', function () {
          api('api/zgloszenia/' + z.id + '/notatki/' + n.id, { method: 'DELETE' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (row) { if (row) { replace(row); render(); } });
        });
        m.appendChild(del);
      }
      item.appendChild(m); notes.appendChild(item);
    });
    var form = el('form', 'noteform'), ta = el('textarea'), add = el('button', 'more', 'Dodaj notatkę');
    ta.rows = 1; ta.maxLength = 2000; ta.placeholder = 'Np. oddzwonić w piątek'; ta.setAttribute('aria-label', 'Nowa notatka');
    add.type = 'submit';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = ta.value.trim();
      if (!text) return ta.focus();
      api('api/zgloszenia/' + z.id + '/notatki', { method: 'POST', body: JSON.stringify({ tekst: text }) }).then(function (r) { return r.ok ? r.json() : null; }).then(function (row) {
        if (!row) return toast('Nie udało się zapisać notatki');
        replace(row); render(); toast('Notatka zapisana');
      });
    });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) form.requestSubmit(); });
    form.appendChild(ta); form.appendChild(add);
    if (can('zmieniac')) notes.appendChild(form);
    else if (!z.notatki.length) notes.appendChild(el('p', 'detail__empty', 'Brak notatek.'));
    box.appendChild(notes);

    var hist = section('Historia'), ul = el('ul', 'hist');
    var first = el('li'); first.appendChild(el('time', null, fmtFull.format(new Date(z.at)))); first.appendChild(el('span', null, 'zgłoszenie wysłane z formularza')); ul.appendChild(first);
    z.historia.forEach(function (h) { var li = el('li'); li.appendChild(el('time', null, fmtFull.format(new Date(h.at)))); li.appendChild(el('span', null, h.co + ' · @' + h.kto)); ul.appendChild(li); });
    hist.appendChild(ul); box.appendChild(hist);

    var danger = el('p', 'danger'), del = el('button', 'more', 'Usuń zgłoszenie'); del.type = 'button';
    del.addEventListener('click', function () {
      confirmBox('Usunąć zgłoszenie od: ' + z.imie + '? Znikną też notatki. Tego nie da się cofnąć.').then(function (yes) {
        if (!yes) return;
        api('api/zgloszenia/' + z.id, { method: 'DELETE' }).then(function (r) {
          if (!r.ok) return toast('Nie udało się usunąć');
          state.items = state.items.filter(function (x) { return x.id !== z.id; });
          state.sel = null; $('deskBody').classList.remove('is-open'); render(); toast('Usunięto');
        });
      });
    });
    danger.appendChild(del); if (can('usuwac')) box.appendChild(danger);
    box.scrollTop = 0;
  }

  function confirmBox(text) {
    var dlg = $('confirm');
    $('confirmText').textContent = text;
    if (!dlg.showModal) return Promise.resolve(window.confirm(text));
    return new Promise(function (resolve) {
      dlg.returnValue = 'nie';
      dlg.addEventListener('close', function done() { dlg.removeEventListener('close', done); resolve(dlg.returnValue === 'tak'); });
      dlg.showModal();
    });
  }

  function patch(id, body) {
    return api('api/zgloszenia/' + id, { method: 'PATCH', body: JSON.stringify(body) }).then(function (r) { return r.ok ? r.json() : null; }).then(function (row) { if (row) replace(row); else toast('Nie udało się zapisać'); return row; });
  }
  function select(id, open) {
    state.sel = id;
    if (open) $('deskBody').classList.add('is-open');
    history.replaceState(null, '', id ? '#' + id : location.pathname);
    var z = find(id);
    render();
    if (z && !z.przeczytane && can('zmieniac')) patch(id, { przeczytane: true }).then(function () { renderTabs(); renderList(); });
  }
  function render() { renderTabs(); renderList(); renderDetail(); }

  /* ---------- dane ---------- */
  function load(first) {
    return api('api/zgloszenia').then(function (r) { return r.json(); }).then(function (d) {
      var before = state.items.length;
      state.items = d.zgloszenia; state.tematy = d.tematy; state.statusy = d.statusy;
      if (first) {
        var sel = $('topic'); empty(sel);
        var all = el('option', null, 'Wszystkie tematy'); all.value = ''; sel.appendChild(all);
        Object.keys(d.tematy).forEach(function (k) { var o = el('option', null, d.tematy[k]); o.value = k; sel.appendChild(o); });
        var want = location.hash.slice(1);
        if (want && find(want)) state.sel = want;
        render();
        return;
      }
      if (state.sel && !find(state.sel)) state.sel = null;
      // odświeżenie w tle nie może zgubić pisanej notatki
      var typing = document.activeElement && document.activeElement.tagName === 'TEXTAREA' && document.activeElement.value;
      renderTabs(); renderList(); if (!typing) renderDetail();
      if (d.zgloszenia.length > before) toast('Nowe zgłoszenie');
    });
  }

  /* ---------- widoki ---------- */
  function show(view) {
    state.view = view;
    desk.hidden = view !== 'zgloszenia'; $('stats').hidden = view !== 'statystyki'; $('people').hidden = view !== 'uzytkownicy';
    Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (b) { if (b.getAttribute('data-view') === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (view === 'statystyki') loadStats();
    if (view === 'uzytkownicy') loadPeople();
  }

  /* ---------- statystyki ---------- */
  var nf = new Intl.NumberFormat('pl-PL');
  var fmtBar = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  function dayLabel(key) { return fmtBar.format(new Date(key + 'T12:00:00Z')); }
  function kpi(label, value, sub) { var d = el('div', 'kpi'); d.appendChild(el('span', 'mono', label)); d.appendChild(el('b', null, nf.format(value))); if (sub) d.appendChild(el('span', 'kpi__sub', sub)); return d; }
  function bars(list, target, none) {
    empty(target);
    if (!list.length) { target.appendChild(el('li', 'bars__none', none)); return; }
    var max = list[0].liczba || 1;
    list.forEach(function (it) {
      var li = el('li'), track = el('span', 'bars__track'), fill = el('span', 'bars__fill');
      fill.style.width = Math.max(1.5, it.liczba / max * 100) + '%';
      track.appendChild(fill);
      li.appendChild(el('span', 'bars__name', it.nazwa)); li.appendChild(el('span', 'bars__val mono', nf.format(it.liczba))); li.appendChild(track);
      target.appendChild(li);
    });
  }
  function loadStats() {
    var range = $('range');
    if (!range.firstChild) [7, 30, 90].forEach(function (n) {
      var b = el('button', null, n + ' dni'); b.type = 'button'; b.setAttribute('data-n', n);
      b.addEventListener('click', function () { state.days = n; loadStats(); });
      range.appendChild(b);
    });
    Array.prototype.forEach.call(range.children, function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-n') === state.days)); });
    api('api/statystyki?dni=' + state.days).then(function (r) { return r.json(); }).then(function (d) {
      var days = d.dni, last = days[days.length - 1], week = days.slice(-7).reduce(function (a, x) { return a + x.odslony; }, 0);
      var k = $('kpis'); empty(k);
      k.appendChild(kpi('Odsłony dziś', last.odslony, nf.format(last.unikalni) + ' unikalnych'));
      k.appendChild(kpi('Odsłony, 7 dni', week));
      k.appendChild(kpi('Odsłony, ' + state.days + ' dni', d.razem.odslony));
      k.appendChild(kpi('Unikalni, ' + state.days + ' dni', d.razem.unikalni, 'suma dzienna'));

      // wykres: jedna seria (odsłony dziennie), słupki od linii zera, podpowiedź pod kursorem i z klawiatury
      var fig = $('chart'); empty(fig);
      var cap = el('figcaption', 'mono', 'Odsłony dziennie'); fig.appendChild(cap);
      var max = Math.max.apply(null, days.map(function (x) { return x.odslony; }));
      if (!max) { fig.appendChild(el('p', 'chart__none', 'Brak odsłon w tym okresie. Licznik działa od chwili uruchomienia serwera.')); }
      else {
        var top = Math.max(4, Math.ceil(max / 4) * 4), plot = el('div', 'chart__plot'), tip = el('div', 'chart__tip');
        plot.setAttribute('role', 'list');
        [1, 0.5].forEach(function (f) { var g = el('span', 'chart__grid'); g.style.bottom = f * 100 + '%'; g.appendChild(el('span', 'mono', nf.format(top * f))); plot.appendChild(g); });
        days.forEach(function (x) {
          var col = el('div', 'chart__col'), bar = el('span', 'chart__bar');
          bar.style.height = (x.odslony / top * 100) + '%';
          col.tabIndex = 0; col.setAttribute('role', 'listitem');
          col.setAttribute('aria-label', dayLabel(x.dzien) + ': ' + x.odslony + ' odsłon, ' + x.unikalni + ' unikalnych');
          var showTip = function () {
            empty(tip); tip.appendChild(el('span', 'mono', dayLabel(x.dzien))); tip.appendChild(el('b', null, nf.format(x.odslony) + ' odsłon')); tip.appendChild(el('span', null, nf.format(x.unikalni) + ' unikalnych'));
            var r = col.getBoundingClientRect(), pr = plot.getBoundingClientRect(), mid = r.left + r.width / 2 - pr.left;
            tip.style.left = Math.max(70, Math.min(pr.width - 70, mid)) + 'px'; tip.classList.add('on');
          };
          col.addEventListener('pointerenter', showTip); col.addEventListener('focus', showTip);
          col.addEventListener('pointerleave', function () { tip.classList.remove('on'); }); col.addEventListener('blur', function () { tip.classList.remove('on'); });
          col.appendChild(bar); plot.appendChild(col);
        });
        plot.appendChild(tip); fig.appendChild(plot);
        var axis = el('div', 'chart__axis mono');
        axis.appendChild(el('span', null, dayLabel(days[0].dzien))); axis.appendChild(el('span', null, dayLabel(last.dzien)));
        fig.appendChild(axis);
      }
      // ta sama seria jako tabela
      var det = el('details', 'chart__table'), sum = el('summary', 'mono', 'Pokaż jako tabelę'), table = el('table'), head = el('tr');
      ['Dzień', 'Odsłony', 'Unikalni'].forEach(function (h) { head.appendChild(el('th', null, h)); });
      table.appendChild(head);
      days.slice().reverse().forEach(function (x) { var tr = el('tr'); tr.appendChild(el('td', null, dayLabel(x.dzien))); tr.appendChild(el('td', null, nf.format(x.odslony))); tr.appendChild(el('td', null, nf.format(x.unikalni))); table.appendChild(tr); });
      det.appendChild(sum); det.appendChild(table); fig.appendChild(det);

      bars(d.strony, $('topPages'), 'Brak danych.');
      bars(d.zrodla, $('topSources'), 'Brak danych.');
    }).catch(function () { toast('Nie udało się wczytać statystyk'); });
  }

  /* ---------- użytkownicy i role ---------- */
  var PEOPLE_ERR = { 'zly-login': 'To nie wygląda na login GitHub.', 'juz-jest': 'Ten użytkownik ma już dostęp.', 'za-duzo': 'Osiągnięto limit 50 użytkowników.', 'staly-wlasciciel': 'Stałego właściciela zmienia się tylko w pliku server/.env.' };
  function renderPeople(d) {
    var list = $('peopleList'), sel = $('newRole'); empty(list);
    if (!sel.firstChild) Object.keys(d.role).forEach(function (k) { var o = el('option', null, d.role[k]); o.value = k; o.selected = k === 'pracownik'; sel.appendChild(o); });
    d.uzytkownicy.forEach(function (u) {
      var li = el('li'), who = el('div', 'people__who');
      who.appendChild(el('strong', null, '@' + u.login));
      who.appendChild(el('span', 'mono', u.ostatnie ? 'ostatnie logowanie: ' + fmtFull.format(new Date(u.ostatnie)) : 'jeszcze się nie logował'));
      li.appendChild(who);
      if (u.staly) { li.appendChild(el('span', 'people__fixed mono', d.role[u.rola] + ' · stały, z pliku .env')); list.appendChild(li); return; }
      var role = el('select', 'desk__sel'); role.setAttribute('aria-label', 'Rola użytkownika @' + u.login);
      Object.keys(d.role).forEach(function (k) { var o = el('option', null, d.role[k]); o.value = k; o.selected = k === u.rola; role.appendChild(o); });
      role.addEventListener('change', function () {
        api('api/uzytkownicy/' + encodeURIComponent(u.login), { method: 'PATCH', body: JSON.stringify({ rola: role.value }) }).then(function (r) { return r.json().then(function (b) { if (r.ok) { renderPeople(b); toast('@' + u.login + ': ' + d.role[role.value]); } else { role.value = u.rola; toast('Nie udało się zmienić roli'); } }); });
      });
      var del = el('button', 'more', 'Odbierz dostęp'); del.type = 'button';
      del.addEventListener('click', function () {
        confirmBox('Odebrać dostęp użytkownikowi @' + u.login + '? Zostanie wylogowany od razu.').then(function (yes) {
          if (!yes) return;
          api('api/uzytkownicy/' + encodeURIComponent(u.login), { method: 'DELETE' }).then(function (r) { return r.json().then(function (b) { if (r.ok) { renderPeople(b); toast('Odebrano dostęp'); } }); });
        });
      });
      li.appendChild(role); li.appendChild(del); list.appendChild(li);
    });
  }
  function loadPeople() { api('api/uzytkownicy').then(function (r) { return r.json(); }).then(renderPeople).catch(function () { toast('Nie udało się wczytać użytkowników'); }); }
  $('addUser').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('peopleErr'); err.textContent = '';
    api('api/uzytkownicy', { method: 'POST', body: JSON.stringify({ login: $('newLogin').value, rola: $('newRole').value }) }).then(function (r) {
      return r.json().then(function (b) {
        if (!r.ok) { err.textContent = PEOPLE_ERR[b.blad] || 'Nie udało się dodać użytkownika.'; return; }
        $('newLogin').value = ''; renderPeople(b); toast('Dodano użytkownika');
      });
    });
  });

  function start(me) {
    state.me = me;
    gate.hidden = true; desk.hidden = false;
    $('user').hidden = false;
    $('login').textContent = '@' + me.login;
    $('role').textContent = (me.role && me.role[me.rola]) || me.rola;
    $('csv').hidden = !can('eksport');
    $('nav').hidden = false;
    $('navUsers').hidden = !can('uzytkownicy');
    Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-view')); }); });
    if (/^https:\/\/avatars\.githubusercontent\.com\//.test(me.avatar || '')) { $('avatar').src = me.avatar; $('avatar').hidden = false; }
    $('logout').addEventListener('click', function () { api('auth/logout', { method: 'POST' }).then(function () { location.href = 'panel.html'; }); });
    $('q').addEventListener('input', function (e) { state.q = e.target.value; renderList(); });
    $('topic').addEventListener('change', function (e) { state.topic = e.target.value; renderList(); });
    var tb = $('themeBtn'), root = document.documentElement;
    function themeLabel() { tb.textContent = root.getAttribute('data-theme') === 'noc' ? 'Tryb dzienny' : 'Tryb nocny'; }
    tb.addEventListener('click', function () {
      var night = root.getAttribute('data-theme') !== 'noc';
      if (night) root.setAttribute('data-theme', 'noc'); else root.removeAttribute('data-theme');
      try { localStorage.setItem('fila-theme', night ? 'noc' : 'dzien'); } catch (e) {}
      themeLabel();
    });
    themeLabel();

    // klawiatura: / szuka, j/k albo strzałki zmieniają zgłoszenie, Esc wraca do listy
    document.addEventListener('keydown', function (e) {
      var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      if (e.key === 'Escape') { if (typing) t.blur(); else $('deskBody').classList.remove('is-open'); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || $('confirm').open || state.view !== 'zgloszenia') return;
      if (e.key === '/') { e.preventDefault(); $('q').focus(); return; }
      var dir = e.key === 'j' || e.key === 'ArrowDown' ? 1 : e.key === 'k' || e.key === 'ArrowUp' ? -1 : 0;
      if (!dir) return;
      var list = visible(); if (!list.length) return;
      var i = -1; for (var n = 0; n < list.length; n++) if (list[n].id === state.sel) i = n;
      var next = list[Math.max(0, Math.min(list.length - 1, i + dir))];
      e.preventDefault(); select(next.id, false);
      var btn = document.querySelector('.row[data-id="' + next.id + '"]'); if (btn) btn.scrollIntoView({ block: 'nearest' });
    });

    load(true);
    setInterval(function () { if (!document.hidden) load(false).catch(function () {}); }, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) load(false).catch(function () {}); });
  }

  fetch('api/me', { headers: { Accept: 'application/json' } }).then(function (r) {
    if (!/json/.test(r.headers.get('content-type') || '')) return showOffline();
    return r.json().then(function (me) {
      if (r.status === 401) return showLogin(me.logowanie !== false);
      if (!r.ok) return showOffline();
      start(me);
    });
  }).catch(showOffline);
})();
