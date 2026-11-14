# Filadelfia.ai — strona agencji AI

Statyczna strona (HTML + CSS + JS, bez zależności).

Kierunek wizualny: aluminium `#E8EAED`, grafit `#0A0B0D`, jeden akcent `#2B2BFF`.
Kroje: Mona Sans (szeroki, cienki) i Martian Mono. Jedyny element ozdobny to pole
punktów w WebGL. Na stronie głównej przechodzi przy przewijaniu przez pięć form
(tęczówka → siatka → przepływ → sfera → punkt); każda podstrona ma jedną, stałą.

## Pliki

- `build.mjs` — **źródło wszystkich stron**: wspólny nagłówek, menu, stopka i treść
- `*.html` — wynik `node build.mjs`; nie edytuj ręcznie
  - `index.html`, `kampanie.html`, `automatyzacje.html`, `chatboty.html`, `strony.html`,
    `kontakt.html`, `marka.html`, `404.html`
- `styles.css` — style i tokeny kolorów
- `script.js` — pole punktów, odczyty, menu mobilne, wiersz poleceń, formularz
- `favicon.svg` — znak (tęczówka)

## Zmiana treści

Edytuj `build.mjs`, potem:

```bash
node build.mjs
```

## Podgląd lokalny

```bash
python3 -m http.server 4173
```

## Ukryte rzeczy

- `/` (albo dotknięcie nazwy formacji na dole) otwiera wiersz poleceń; `pomoc` pokazuje listę
- `noc` / `dzien` — tryb nocny, zapamiętywany w przeglądarce
- `forma 1–5`, `puls`, `filadelfia`
- kliknięcie w tło rozsuwa punkty
- podpis w konsoli przeglądarki
- strona 404 z formą, która się nie składa

## Formularz kontaktowy

Nie ma backendu. Formularz składa wiadomość i otwiera program pocztowy (`mailto:`)
albo kopiuje treść do schowka. Adres jest w `build.mjs` (`MAIL`).

## Wdrożenie

GitHub Pages z gałęzi `main`. Wszystkie ścieżki są względne, więc strona działa
też w podkatalogu.

## Przed przejściem na docelową domenę

- Usuń `<meta name="robots" content="noindex, nofollow">` w `build.mjs`.
- Zweryfikuj treść usług i procesu — to wersja robocza.
- Podmień adres kontaktowy, jeśli ma być inny niż `kontakt@filadelfia.io`.
