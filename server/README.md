# Backend Filadelfia.ai

Jeden plik w Node, bez zależności. Robi cztery rzeczy:

1. **Logowanie przez GitHub z rolami.**
   - Właściciele z `ADMIN_GITHUB_LOGINS` są stali; kolejnych użytkowników dodaje właściciel w panelu.
   - Role: **właściciel** (wszystko), **pracownik** (czyta, zmienia status, dodaje notatki),
     **podgląd** (tylko czyta). Zmiana roli albo odebranie dostępu działa od razu, także na trwające sesje.
2. **Zgłoszenia** — formularz kontaktowy zapisuje je w `server/data/zgloszenia.json`.
3. **Licznik odsłon** — bez plików cookie i bez zapisywania adresów IP. W `server/data/odslony.json`
   są tylko sumy na dzień: odsłony, unikalni, strony, źródła. Nie liczy botów, wizyt z prośbą
   „nie śledź” (DNT / GPC) ani zalogowanych użytkowników panelu.
4. **Panel** (`/panel.html`) — trzy widoki:
   - **Zgłoszenia:** liczniki i zakładki, wyszukiwanie, filtr tematu, szczegóły z „Odpisz e-mailem”
     albo „Zadzwoń”, status, notatki, historia zmian, eksport CSV, skróty `/`, `j`/`k`, `Esc`.
   - **Statystyki:** odsłony dziś / 7 / 30 / 90 dni, wykres dzienny z tabelą, najczęściej oglądane
     strony, źródła wejść.
   - **Użytkownicy** (tylko właściciel): dodawanie, zmiana roli, odbieranie dostępu, ostatnie logowanie.

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
- Rola jest ustalana przy każdym żądaniu, a uprawnienia sprawdza serwer, nie tylko interfejs.
- Zmiany danych wymagają tego samego źródła (`Origin`) i nagłówka `x-fila`.
- Formularz: limit 5 zgłoszeń na 10 minut z adresu, limit rozmiaru, pole-pułapka na boty.
- Treść zgłoszeń panel wstawia jako tekst, nigdy jako HTML.
- `panel.html` jest podawany ze ścisłą polityką CSP (tylko własne pliki, żadnych skryptów w treści strony) i bez buforowania.
- Eksport CSV zabezpiecza komórki zaczynające się od `=`, `+`, `-`, `@`, żeby arkusz nie potraktował ich jak formuł.

## Zanim trafi na hosting

- Ustaw `BASE_URL` na adres https i dodaj drugi callback w aplikacji OAuth.
- Plik JSON wystarcza lokalnie i na jednym serwerze z dyskiem. Na platformach bez trwałego dysku
  (Cloudflare Workers, Vercel) trzeba go zamienić na bazę — to jedna funkcja `load` i jedna `mutate`.
- Limit zgłoszeń liczy adres połączenia. Za proxy trzeba czytać adres z nagłówka, któremu ufasz.
- Dopisz przechowywanie zgłoszeń do strony Prywatność (licznik odsłon jest już opisany).
- „Unikalni” liczą się od zera po restarcie serwera w danym dniu (skróty żyją tylko w pamięci).
