// Generator stron Filadelfia.ai. Bez zależności: `node build.mjs`.
// Wspólny nagłówek, menu, odczyty i stopka są tutaj — pliki .html to wynik, nie edytuj ich ręcznie.
import { writeFileSync } from 'node:fs';

const MAIL = 'business@filadroid.ai';
// Adres, pod którym strona jest opublikowana. Zmień przy przejściu na docelową domenę (obraz do udostępnień i dane strukturalne).
const SITE = 'https://myjakfilip7-jpg.github.io/filadelfia-ai/';

const mark = (size = 22) => `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="9.6" stroke-dasharray="46.3 14" transform="rotate(-38 12 12)"/><circle cx="12" cy="12" r="5.5" stroke-dasharray="21.5 13.06" transform="rotate(148 12 12)"/></g><circle class="mark__p" cx="12" cy="12" r="2.1"/></svg>`;
const word = `<span class="word">filadelfia<span class="word__dot">.</span>ai</span>`;

const SERVICES = [
  { file: 'kampanie.html', form: 0, key: 'kampanie', name: 'Kampanie reklamowe AI', short: 'Kampanie AI', tiny: 'Spoty, zdjęcia produktowe, formaty do reklam', blurb: 'Spoty wideo, zdjęcia produktowe i grafiki do reklam, generowane w AI. Bez planu zdjęciowego.' },
  { file: 'automatyzacje.html', form: 2, key: 'automatyzacje', name: 'Agenci i automatyzacje', short: 'Agenci i automatyzacje', tiny: 'Zapytania, oferty i raporty bez przeklejania', blurb: 'Zapytania, oferty i raporty obsługiwane przez agentów AI połączonych z Twoimi narzędziami.' },
  { file: 'chatboty.html', form: 3, key: 'chatboty', name: 'Chatboty AI', short: 'Chatboty', tiny: 'Odpowiedzi z Twoich materiałów, z przekazaniem człowiekowi', blurb: 'Bot, który odpowiada na podstawie Twoich materiałów, a trudne sprawy przekazuje człowiekowi.' },
  { file: 'strony.html', form: 1, key: 'strony', name: 'Strony, aplikacje, sklepy', short: 'Strony i sklepy', tiny: 'Strony, sklepy i narzędzia, którymi zarządzasz sam', blurb: 'Strony firmowe, sklepy i narzędzia wewnętrzne z panelem, w którym sam zmieniasz treści.' },
];

function shell({ file, title, desc, form, formName, lost, current, body, base, text }) {
  const cur = (k) => (current === k ? ' aria-current="page"' : '');
  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">${base ? `
  <!-- 404 bywa serwowane z dowolnej głębokości: ustaw bazę na katalog główny strony. -->
  <script>document.write('<base href="' + (/\\.github\\.io$/.test(location.hostname) ? '/' + location.pathname.split('/')[1] + '/' : '/') + '">');</script>` : ''}
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <!-- Domena tymczasowa: bez indeksowania. Usuń tę linię (w build.mjs) przy przejściu na docelową domenę. -->
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#E8EAED">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="pl_PL">
  <meta property="og:site_name" content="Filadelfia.ai">
  <meta property="og:image" content="${SITE}og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'ProfessionalService', name: 'Filadelfia.ai', url: SITE, email: MAIL, description: 'Agencja AI: kampanie reklamowe AI, agenci i automatyzacje, chatboty, strony i sklepy.', address: { '@type': 'PostalAddress', addressLocality: 'Krynica-Zdrój', addressCountry: 'PL' }, sameAs: ['https://www.youtube.com/@filadroid'] })}</script>
  <script>try { if (localStorage.getItem('fila-theme') === 'noc') document.documentElement.setAttribute('data-theme', 'noc'); } catch (e) {}</script>
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mona+Sans:wdth,wght@75..125,200..900&family=Martian+Mono:wght@300..500&display=swap">
  <link rel="stylesheet" href="styles.css">
</head>
<body${form != null ? ` data-form="${form}"` : ''}${lost ? ' data-lost' : ''}${text ? ` data-text="${text}"` : ''}>
  ${base ? '' : '<a class="skip" href="#main">Przejdź do treści</a>\n'}
  <canvas id="field" aria-hidden="true"></canvas>

  <header class="bar" id="bar">
    <a class="logo" href="./" aria-label="Filadelfia.ai — strona główna">${mark()}${word}</a>
    <nav class="bar__nav mono" aria-label="Główna">
      <div class="nav__has">
        <a href="./#uslugi"${cur('uslugi')}>Usługi</a>
        <div class="nav__panel">
${SERVICES.map((sv) => `          <a href="${sv.file}"><strong>${sv.name}</strong><span>${sv.tiny}</span></a>`).join('\n')}
        </div>
      </div>
      <a href="./#proces">Proces</a>
      <a href="./#zasady">Zasady</a>
      <a href="./#faq">Pytania</a>
    </nav>
    <p class="bar__clock mono" aria-hidden="true">Krynica-Zdrój <span id="clock">--:--:--</span></p>
    <a class="bar__cta" href="kontakt.html"${cur('kontakt')}>Umów rozmowę</a>
    <button class="bar__menu mono" type="button" id="menuBtn" aria-expanded="false" aria-controls="menu">Menu</button>
  </header>

  <nav class="menu" id="menu" aria-label="Menu" inert>
    <p class="mono">Usługi</p>
${SERVICES.map((s) => `    <a class="menu__big" href="${s.file}">${s.short}</a>`).join('\n')}
    <p class="mono">Firma</p>
    <a class="menu__big" href="./#proces">Proces</a>
    <a class="menu__big" href="./#zasady">Zasady</a>
    <a class="menu__big" href="./#faq">Pytania</a>
    <a class="menu__big" href="kontakt.html">Kontakt</a>
    <a class="menu__mail mono" href="mailto:${MAIL}">${MAIL}</a>
  </nav>

  <main id="main">
${body}
  </main>

  <footer class="end">
    <div class="end__cols">
      <div class="end__about">
        <p>Agencja AI z Krynicy-Zdroju. Kampanie, agenci, chatboty i strony dla firm.</p>
        <button class="end__theme mono" type="button" id="themeBtn" aria-pressed="false"><span class="end__sw" aria-hidden="true"></span>Tryb nocny</button>
      </div>
      <nav aria-label="Usługi">
        <p class="mono">Usługi</p>
${SERVICES.map((sv) => `        <a href="${sv.file}">${sv.short}</a>`).join('\n')}
      </nav>
      <nav aria-label="Firma">
        <p class="mono">Firma</p>
        <a href="./#proces">Proces</a>
        <a href="./#zasady">Zasady</a>
        <a href="./#faq">Pytania</a>
        <a href="marka.html">Marka</a>
      </nav>
      <nav aria-label="Kontakt">
        <p class="mono">Kontakt</p>
        <a href="kontakt.html">Formularz</a>
        <a href="mailto:${MAIL}">${MAIL}</a>
        <a href="https://www.youtube.com/@filadroid" target="_blank" rel="noopener">YouTube</a>
        <a href="https://filadelfia.io" target="_blank" rel="noopener">Filadelfia.io</a>
      </nav>
    </div>
    <p class="mega" aria-hidden="true">filadelfia<span class="word__dot">.</span>ai</p>
    <p class="end__row mono"><span>© <span id="year">2026</span> Filadelfia.ai</span><span>Krynica-Zdrój, Polska</span><span>AI przygotowuje, człowiek zatwierdza</span></p>
  </footer>

  <aside class="hud mono">
    <button class="hud__form" type="button" id="hudBtn" aria-label="Otwórz wiersz poleceń"><span class="hud__dot"></span><span id="hudIndex">${lost ? '0/5' : (form != null ? form + 1 : 1) + '/5'}</span> <span id="hudName">${formName}</span></button>
    <p class="hud__data" aria-hidden="true">49.4217° N 20.9594° E<span id="hudStats"></span> · <span class="hud__key">/</span> polecenia</p>
  </aside>

  <div class="cmd" id="cmd" hidden>
    <p class="cmd__out" id="cmdOut" role="status"></p>
    <form id="cmdForm"><span aria-hidden="true">›</span><input id="cmdIn" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Polecenie" placeholder="pomoc"><button type="button" id="cmdClose" aria-label="Zamknij wiersz poleceń">esc</button></form>
  </div>

  <script src="script.js" defer></script>
</body>
</html>
`;
}

const foot = '';

// Symulacja jednego procesu. Zatrzymuje się na zatwierdzeniu — klika je odwiedzający.
const flow = (h, p) => `    <section class="dark" data-flow>
      <div class="dark__in">
        <div>
          <p class="tag mono" data-r>Od środka · symulacja</p>
          <h2 class="ask" data-r>${h}</h2>
          <p class="lead" data-r>${p}</p>
        </div>
        <div class="flow" data-r>
          <p class="flow__bar" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></p>
          <p class="flow__now mono" aria-live="polite">1/5 Zapytanie</p>
          <div class="flow__log" aria-hidden="true"></div>
          <p class="flow__act">
            <button class="pill pill--inv flow__ok" type="button" hidden>Zatwierdź i wyślij</button>
            <button class="more flow__again" type="button" hidden>Puść jeszcze raz</button>
          </p>
        </div>
      </div>
    </section>`;


const rows = (items) => items.map(([h, p]) => `          <li data-r>
            <h2>${h}</h2>
            <p>${p}</p>
          </li>`).join('\n');

const steps = (items) => items.map(([h, p], i) => `          <li data-r>
            <span class="steps__n mono">0${i + 1}</span>
            <h2>${h}</h2>
            <p>${p}</p>
          </li>`).join('\n');

// Przykładowe kadry reklamowe wygenerowane w Higgsfield. To przykłady, nie realizacje dla klientów.
const SHOTS = [
  ['serum', 'Kosmetyki', 'Szklana buteleczka serum z aluminiową nakrętką na mokrym kamieniu, niebieskie światło z boku'],
  ['but', 'Obuwie', 'Jasny but do biegania uchwycony w powietrzu nad ciemną posadzką, za nim niebieska smuga światła'],
  ['kawa', 'Kawa', 'Grafitowa filiżanka czarnej kawy z unoszącą się parą na szczotkowanym aluminium'],
];
const shots = (h, link) => `    <section class="wide wide--shots">
      <div class="head">
        <p class="tag mono" data-r>Kampanie AI · przykładowe kadry</p>
        <h2 class="ask" data-r>${h}</h2>
      </div>
      <ul class="shots">
${SHOTS.map(([f, cap, alt]) => `        <li data-r>
          <figure>
            <div class="shot"><img src="media/${f}.jpg" alt="${alt}" width="896" height="1120" loading="lazy" decoding="async"></div>
            <figcaption class="mono"><span>${cap}</span><span>AI · Higgsfield</span></figcaption>
          </figure>
        </li>`).join('\n')}
      </ul>
      <p class="shots__note" data-r>To przykłady, nie realizacje dla klientów. Żadnego z tych produktów nie sfotografowano: wszystkie trzy kadry wygenerowaliśmy w Higgsfield.${link ? ' <a href="kampanie.html">Zobacz, jak powstaje kampania <span aria-hidden="true">→</span></a>' : ''}</p>
    </section>`;

// Miniatury w kafelkach usług: HTML i CSS; kafelek kampanii pokazuje prawdziwy kadr.
const VIS = {
  kampanie: `<div class="v-ad"><div class="v-ad__f"><img src="media/but.jpg" alt="" loading="lazy" decoding="async"></div><span class="mono">9:16 · 1:1 · 16:9</span></div>`,
  automatyzacje: `<div class="v-flow"><b></b><span><i></i>zapytanie</span><span><i></i>agent</span><span><i></i>CRM</span><span><i></i>zgoda</span></div>`,
  chatboty: `<div class="v-chat"><i class="v-chat__me"></i><i class="v-chat__bot"></i><i class="v-chat__me v-chat__me--s"></i><span class="mono">→ człowiek</span></div>`,
  strony: `<div class="v-web"><p><i></i><i></i><i></i></p><div><b></b><u></u><u></u><em></em></div></div>`,
};

const FAQ = [
  ['Ile to kosztuje?', 'Zależy od zakresu. Po pierwszej rozmowie dostajesz wycenę z konkretną kwotą, zanim cokolwiek zaczniemy.'],
  ['Od czego zaczynamy?', 'Od jednego procesu albo jednej kampanii. Najpierw powstaje mała, działająca wersja, żebyś zobaczył efekt, zanim zdecydujesz o reszcie.'],
  ['Czy muszę znać się na AI?', 'Nie. Opowiadasz, jak wygląda praca w firmie, a my wskazujemy, co da się oddać AI. Na koniec zespół dostaje prostą instrukcję.'],
  ['Co, jeśli AI się pomyli?', 'Tam, gdzie błąd kosztuje, ostatni krok zatwierdza człowiek: wysyłka do klienta, płatności, zmiany w danych. Resztę monitorujemy i poprawiamy.'],
  ['Co dzieje się z moimi danymi?', 'Zostają na Twoich kontach i w narzędziach, które sam wybierasz. Przed startem ustalamy, do czego AI ma dostęp, a do czego nie.'],
  ['Z jakich narzędzi korzystacie?', 'Dobieramy je do zadania. Między innymi modele Claude i GPT do tekstu i agentów oraz Higgsfield do wideo.'],
];

/* ---------- strona główna ---------- */
const home = `    <section class="scene scene--hero" id="top" data-scene="Tęczówka">
      <div class="col">
        <p class="tag mono" data-r>Agencja AI</p>
        <h1 data-r>Praca, którą wykona&nbsp;AI.</h1>
        <p class="lead" data-r>Kampanie reklamowe, agenci, chatboty i strony. Projektujemy i wdrażamy AI w firmach: powtarzalna praca dzieje się sama, decyzje zostają u&nbsp;Ciebie.</p>
        <p class="actions" data-r>
          <a class="pill" href="kontakt.html">Umów rozmowę</a>
          <a class="more" href="#uslugi">Co wdrażamy <span aria-hidden="true">↓</span></a>
        </p>
      </div>
    </section>

    <section class="wide">
      <p class="fill">Każda firma ma pracę, której nikt nie chce robić. Przepisywanie, odpisywanie, pilnowanie, raportowanie. Tę pracę oddajemy AI, a ludziom zostawiamy to, do czego są potrzebni.</p>
    </section>

    <section class="wide wide--tiles" id="uslugi" data-scene="Żyroskop">
      <div class="head">
        <p class="tag mono" data-r>Co wdrażamy</p>
        <h2 class="ask" data-r>Cztery obszary. Zaczynamy od jednego.</h2>
      </div>
      <ul class="tiles">
${SERVICES.map((sv) => `        <li data-r>
          <a class="tile" href="${sv.file}">
            <div class="tile__vis" aria-hidden="true">${VIS[sv.key]}</div>
            <div class="tile__txt">
              <h3>${sv.name}</h3>
              <p>${sv.blurb}</p>
            </div>
            <span class="tile__go" aria-hidden="true">→</span>
          </a>
        </li>`).join('\n')}
      </ul>
    </section>

${shots('Tych zdjęć nikt nie zrobił.', true)}

${flow('Jedno zapytanie. Zero przeklejania.', 'Tak wygląda proces po wdrożeniu: agent czyta wiadomość, uzupełnia CRM, pisze odpowiedź i czeka na Twoje „tak”. Ostatni krok należy do Ciebie.')}

    <section class="scene" id="proces" data-scene="Przepływ">
      <div class="col">
        <p class="tag mono" data-r>Jak pracujemy</p>
        <ol class="steps">
${steps([
  ['Rozmowa', 'Pytamy, jak wygląda Twój dzień pracy, i wskazujemy miejsca, w których AI realnie oszczędzi czas.'],
  ['Prototyp', 'Budujemy małą, działającą wersję na Twoich danych. Widzisz efekt, zanim zdecydujesz o całości.'],
  ['Wdrożenie', 'Podłączamy rozwiązanie do Twoich narzędzi, testujemy je i uczymy zespół, jak z niego korzystać.'],
  ['Opieka', 'Pilnujemy, żeby wszystko działało, i rozbudowujemy system, gdy pojawiają się nowe potrzeby.'],
])}
        </ol>
      </div>
    </section>

    <section class="scene" id="zasady" data-scene="Sfera">
      <div class="col">
        <p class="tag mono" data-r>Zasady</p>
        <ul class="rules">
          <li data-r>
            <h2>Człowiek ma ostatnie słowo.</h2>
            <p>Tam, gdzie to ważne, AI przygotowuje, a człowiek zatwierdza.</p>
          </li>
          <li data-r>
            <h2>Wszystko zostaje u&nbsp;Ciebie.</h2>
            <p>Konta, dane i automatyzacje są Twoje. Dostajesz dokumentację i wiesz, jak to działa.</p>
          </li>
          <li data-r>
            <h2>Wdrażamy to, czego sami używamy.</h2>
            <p>Pracę z AI pokazujemy na kanale <a href="https://www.youtube.com/@filadroid" target="_blank" rel="noopener">Filadroid na YouTube</a>.</p>
          </li>
        </ul>
      </div>
    </section>

    <section class="wide wide--faq" id="faq">
      <div class="head">
        <p class="tag mono" data-r>Pytania</p>
        <h2 class="ask" data-r>Zanim napiszesz.</h2>
      </div>
      <div class="faq" data-r>
${FAQ.map(([q, a]) => `        <details name="faq">
          <summary>${q}</summary>
          <p>${a}</p>
        </details>`).join('\n')}
      </div>
    </section>

    <section class="scene scene--contact" id="kontakt" data-scene="Punkt">
      <div class="col">
        <p class="tag mono" data-r>Kontakt</p>
        <h2 class="ask" data-r>Opowiedz, co zabiera Ci najwięcej czasu.</h2>
        <p class="lead" data-r>Napisz kilka zdań o swojej firmie. Odpiszemy z propozycją, od czego zacząć.</p>
        <p class="actions" data-r>
          <a class="pill" href="kontakt.html">Napisz do nas</a>
          <a class="more" href="mailto:${MAIL}">${MAIL}</a>
        </p>
        ${foot}
      </div>
    </section>`;

/* ---------- podstrony usług ---------- */
function service(i, { h1, lead, whatTag, what, how, noteTag, note, demo = '' }) {
  const s = SERVICES[i], next = SERVICES[(i + 1) % SERVICES.length];
  return `    <section class="scene scene--hero scene--page">
      <div class="col">
        <p class="tag mono" data-r><a href="./#uslugi">Usługi</a> <span aria-hidden="true">/</span> ${i + 1} z ${SERVICES.length}</p>
        <h1 class="h1--page" data-r>${h1}</h1>
        <p class="lead" data-r>${lead}</p>
      </div>
    </section>
${demo}
    <section class="block">
      <div class="col">
        <p class="tag mono" data-r>${whatTag}</p>
        <ul class="index">
${rows(what)}
        </ul>
      </div>
    </section>

    <section class="block">
      <div class="col">
        <p class="tag mono" data-r>Jak to przebiega</p>
        <ol class="steps">
${steps(how)}
        </ol>
      </div>
    </section>

    <section class="block">
      <div class="col">
        <p class="tag mono" data-r>${noteTag}</p>
        <p class="note" data-r>${note}</p>
      </div>
    </section>

    <section class="block block--end">
      <div class="col">
        <h2 class="ask" data-r>Sprawdźmy, czy to ma sens u&nbsp;Ciebie.</h2>
        <p class="actions" data-r>
          <a class="pill" href="kontakt.html?temat=${s.key}">Napisz w tej sprawie</a>
          <a class="more" href="${next.file}">Dalej: ${next.short} <span aria-hidden="true">→</span></a>
        </p>
        ${foot}
      </div>
    </section>`;
}

const kampanie = service(0, {
  h1: 'Reklama bez planu zdjęciowego.',
  lead: 'Spoty wideo, zdjęcia produktowe i grafiki do kampanii powstają w AI: bez ekipy, studia i tygodni czekania. Ty zatwierdzasz kierunek i gotowe materiały.',
  whatTag: 'Co powstaje',
  what: [
    ['Spoty wideo', 'Krótkie reklamy na Reels, TikTok i YouTube, generowane między innymi w Higgsfield i dopracowane w montażu.'],
    ['Zdjęcia produktowe', 'Twój produkt w scenach, których nie trzeba budować ani fotografować.'],
    ['Formaty do kampanii', 'Każdy materiał w wersjach pod Meta Ads, TikTok Ads i YouTube: pion, kwadrat, poziom.'],
    ['Warianty do testów', 'Kilka wersji tego samego pomysłu, żeby sprawdzić, która reklama działa najlepiej.'],
  ],
  how: [
    ['Brief', 'Produkt, odbiorca, cel kampanii. Jedna rozmowa.'],
    ['Kierunek', 'Pokazujemy kilka kadrów próbnych. Wybierasz styl, zanim powstanie całość.'],
    ['Produkcja', 'Generujemy ujęcia, montujemy, dodajemy dźwięk i napisy.'],
    ['Formaty', 'Dostajesz pliki gotowe do wgrania w panel reklamowy.'],
  ],
  demo: '\n' + shots('Tych zdjęć nikt nie zrobił.', false) + `

    <div class="gap"></div>

    <section class="block">
      <div class="col">
        <p class="tag mono" data-r>Jeden materiał, trzy formaty</p>
        <div class="formats" data-formats data-r>
          <div class="formats__stage"><div class="formats__frame" data-f="916"><img src="media/but.jpg" alt="Ten sam kadr z butem przycięty do wybranego formatu" loading="lazy" decoding="async"></div></div>
          <p class="chips">
            <button type="button" data-f="916">9:16 · Reels, TikTok</button>
            <button type="button" data-f="11">1:1 · Feed</button>
            <button type="button" data-f="169">16:9 · YouTube</button>
          </p>
        </div>
      </div>
    </section>
`,
  noteTag: 'Uczciwie',
  note: 'AI nie zastąpi wszystkiego. Jeśli w reklamie ma wystąpić konkretna osoba albo dokładny detal produktu, powiemy wprost, co da się wygenerować, a co lepiej sfilmować.',
});

const automatyzacje = service(1, {
  h1: 'Procesy, które toczą się same.',
  lead: 'Łączymy pocztę, arkusze, CRM i formularze, a tam, gdzie trzeba myśleć, stawiamy agenta AI. Zapytania, oferty i raporty przestają czekać na wolną chwilę.',
  whatTag: 'Co wdrażamy',
  what: [
    ['Obsługa zapytań', 'Wiadomość wpada, agent ją czyta, uzupełnia dane w CRM i przygotowuje odpowiedź do zatwierdzenia.'],
    ['Oferty i dokumenty', 'Wycena, umowa czy podsumowanie spotkania powstają z Twoich szablonów i danych.'],
    ['Raporty', 'Liczby z kilku narzędzi w jednym podsumowaniu, o stałej porze, bez przeklejania.'],
    ['Agenci do zadań', 'Asystent z dostępem do wybranych narzędzi, który zbiera dane, pilnuje terminów i porządkuje skrzynkę.'],
  ],
  how: [
    ['Mapa', 'Rozpisujemy jeden proces krok po kroku i sprawdzamy, ile czasu zabiera.'],
    ['Prototyp', 'Budujemy działającą wersję na Twoich danych. Widzisz efekt przed decyzją o całości.'],
    ['Wdrożenie', 'Podłączamy narzędzia, testujemy i zostawiamy instrukcję dla zespołu.'],
    ['Opieka', 'Monitorujemy działanie i poprawiamy, gdy coś się zmienia.'],
  ],
  demo: '\n' + flow('Zobacz jeden proces od środka.', 'Agent czyta wiadomość, uzupełnia CRM, pisze odpowiedź i czeka na Twoje „tak”. Ostatni krok należy do Ciebie.') + '\n\n    <div class="gap"></div>\n',
  noteTag: 'Granica',
  note: 'Agent nie działa bez nadzoru tam, gdzie błąd kosztuje. Wysyłka do klienta, płatności i zmiany w danych przechodzą przez zatwierdzenie człowieka.',
});

const chatboty = service(2, {
  h1: 'Odpowiada od razu. Wie, kiedy oddać głos.',
  lead: 'Chatbot na stronie lub w komunikatorze odpowiada na podstawie Twoich materiałów: oferty, cennika, regulaminu. Trudne sprawy przekazuje człowiekowi.',
  whatTag: 'Co potrafi',
  what: [
    ['Odpowiedzi z Twoich materiałów', 'Bot korzysta z tego, co mu dasz. Gdy nie zna odpowiedzi, mówi to wprost, zamiast zgadywać.'],
    ['Zbieranie zapytań', 'Dopytuje o szczegóły i przekazuje gotowe zgłoszenie na pocztę albo do CRM.'],
    ['Przekazanie człowiekowi', 'Reklamacja, nietypowe pytanie, zdenerwowany klient: rozmowa trafia do Ciebie z całą historią.'],
    ['Wgląd w rozmowy', 'Widzisz, o co pytają klienci, i wiesz, czego brakuje na stronie.'],
  ],
  how: [
    ['Materiały', 'Zbieramy to, co bot ma wiedzieć, i ustalamy, czego ma nie ruszać.'],
    ['Wersja próbna', 'Testujesz bota na prawdziwych pytaniach, zanim zobaczą go klienci.'],
    ['Uruchomienie', 'Osadzamy bota na stronie lub w komunikatorze i podłączamy powiadomienia.'],
    ['Poprawki', 'Po pierwszych tygodniach przeglądamy rozmowy i uzupełniamy wiedzę bota.'],
  ],
  demo: `
    <section class="block">
      <div class="col">
        <p class="tag mono" data-r>Przykładowa rozmowa</p>
        <div class="chat" data-seq data-r>
          <p class="chat__me" data-step>Czy w sobotę jest wolny termin?</p>
          <p class="chat__bot" data-step>Jestem botem gabinetu. W sobotę są wolne godziny 10:00 i 12:30. Zarezerwować którąś?</p>
          <p class="chat__me" data-step>Najpierw chcę złożyć reklamację.</p>
          <p class="chat__bot" data-step>To sprawa dla człowieka. Przekazuję rozmowę do recepcji razem z historią. Odpiszą w tym oknie.</p>
          <p class="chat__sys mono" data-step>Rozmowa przekazana · recepcja</p>
          <button class="more" type="button" data-replay>Puść jeszcze raz</button>
        </div>
      </div>
    </section>
`,
  noteTag: 'Zasada',
  note: 'Bot przedstawia się jako bot. Klient zawsze wie, że rozmawia z AI, i zawsze może poprosić o człowieka.',
});

const strony = service(3, {
  h1: 'Strony, którymi zarządzasz sam.',
  lead: 'Projektujemy i budujemy strony firmowe, sklepy i narzędzia wewnętrzne. Szybkie, czytelne na telefonie, z panelem, w którym sam zmieniasz treści.',
  whatTag: 'Co budujemy',
  what: [
    ['Strony firmowe', 'Od jednej strony po rozbudowany serwis. Ta, którą czytasz, jest przykładem.'],
    ['Sklepy internetowe', 'Katalog, koszyk, płatności i dostawy na platformie, którą obsłużysz bez programisty.'],
    ['Aplikacje i narzędzia', 'Panele, kalkulatory, systemy rezerwacji: małe programy szyte pod jeden proces w firmie.'],
    ['AI w środku', 'Wyszukiwarka, asystent czy automatyczne opisy produktów tam, gdzie realnie pomagają.'],
  ],
  how: [
    ['Zakres', 'Ustalamy, co strona ma załatwiać, i spisujemy to na jednej kartce.'],
    ['Projekt', 'Widzisz wygląd i treść, zanim powstanie kod.'],
    ['Budowa', 'Kodujemy, podłączamy płatności i formularze, testujemy na telefonach.'],
    ['Przekazanie', 'Domena, hosting i kod są na Twoich kontach. Pokazujemy, jak zmieniać treści.'],
  ],
  demo: `
    <section class="block">
      <div class="col">
        <p class="tag mono" data-r>Spróbuj</p>
        <h2 class="edit" contenteditable="plaintext-only" spellcheck="false" data-r>Kliknij i zmień ten nagłówek.</h2>
        <p class="lead" data-r>Tak działa panel: klikasz w tekst i piszesz. Tutaj zmiana zostaje tylko w Twojej przeglądarce.</p>
      </div>
    </section>
`,
  noteTag: 'Zasada',
  note: 'Sprzedajemy kontrolę, nie zależność. Strona, domena i dane należą do Ciebie od pierwszego dnia.',
});

/* ---------- kontakt ---------- */
const kontakt = `    <section class="scene scene--form">
      <div class="col">
        <p class="tag mono" data-r>Kontakt</p>
        <h1 class="h1--page" data-r>Opowiedz, co zabiera Ci najwięcej czasu.</h1>
        <p class="lead" data-r>Wybierz temat i napisz kilka zdań. Odpiszemy z propozycją, od czego zacząć.</p>

        <form class="brief" id="brief" data-mail="${MAIL}" data-r>
          <fieldset>
            <legend class="mono">Czego dotyczy</legend>
            <div class="chips">
${SERVICES.map((s) => `              <label><input type="radio" name="temat" value="${s.key}" data-label="${s.name}"><span>${s.short}</span></label>`).join('\n')}
              <label><input type="radio" name="temat" value="inne" data-label="Jeszcze nie wiem" checked><span>Jeszcze nie wiem</span></label>
            </div>
          </fieldset>
          <label class="field"><span class="mono">Imię</span><input type="text" name="imie" autocomplete="given-name" required></label>
          <label class="field"><span class="mono">Firma lub strona — opcjonalnie</span><input type="text" name="firma" autocomplete="organization"></label>
          <label class="field"><span class="mono">Co chcesz usprawnić</span><textarea name="opis" rows="4" required></textarea></label>
          <p class="actions">
            <button class="pill" type="submit">Otwórz w poczcie</button>
            <button class="more" type="button" id="briefCopy">Skopiuj treść</button>
          </p>
          <p class="brief__status mono" id="briefStatus" role="status"></p>
          <p class="brief__hint">Formularz niczego nie wysyła sam. Otwiera Twoją pocztę z gotową wiadomością do <a href="mailto:${MAIL}">${MAIL}</a>.</p>
        </form>
        ${foot}
      </div>
    </section>`;

/* ---------- marka ---------- */
const sw = (name, hex, use, dark) => `          <li data-r><span class="swatch${dark ? ' swatch--dark' : ''}" style="background:${hex}"></span><h2>${name}</h2><p class="mono">${hex}</p><p>${use}</p></li>`;
const marka = `    <section class="scene scene--hero scene--page">
      <div class="col">
        <p class="tag mono" data-r>Marka</p>
        <h1 class="h1--page" data-r>Jeden punkt. Reszta to porządek.</h1>
        <p class="lead" data-r>Znak, kolory i pismo Filadelfia.ai w jednym miejscu.</p>
      </div>
    </section>

    <section class="block">
      <div class="col">
        <p class="tag mono" data-r>Znak</p>
        <div class="brand" data-r>
          <div class="brand__tile">${mark(96)}</div>
          <div class="brand__tile brand__tile--dark">${mark(96)}</div>
          <div class="brand__tile brand__tile--wide">${mark(30)}${word}</div>
          <div class="brand__tile brand__tile--wide brand__tile--dark">${mark(30)}${word}</div>
        </div>
        <p class="lead" data-r>Tęczówka: dwa przerwane pierścienie i punkt. Ten sam kształt układa się z punktów na stronie głównej. W logotypie kropka przed „ai” jest tym samym punktem.</p>
        <p class="brand__sizes" data-r>${mark(48)}${mark(32)}${mark(20)}${mark(14)}<span class="mono">Czytelny od 14 px</span></p>
      </div>
    </section>

    <section class="block">
      <div class="col">
        <p class="tag mono" data-r>Kolory</p>
        <ul class="swatches">
${sw('Aluminium', '#E8EAED', 'Tło.')}
${sw('Grafit', '#0A0B0D', 'Tekst i znak.', true)}
${sw('Łupek', '#565B63', 'Tekst pomocniczy.', true)}
${sw('Włos', '#C9CDD3', 'Linie.')}
${sw('Sygnał', '#2B2BFF', 'Jeden punkt na ekran. Nigdy tło, nigdy cały nagłówek.', true)}
        </ul>
      </div>
    </section>

    <section class="block">
      <div class="col">
        <p class="tag mono" data-r>Pismo</p>
        <p class="type-a" data-r>Mona Sans</p>
        <p class="lead" data-r>Szeroka i cienka w nagłówkach, zwykła w tekście. Jedna rodzina na wszystko, co się czyta.</p>
        <p class="type-b mono" data-r>Martian Mono — 49.4217° N · 120 kl/s</p>
        <p class="lead" data-r>Tylko do odczytów, etykiet i numerów kroków.</p>
      </div>
    </section>

    <section class="block block--end">
      <div class="col">
        <p class="tag mono" data-r>Nazwa</p>
        <p class="note" data-r>Filadelfia, z greckiego <span lang="el">φιλαδέλφεια</span>: braterska miłość. U nas znaczy to jedno: AI pracuje dla ludzi, nie zamiast nich.</p>
        ${foot}
      </div>
    </section>`;

/* ---------- 404 ---------- */
const lostPage = `    <section class="scene scene--hero">
      <div class="col">
        <p class="tag mono" data-r>Błąd 404</p>
        <h1 class="h1--page" data-r>Ten punkt się zgubił.</h1>
        <p class="lead" data-r>Pod tym adresem nic nie ma. Reszta jest na swoim miejscu.</p>
        <p class="actions" data-r>
          <a class="pill" href="./">Wróć na początek</a>
          <a class="more" href="kontakt.html">Kontakt</a>
        </p>
      </div>
    </section>`;

const pages = [
  { file: 'index.html', title: 'Filadelfia.ai — agencja AI', desc: 'Kampanie reklamowe AI, agenci i automatyzacje, chatboty oraz strony dla firm. Powtarzalna praca dzieje się sama, decyzje zostają u Ciebie.', formName: 'Tęczówka', body: home },
  { file: 'kampanie.html', title: 'Kampanie reklamowe AI — Filadelfia.ai', desc: 'Spoty wideo, zdjęcia produktowe i grafiki do kampanii generowane w AI. Bez planu zdjęciowego.', form: 0, formName: 'Tęczówka', current: 'uslugi', body: kampanie },
  { file: 'automatyzacje.html', title: 'Agenci i automatyzacje — Filadelfia.ai', desc: 'Agenci AI i automatyzacje procesów: zapytania, oferty i raporty obsługiwane bez przeklejania.', form: 2, formName: 'Przepływ', current: 'uslugi', body: automatyzacje },
  { file: 'chatboty.html', title: 'Chatboty AI — Filadelfia.ai', desc: 'Chatbot, który odpowiada na podstawie Twoich materiałów i przekazuje trudne sprawy człowiekowi.', form: 3, formName: 'Sfera', current: 'uslugi', body: chatboty },
  { file: 'strony.html', title: 'Strony, aplikacje, sklepy — Filadelfia.ai', desc: 'Strony firmowe, sklepy internetowe i narzędzia wewnętrzne, którymi zarządzasz sam.', form: 1, formName: 'Żyroskop', current: 'uslugi', body: strony },
  { file: 'kontakt.html', title: 'Kontakt — Filadelfia.ai', desc: 'Opowiedz, co zabiera Ci najwięcej czasu. Odpiszemy z propozycją, od czego zacząć.', form: 4, formName: 'Punkt', current: 'kontakt', body: kontakt },
  { file: 'marka.html', title: 'Marka — Filadelfia.ai', desc: 'Znak, kolory i pismo Filadelfia.ai.', form: 0, formName: 'Tęczówka', body: marka },
  { file: '404.html', title: 'Nie ma takiej strony — Filadelfia.ai', desc: 'Pod tym adresem nic nie ma.', form: 4, formName: 'Zgubiony', lost: true, base: true, text: '404', body: lostPage },
];

for (const p of pages) writeFileSync(new URL(p.file, import.meta.url), shell(p));
console.log('Zbudowano: ' + pages.map((p) => p.file).join(', '));
