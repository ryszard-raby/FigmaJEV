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

Planowanie zaczyna się od rejestru wymagań semantycznych w `server/requirements.mjs`. JEV wybiera ich liczbę (maks. 32), a następnie zakresy tekstu źródłowego opisujące kolejne wystąpienia. To zamknięte pytania Choice, bez generowania swobodnego tekstu. Jawne ilości stają się osobnymi ID: np. dwa inputy to dwa wymagania, nawet jeśli wskazują ten sam fragment promptu. Interpretacja ilości i znaczenia nadal zależy od modelu; kod gwarantuje jednokrotne wykorzystanie każdego rozpoznanego ID.

Planner rozwija każde poddrzewo przed wyborem kolejnego elementu rodzeństwa. Po wyborze elementu model przypisuje mu jedno pozostałe wymaganie albo oznacza komponent jako czysto strukturalny. Natywne kontenery nigdy nie konsumują wymagań; biblioteczne wrappery również nie powinny ich konsumować. Samo posiadanie slotu nie przesądza o roli komponentu. `requirementId` jest metadanymi planera i renderer go ignoruje.

Przed pytaniem o liczbę lub typ dzieci planner przelicza `requiredRequirements`, `fulfilledRequirements`, `remainingRequirements` przez całe drzewo, włącznie z `slots[].children`. `plannedChildren` opisuje aktualne poddrzewo. Gdy wszystkie ID są spełnione, kod przerywa dodawanie dzieci, nawet jeśli wcześniejsza decyzja o ich liczbie była zawyżona. Nie porównuje typów komponentów: dwa buttony dla różnych celów pozostają dozwolone. Brak dopasowania, limity lub zbyt mała liczba dzieci skutkują ostrzeżeniem o niespełnionych wymaganiach, bez deklarowania pełnego sukcesu.

W terminalu backendu każdemu krokowi towarzyszy `[planner]` z `currentPath`, wymaganiami, zaplanowanymi potomkami, `additionalChildren` i powodem zatrzymania. Te same dane są w `trace` panelu „Struktura wyniku”; kontekst żądań trafia też do istniejącego `logs/defapi.log`. Dochodzą do dwóch wywołań na analizę wymagań oraz jedno na przypisanie celu elementu. Nie ma dodatkowych automatycznych prób naprawczych. Przy dodawaniu do przypiętego slotu rejestr obejmuje żądane nowe elementy; istniejąca zawartość pozostaje w kontekście. Renderer i edycja samych właściwości pozostają bez zmian.

`Figma UI → snapshot + katalog → lokalny backend → decyzje JEV → plan → walidacja → Figma renderer`

**JEV jest modelem decyzyjnym, nie generatorem JSON/tekstu.** Backend zadaje pytania typu Choice z zamkniętą listą odpowiedzi. Dla każdego kontenera wybiera kierunek i liczbę dzieci, a następnie typ każdego dziecka. Wybiera również `width` i `height`: `FILL` lub `HUG`. Kolejne pytania otrzymują aktualne drzewo oraz położenie kontenera. Komponenty z natywnym slotem `Content` mogą otrzymać kolejne dzieci, także komponenty z własnymi slotami. Pozostałe komponenty są liśćmi.

## Sloty Content

Główna techniczna ramka planera i renderera to jeden `FigmaJev` (ścieżka `technical-root`); nie powstaje dodatkowy `Generated content`. Nie jest komponentem Layout z biblioteki. Pytania o liczbę i typ dzieci wyraźnie rozróżniają te role: przy żądaniu komponentu Layout model powinien wybrać jego ID z katalogu i zaplanować potomków w slocie Content. Techniczna ramka nadal pozostaje w wyniku; nie zastępuje komponentu biblioteki.

Przy tworzeniu oraz dodawaniu dzieci width/height mają trzy opcje: `KEEP` (bez zmian), `HUG`, `FILL`. Instrukcje preferują `KEEP`, dopóki prompt nie prosi o zmianę konkretnej osi konkretnego dziecka. Przykład: przycisk może mieć `width: FILL` i `height: KEEP`, zachowując standardową wysokość biblioteki. Renderer zachowuje rozmiar i tryb skalowania również wtedy, gdy slot automatycznie rozciąga dziecko przy wstawieniu. Dla nowych natywnych kontenerów KEEP zachowuje początkowy Hug; istniejące elementy nadal mają opcję `keep` w planie edycji. Pod rodzicem Hug dziecko może wybrać KEEP lub HUG (Fill nie jest oferowane).

Przed planowaniem plugin odczytuje definicje komponentów wybranej biblioteki (import zdalnych definicji odbywa się w partiach po 6). Rozpoznaje natywne `SlotNode` o nazwie warstwy lub właściwości `Content`, bez rozróżniania wielkości liter. Zwykła ramka nazwana Content wewnątrz instancji nie jest slotem — należy przygotować prawdziwy slot w komponencie głównym i opublikować bibliotekę.

- Tworzenie: `Utwórz Card i dodaj do jego Content przycisk primary.` Plan zawiera `slots: [{ path: [0], children: [...] }]`; ścieżka jest odczytana z definicji, nie zgadywana z nazwy.
- Edycja: przypnij instancję Card/Layout i wpisz `Dodaj button primary do Content`. Model wybiera dodawanie i slot docelowy; renderer dopisuje dzieci na końcu. Istniejąca zawartość, ID instancji i połączenie z biblioteką pozostają zachowane.
- Jedna edycja wykonuje albo dodawanie, albo zmiany właściwości. Nie zastępuje ani nie usuwa istniejących dzieci. Nie odłącza instancji i nie zmienia głównego komponentu.
- Zachowane są limity drzewa oraz do 4 nowych dzieci na slot. Kontekst zawiera pojemność i preferowane komponenty slotu. Renderer kontroluje naruszenia ograniczeń Figmy; przy błędzie usuwa tylko nowo dodane dzieci. Testy używają atrap API; obsługę trzeba sprawdzić na rzeczywistym slocie biblioteki.

Paddingi i odstępy nie są decyzjami modelu. Nowe natywne kontenery mają je ustawione na zero; istniejące warstwy i komponenty biblioteki zachowują swoje ustawienia. Nowy layout powstaje wewnątrz ramki auto layout `FigmaJev` z szerokością Hug i stałą wysokością 480 px. Jej szerokość dopasowuje się do zawartości, główny kontener ma wybór KEEP/HUG na obu osiach (KEEP zachowuje width Hug i height 480 px). Fill jest dostępne tylko dla dzieci z odpowiednim rodzicem. Na osi, na której rodzic ma Hug, nowe dzieci otrzymują Hug, aby uniknąć kołowej zależności rozmiarów. W edycji model dostaje tylko opcje zgodne z bieżącym układem: Fill wymaga rodzica z auto layoutem i rozmiarem innym niż Hug; Hug wymaga tekstu albo auto layoutu bez dzieci Fill na danej osi. Gdy komponent biblioteki nie obsługuje Hug, renderer zachowuje jego rozmiar i pokazuje komunikat.

Przykład planu renderera:

```json
{
  "mode": "create",
  "tree": {
    "type": "container", "name": "Layout", "direction": "VERTICAL", "width": "FILL", "height": "HUG",
    "children": [
      { "type": "component", "componentId": "key-of-card-variant", "width": "FILL", "height": "HUG" },
      { "type": "container", "direction": "HORIZONTAL", "width": "FILL", "height": "HUG", "children": [
        { "type": "component", "componentId": "key-of-accent-button", "width": "HUG", "height": "HUG" },
        { "type": "component", "componentId": "key-of-primary-button", "width": "HUG", "height": "HUG" }
      ] }
    ]
  }
}
```

Edycja przesyła aktualny snapshot: ID, hierarchię, tekst, wymiary, auto layout, klucz komponentu i dostępne właściwości instancji. JEV wybiera zmiany albo `keep`. Renderer porównuje snapshot przed zastosowaniem odpowiedzi, żeby nie nadpisać zmian wykonanych podczas oczekiwania. Zmiany są ograniczone do przypiętego poddrzewa. W przypadku błędu wykonania podejmuje wycofanie wykonanych operacji.

## Zakres pierwszej wersji

- Edycja obsługuje treść tekstów, kierunek auto layoutu, width/height (Fill/Hug), właściwości instancji TEXT, BOOLEAN i VARIANT oraz dopisywanie dzieci do natywnych slotów Content. Zachowuje ID edytowanej instancji. Nie usuwa i nie przestawia istniejących warstw.
- Treści w cudzysłowach i istniejące teksty są kandydatami dla JEV; model nie tworzy dowolnego copy. Nowe instancje zachowują domyślne teksty biblioteki; po przypięciu można zmienić ich właściwości tekstowe.
- Kolor accent/primary jest wybierany jako rzeczywisty wariant biblioteki. Brak takiego wariantu oznacza brak tej opcji; renderer nie wymyśla tokenów.
- Photo musi istnieć jako komponent biblioteki. Brak generatora obrazów i pobierania zdjęć.
- Standardowe Plugin API nie wylicza wszystkich komponentów włączonych bibliotek. Pełny katalog pobieramy przez REST API konkretnego pliku biblioteki; nie ma automatycznej identyfikacji wszystkich bibliotek zespołu.
- Limity: 180 komponentów/wariantów w katalogu, 32 węzły nowego layoutu, 4 dzieci kontenera, maks. 4 poziomy dzieci, 80 warstw kontekstu i 240 decyzji edycji. Generowanie jest wieloetapowe; szybkość pojedynczej decyzji nie jest czasem całego layoutu. Limit całości: 180 sekund; pojedynczego żądania JEV: 30 sekund. Brak automatycznych ponowień płatnych żądań.
- Tekst natywny używa Inter Regular; biblioteka zachowuje własne style. Zmiana całej treści tekstu z mieszanym formatowaniem może zmienić formatowanie zakresów.
- To lokalna wersja developerska, bez wdrożenia backendu, OAuth, historii konwersacji i testu w rzeczywistym pliku Figmy. Zmiana portu wymaga również zmiany UI i `devAllowedDomains` w manifeście.

## Bezpieczeństwo i testy

Backend nasłuchuje tylko na `127.0.0.1` i wymaga tokenu parowania. Klucz DefAPI i token REST Figmy pozostają w `.env`, ignorowanym przez Git. Token połączenia FIGMAJEV_TOKEN i ostatni adres biblioteki zapisują się automatycznie w `figma.clientStorage` na urządzeniu użytkownika i wracają po uruchomieniu wtyczki. Można je usunąć przyciskiem „Zapomnij zapisane dane”. Katalog biblioteki nadal pobiera się przyciskiem „Dodaj”. Dane połączenia nie są zapisywane w dokumencie Figmy. Do DefAPI trafiają prompt, katalog i — wyłącznie w trybie edycji — przypięte poddrzewo. Pełne requesty i response są zapisywane jako JSONL w `logs/defapi.log`; pliki `.log` są ignorowane przez Git. Klucze i nagłówki autoryzacji nie trafiają do logu.

`npm run typecheck`, `npm run build`, `npm test`.

Testy obejmują kontrakt DefAPI z atrapą transportu, odrzucanie odpowiedzi spoza schematu, rekurencyjny plan i limity, selektywną edycję oraz cytowane teksty. Testy nie wykonują płatnych żądań. Przed publikacją potrzebny jest test integracyjny w Figmie z prawdziwą biblioteką i kluczem API.

Źródła: [DefAPI JEV](https://defapi.org/api/model/en/typesafe/jev-1.13), [TypeSafe — model decyzji](https://docs.typesafe.ai/introduction), [Figma TeamLibrary](https://developers.figma.com/docs/plugins/api/figma-teamlibrary/), [Figma REST — biblioteki](https://developers.figma.com/docs/rest-api/component-endpoints/).
