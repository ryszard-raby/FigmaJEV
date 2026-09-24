# FigmaJev

Lokalna wtyczka Figma Design tworząca layouty z rzeczywistych instancji komponentów przy użyciu modelu **JEV 1.13**. Backend Node przechowuje klucze API; wtyczka otrzymuje wyłącznie plan zmian.

## Uruchomienie

Wymagania: Node.js 22.9+ i aplikacja desktopowa Figma.

1. `npm install`
2. Skopiuj `.env.example` do `.env`.
3. Ustaw `DEFAPI_API_KEY` oraz własny `FIGMAJEV_TOKEN` (minimum 20 znaków). Przykładowy token można wygenerować poleceniem `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
4. `npm run build`
5. `npm start`
6. Figma → Plugins → Development → Import plugin from manifest → wybierz `manifest.json` z tego katalogu. Jeśli Figma wymaga własnego ID, utwórz lokalny plugin przez „New plugin” i wpisz nadane ID do manifestu.
7. Uruchom FigmaJev. Rozwiń „Połączenie i biblioteki” i wklej **FIGMAJEV_TOKEN**, nie klucz DefAPI.

Gotowe artefakty po kompilacji: `dist/code.js`, `dist/ui.html`. Manifest wskazuje te pliki. Po zmianach kodu uruchom build ponownie.

## Użycie

- Wybierz katalog w dropdownie. Skan obejmuje lokalne komponenty ze wszystkich stron oraz główne komponenty zdalnych instancji użytych w pliku.
- Aby wczytać całą opublikowaną bibliotekę, ustaw `FIGMA_ACCESS_TOKEN` na serwerze (zakres `library_content:read`), a we wtyczce dodaj URL lub klucz jej pliku.
- Wpisz np. `Pionowy layout z kartą produktu, zdjęciem z biblioteki i dwoma przyciskami: accent i primary. Tekst „Nowa kolekcja”.`
- Kliknij „Utwórz layout”. Wynik składa się z ramek auto layout, tekstów i instancji z katalogu. Warianty są osobnymi kandydatami o nazwie zestawu i wariantu.
- Aby edytować: zaznacz element, kliknij „Przypnij”, wpisz zmianę. Przypięcie pozostaje aktywne po zmianie zaznaczenia. „Odepnij” przywraca tworzenie nowych layoutów.
- Wynik można cofnąć mechanizmem Undo Figmy. Panel „Struktura wyniku” pokazuje drzewo lub listę operacji.

## Architektura

`Figma UI → snapshot + katalog → lokalny backend → decyzje JEV → plan → walidacja → Figma renderer`

**JEV jest modelem decyzyjnym, nie generatorem JSON/tekstu.** Backend zadaje pytania typu Choice z zamkniętą listą odpowiedzi. Dla każdego kontenera wybiera kierunek, odstęp i liczbę dzieci, a następnie typ każdego dziecka. Kolejne pytania otrzymują aktualne drzewo oraz położenie kontenera. Komponenty biblioteki są liśćmi: ich wnętrze pozostaje zdefiniowane przez bibliotekę. Cały wariant Card może już zawierać Photo, Text i Button.

Przykład planu renderera:

```json
{
  "mode": "create",
  "tree": {
    "type": "container", "name": "Layout", "direction": "VERTICAL", "gap": 16,
    "children": [
      { "type": "component", "componentId": "key-of-card-variant" },
      { "type": "container", "direction": "HORIZONTAL", "gap": 8, "children": [
        { "type": "component", "componentId": "key-of-accent-button" },
        { "type": "component", "componentId": "key-of-primary-button" }
      ] }
    ]
  }
}
```

Edycja przesyła aktualny snapshot: ID, hierarchię, tekst, wymiary, auto layout, klucz komponentu i dostępne właściwości instancji. JEV wybiera zmiany albo `keep`. Renderer porównuje snapshot przed zastosowaniem odpowiedzi, żeby nie nadpisać zmian wykonanych podczas oczekiwania. Zmiany są ograniczone do przypiętego poddrzewa. W przypadku błędu wykonania podejmuje wycofanie wykonanych operacji.

## Zakres pierwszej wersji

- Edycja obsługuje treść tekstów, kierunek i odstępy istniejącego auto layoutu oraz właściwości instancji TEXT, BOOLEAN i VARIANT. Zachowuje ID edytowanego elementu. Nie dodaje, nie usuwa i nie przestawia warstw w trybie edycji.
- Nie wstawia nowych dzieci do środka instancji i nie odłącza instancji. Obsługa slotów wymaga osobnego kontraktu z biblioteką.
- Treści w cudzysłowach i istniejące teksty są kandydatami dla JEV; model nie tworzy dowolnego copy. Nowe instancje zachowują domyślne teksty biblioteki; po przypięciu można zmienić ich właściwości tekstowe.
- Kolor accent/primary jest wybierany jako rzeczywisty wariant biblioteki. Brak takiego wariantu oznacza brak tej opcji; renderer nie wymyśla tokenów.
- Photo musi istnieć jako komponent biblioteki. Brak generatora obrazów i pobierania zdjęć.
- Standardowe Plugin API nie wylicza wszystkich komponentów włączonych bibliotek. Pełny katalog pobieramy przez REST API konkretnego pliku biblioteki; nie ma automatycznej identyfikacji wszystkich bibliotek zespołu.
- Limity: 180 komponentów/wariantów w katalogu, 32 węzły nowego layoutu, 4 dzieci kontenera, maks. 4 poziomy dzieci, 80 warstw kontekstu i 240 decyzji edycji. Generowanie jest wieloetapowe; szybkość pojedynczej decyzji nie jest czasem całego layoutu. Limit całości: 180 sekund; pojedynczego żądania JEV: 30 sekund. Brak automatycznych ponowień płatnych żądań.
- Tekst natywny używa Inter Regular; biblioteka zachowuje własne style. Zmiana całej treści tekstu z mieszanym formatowaniem może zmienić formatowanie zakresów.
- To lokalna wersja developerska, bez wdrożenia backendu, OAuth, historii konwersacji i testu w rzeczywistym pliku Figmy. Zmiana portu wymaga również zmiany UI i `devAllowedDomains` w manifeście.

## Bezpieczeństwo i testy

Backend nasłuchuje tylko na `127.0.0.1` i wymaga tokenu parowania. Klucz DefAPI i token REST Figmy pozostają w `.env`, ignorowanym przez Git. Token połączenia nie jest trwale zapisywany przez UI. Do DefAPI trafiają prompt, katalog i — wyłącznie w trybie edycji — przypięte poddrzewo. Serwer nie loguje treści ani kluczy.

`npm run typecheck`, `npm run build`, `npm test`.

Testy obejmują kontrakt DefAPI z atrapą transportu, odrzucanie odpowiedzi spoza schematu, rekurencyjny plan i limity, selektywną edycję oraz cytowane teksty. Testy nie wykonują płatnych żądań. Przed publikacją potrzebny jest test integracyjny w Figmie z prawdziwą biblioteką i kluczem API.

Źródła: [DefAPI JEV](https://defapi.org/api/model/en/typesafe/jev-1.13), [TypeSafe — model decyzji](https://docs.typesafe.ai/introduction), [Figma TeamLibrary](https://developers.figma.com/docs/plugins/api/figma-teamlibrary/), [Figma REST — biblioteki](https://developers.figma.com/docs/rest-api/component-endpoints/).
