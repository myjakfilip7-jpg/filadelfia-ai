# Filadelfia.ai — strona agencji AI

Statyczna strona (HTML + CSS + JS, bez zależności).

Kierunek wizualny: aluminium `#E8EAED`, grafit `#0A0B0D`, jeden akcent `#2B2BFF`.
Kroje: Mona Sans (szeroki, cienki) i Martian Mono. Główny element to pole punktów
w WebGL z pięcioma formami: tęczówka → siatka → przepływ → sfera → punkt. Strona
główna zmienia je przy przewijaniu; każda podstrona ma jedną, stałą. Punkty
układają też napisy (strona 404, polecenie `napisz`).

## Pliki

- `build.mjs` — **źródło wszystkich stron**: wspólny nagłówek, menu, stopka i treść
- `*.html` — wynik `node build.mjs`; nie edytuj ręcznie
  - `index.html`, `kampanie.html`, `automatyzacje.html`, `chatboty.html`, `strony.html`,
    `kontakt.html`, `prywatnosc.html`, `marka.html`, `404.html`
- `styles.css` — style i tokeny kolorów
- `script.js` — pole punktów, odczyty, menu, wiersz poleceń, dema, formularz
- `fonts/` — Mona Sans i Martian Mono (licencja SIL OFL), hostowane lokalnie
- `server/` — backend: logowanie przez GitHub, zgłoszenia, panel (opis w `server/README.md`)
- `panel.html`, `panel.js`, `panel.css`, `theme.js` — panel właściciela; działa tylko z uruchomionym backendem
- `favicon.svg` — znak (tęczówka)
- `og.png` — obraz do udostępnień (1200 × 630)
- `icon-180.png`, `icon-192.png`, `icon-512.png`, `manifest.webmanifest` — ikony na ekran telefonu
- `sitemap.xml` — mapa strony (generowana przez build z adresu `SITE`)
- `tools/check.mjs` — kontrola frontendu
- `media/` — trzy przykładowe kadry reklamowe wygenerowane w Higgsfield (GPT Image 2.6); to przykłady, nie realizacje dla klientów

## Zmiana treści, stylów i skryptów

Treść jest w `build.mjs`. Po każdej zmianie treści, `styles.css`, `script.js` albo plików panelu
uruchom build — wpisuje on do stron skrót zawartości plików (`styles.css?v=…`), dzięki czemu
przeglądarki od razu pobierają nową wersję:

```bash
node build.mjs
```

## Kontrola przed publikacją

```bash
node tools/check.mjs
```

Sprawdza zbudowane strony: odnośniki i kotwice, jeden nagłówek h1, opisy obrazów, nazwy
przycisków, aktualność builda oraz wagę strony. Testy backendu: `node server/test.mjs`.

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

Bez backendu (np. na GitHub Pages) formularz składa wiadomość i otwiera program pocztowy
(`mailto:`) albo kopiuje treść do schowka. Gdy strona działa z backendem (`node server/server.mjs`),
formularz zapisuje zgłoszenie, a właściciel widzi je w panelu. Adres jest w `build.mjs` (`MAIL`).

## Wdrożenie

GitHub Pages z gałęzi `main`. Wszystkie ścieżki są względne, więc strona działa
też w podkatalogu.

## Przed przejściem na docelową domenę

- Usuń `<meta name="robots" content="noindex, nofollow">` w `build.mjs`.
- Zmień `SITE` w `build.mjs` na nowy adres (obraz do udostępnień, dane strukturalne).
- Zweryfikuj treść usług, procesu i pytań (FAQ) — to wersja robocza.
- Uzupełnij `prywatnosc.html` (pola „do uzupełnienia” w `build.mjs`) i daj treść do sprawdzenia prawnikowi.
- Podmień adres kontaktowy, jeśli ma być inny niż `business@filadroid.ai`.
