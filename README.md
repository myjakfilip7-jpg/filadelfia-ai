# Filadelfia.ai — strona agencji AI

Statyczna strona (HTML + CSS + JS, bez zależności).

Kierunek wizualny: aluminium `#E8EAED`, grafit `#0A0B0D`, jeden akcent `#2B2BFF`.
Kroje: Mona Sans (szeroki, cienki) i Martian Mono. Główny element to obiekt 3D:
aluminiowy żyroskop z pięciu pierścieni i niebieskiego rdzenia, liczony na żywo
w shaderze (raymarching, bez modeli i bibliotek). Ma pięć układów:
tęczówka → żyroskop → przepływ → sfera → punkt. Strona główna zmienia je przy
przewijaniu; każda podstrona ma jeden, stały. Punkty zostały tylko do napisów
(strona 404, polecenie `napisz`).

## Pliki

- `build.mjs` — **źródło wszystkich stron**: wspólny nagłówek, menu, stopka i treść
- `*.html` — wynik `node build.mjs`; nie edytuj ręcznie
  - `index.html`, `kampanie.html`, `automatyzacje.html`, `chatboty.html`, `strony.html`,
    `kontakt.html`, `marka.html`, `404.html`
- `styles.css` — style i tokeny kolorów
- `script.js` — obiekt 3D, punkty do napisów, odczyty, menu, wiersz poleceń, dema, formularz
- `favicon.svg` — znak (tęczówka)
- `og.png` — obraz do udostępnień (1200 × 630)

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
- `forma 1–5`, `puls`, `filadelfia`, `napisz <słowo>` (punkty układają się w napis)
- kursor odpycha punkty; najechanie na usługę pokazuje jej formę
- kliknięcie w tło rozsuwa punkty
- podpis w konsoli przeglądarki
- strona 404: punkty układają się w „404”

## Formularz kontaktowy

Nie ma backendu. Formularz składa wiadomość i otwiera program pocztowy (`mailto:`)
albo kopiuje treść do schowka. Adres jest w `build.mjs` (`MAIL`).

## Wdrożenie

GitHub Pages z gałęzi `main`. Wszystkie ścieżki są względne, więc strona działa
też w podkatalogu.

## Przed przejściem na docelową domenę

- Usuń `<meta name="robots" content="noindex, nofollow">` w `build.mjs`.
- Zmień `SITE` w `build.mjs` na nowy adres (obraz do udostępnień, dane strukturalne).
- Zweryfikuj treść usług, procesu i pytań (FAQ) — to wersja robocza.
- Podmień adres kontaktowy, jeśli ma być inny niż `business@filadroid.ai`.
