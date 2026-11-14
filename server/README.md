# Backend Filadelfia.ai

Jeden plik w Node, bez zależności. Robi trzy rzeczy:

1. **Logowanie przez GitHub** — tylko loginy z `ADMIN_GITHUB_LOGINS` dostają sesję.
2. **Zgłoszenia** — formularz kontaktowy zapisuje je w `server/data/zgloszenia.json`.
3. **Panel właściciela** (`/panel.html`) — lista zgłoszeń, zmiana statusu, usuwanie.

Serwer podaje też pliki strony, więc lokalnie wszystko działa pod jednym adresem.

## Uruchomienie

```bash
node server/server.mjs
```

Strona: http://localhost:8787 · panel: http://localhost:8787/panel.html

## Konfiguracja logowania (jednorazowo)

1. GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**
   - Homepage URL: `http://localhost:8787`
   - Authorization callback URL: `http://localhost:8787/auth/github/callback`
2. Skopiuj **Client ID** i wygeneruj **Client secret**.
3. Wpisz oba do `server/.env` (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) i uruchom serwer ponownie.

`server/.env` i `server/data/` są w `.gitignore` — nie trafiają do repozytorium.

## Testy

```bash
node server/test.mjs
```

Uruchamia atrapę GitHuba i sprawdza cały przepływ: logowanie, odrzucenie obcego konta,
podrobiony `state` i sesję, ochronę zapisu, limit zgłoszeń, pliki, których nie wolno wydać.

## Jak to jest zabezpieczone

- Sesja to ciasteczko `HttpOnly`, `SameSite=Lax` (i `Secure` pod https), podpisane HMAC-SHA256; ważne 7 dni.
- Token GitHuba służy tylko do odczytania loginu i nie jest nigdzie zapisywany. Zakres: `read:user`.
- Lista dopuszczonych loginów jest sprawdzana przy każdym żądaniu.
- Zmiany danych wymagają tego samego źródła (`Origin`) i nagłówka `x-fila`.
- Formularz: limit 5 zgłoszeń na 10 minut z adresu, limit rozmiaru, pole-pułapka na boty.
- Treść zgłoszeń panel wstawia jako tekst, nigdy jako HTML.

## Zanim trafi na hosting

- Ustaw `BASE_URL` na adres https i dodaj drugi callback w aplikacji OAuth.
- Plik JSON wystarcza lokalnie i na jednym serwerze z dyskiem. Na platformach bez trwałego dysku
  (Cloudflare Workers, Vercel) trzeba go zamienić na bazę — to jedna funkcja `load` i jedna `mutate`.
- Limit zgłoszeń liczy adres połączenia. Za proxy trzeba czytać adres z nagłówka, któremu ufasz.
- Dopisz przechowywanie zgłoszeń do strony Prywatność.
