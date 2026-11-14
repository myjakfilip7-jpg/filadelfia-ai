/* Panel właściciela: logowanie przez GitHub i lista zgłoszeń. Wymaga backendu (server/server.mjs). */
(function () {
  'use strict';
  var box = document.getElementById('panel');
  if (!box) return;

  var ERRORS = {
    odmowa: 'Logowanie przerwane po stronie GitHuba.',
    stan: 'Sesja logowania wygasła albo nie pasuje. Spróbuj jeszcze raz.',
    'brak-dostepu': 'To konto GitHub nie ma dostępu do panelu.',
    github: 'GitHub nie potwierdził logowania. Spróbuj jeszcze raz.',
    konfiguracja: 'Logowanie nie jest jeszcze skonfigurowane na serwerze.'
  };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function clear() { while (box.firstChild) box.removeChild(box.firstChild); }
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ Accept: 'application/json', 'x-fila': '1' }, opts.body ? { 'Content-Type': 'application/json' } : {}, opts.headers || {});
    return fetch(path, opts);
  }
  var when = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Warsaw' });

  function showOffline() {
    clear();
    box.appendChild(el('p', 'lead', 'Panel działa tylko tam, gdzie uruchomiony jest backend. Ta kopia strony to same pliki statyczne.'));
  }

  function showLogin(canLogin) {
    clear();
    var err = ERRORS[new URLSearchParams(location.search).get('blad')];
    if (err) box.appendChild(el('p', 'panel__err mono', err));
    if (!canLogin) { box.appendChild(el('p', 'lead', 'Logowanie nie jest jeszcze skonfigurowane. Uzupełnij dane aplikacji GitHub w pliku server/.env i uruchom serwer ponownie.')); return; }
    box.appendChild(el('p', 'lead', 'Zaloguj się kontem GitHub, które ma dostęp do panelu.'));
    var p = el('p', 'actions'), a = el('a', 'pill', 'Zaloguj przez GitHub');
    a.href = 'auth/github';
    p.appendChild(a); box.appendChild(p);
  }

  function showList(me, data) {
    clear();
    var bar = el('p', 'panel__bar mono'), who = el('span');
    who.appendChild(document.createTextNode('Zalogowano jako '));
    who.appendChild(el('strong', null, '@' + me.login));
    var out = el('button', 'more', 'Wyloguj'); out.type = 'button';
    out.addEventListener('click', function () { api('auth/logout', { method: 'POST' }).then(function () { location.href = 'panel.html'; }); });
    bar.appendChild(who); bar.appendChild(out); box.appendChild(bar);

    if (!data.zgloszenia.length) { var none = el('p', 'lead', 'Nie ma jeszcze zgłoszeń. Pojawią się tu po wysłaniu formularza kontaktowego.'); none.style.marginTop = '28px'; box.appendChild(none); return; }

    data.zgloszenia.forEach(function (z) {
      var art = el('article', 'zg'), meta = el('p', 'zg__meta mono');
      var st = el('span', z.status === 'nowe' ? 'is-new' : null, z.status);
      meta.appendChild(st);
      meta.appendChild(el('span', null, when.format(new Date(z.at))));
      meta.appendChild(el('span', null, data.tematy[z.temat] || z.temat));
      art.appendChild(meta);
      art.appendChild(el('h2', null, z.imie));
      art.appendChild(el('p', 'zg__who', [z.firma, z.kontakt].filter(Boolean).join(' · ')));
      art.appendChild(el('p', 'zg__text', z.opis)); // textContent: treść od obcych osób nigdy nie trafia do HTML

      var act = el('p', 'zg__act'), sel = el('select');
      sel.setAttribute('aria-label', 'Status zgłoszenia od: ' + z.imie);
      data.statusy.forEach(function (s) { var o = el('option', null, s); o.value = s; o.selected = s === z.status; sel.appendChild(o); });
      sel.addEventListener('change', function () {
        api('api/zgloszenia/' + z.id, { method: 'PATCH', body: JSON.stringify({ status: sel.value }) }).then(function (r) {
          if (!r.ok) { sel.value = z.status; return; }
          z.status = sel.value; st.textContent = z.status; st.className = z.status === 'nowe' ? 'is-new' : '';
        });
      });
      var del = el('button', 'more', 'Usuń'); del.type = 'button';
      del.addEventListener('click', function () {
        if (!window.confirm('Usunąć zgłoszenie od: ' + z.imie + '? Tego nie da się cofnąć.')) return;
        api('api/zgloszenia/' + z.id, { method: 'DELETE' }).then(function (r) { if (r.ok) art.remove(); });
      });
      act.appendChild(sel); act.appendChild(del); art.appendChild(act);
      box.appendChild(art);
    });
  }

  api('api/me').then(function (r) {
    if (!/json/.test(r.headers.get('content-type') || '')) return showOffline();
    return r.json().then(function (me) {
      if (r.status === 401) return showLogin(me.logowanie !== false);
      if (!r.ok) return showOffline();
      return api('api/zgloszenia').then(function (r2) { return r2.json(); }).then(function (data) { showList(me, data); });
    });
  }).catch(showOffline);
})();
