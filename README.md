# Filadelfia.ai — strona agencji AI

Statyczna strona (HTML + CSS + JS, bez builda i bez zależności).

Kierunek wizualny: aluminium `#E8EAED`, grafit `#0A0B0D`, jeden akcent `#2B2BFF`.
Kroje: Mona Sans (szeroki, cienki) i Martian Mono. Jedyny element ozdobny to pole
punktów w WebGL, które przy przewijaniu przechodzi przez pięć form:
tęczówka → siatka → przepływ → sfera → punkt (po jednej na sekcję).

## Pliki

- `index.html` — cała treść strony
- `styles.css` — style i tokeny kolorów
- `script.js` — pole punktów (WebGL), odczyty na dole ekranu, wejście treści
- `favicon.svg` — sygnet

## Podgląd lokalny

```bash
python3 -m http.server 4173
```

## Wdrożenie

Strona nie wymaga builda — wystarczy opublikować katalog główny repo
(np. GitHub Pages, Vercel, Netlify, Hostinger). Wszystkie ścieżki są względne,
więc działa też w podkatalogu.

## Przed przejściem na docelową domenę

- Usuń `<meta name="robots" content="noindex, nofollow">` z `index.html`.
- Zweryfikuj treść usług, procesu i FAQ — to wersja robocza.
- Podmień adres kontaktowy, jeśli ma być inny niż `kontakt@filadelfia.io`.
