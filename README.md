# Filadelfia.ai — strona agencji AI

Statyczna strona (HTML + CSS + JS, bez builda). Kierunek wizualny C · Produkt:
ciemne tło, limonka `#B7FF1B`, Inter + IBM Plex Mono.

## Pliki

- `index.html` — cała treść strony
- `styles.css` — style i tokeny kolorów
- `script.js` — animacja przebiegu agenta w hero, rok w stopce
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
