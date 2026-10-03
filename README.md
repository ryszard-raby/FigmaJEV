# FigmaJev

Lokalna wtyczka Figma Design: podajesz kompletne drzewo UI, JEV 1.13 wybiera komponenty i warianty aktualnej biblioteki, a renderer tworzy instancje.

## Uruchomienie

Wymagania: Node.js 22.9+ i desktopowa Figma.

1. `npm install`
2. Skopiuj `.env.example` do `.env`. Ustaw `DEFAPI_API_KEY` oraz własny `FIGMAJEV_TOKEN` (minimum 20 znaków).
3. `npm run build`
4. `npm start`
5. Figma → Plugins → Development → Import plugin from manifest → wybierz `manifest.json`.
6. Uruchom FigmaJev. W „Połączenie i biblioteki” wpisz **FIGMAJEV_TOKEN**, nie klucz DefAPI.

Manifest wskazuje `dist/code.js` i `dist/ui.html`. Po zmianach wykonaj build, uruchom ponownie backend i wtyczkę.

Wybierz bibliotekę z listy. Skan obejmuje lokalne komponenty oraz komponenty zdalnych instancji użytych w pliku. Pełną opublikowaną bibliotekę dodajesz przez URL lub klucz jej pliku; backend potrzebuje `FIGMA_ACCESS_TOKEN` z dostępem do biblioteki (`library_content:read`). Standardowe Plugin API nie wylicza wszystkich włączonych bibliotek komponentów.

## Struktura projektu

Wklej kompletne drzewo w formacie `[componentName, properties?, ...children]`, a następnie kliknij „Utwórz ze struktury”. Prompt służy do edycji przypiętego elementu.

```json
["Layout",
  ["Card",
    ["Text", {"type":"heading", "text":"Zaloguj się"}],
    ["Input", {"purpose":"login"}],
    ["Input", {"purpose":"password"}],
    ["Container", {"direction":"horizontal", "align":"right"},
      ["Button", {"importance":"secondary", "text":"Anuluj"}],
      ["Button", {"importance":"primary", "text":"Zaloguj"}]
    ]
  ]
]
```

- Pierwsza pozycja to nazwa zbliżona do komponentu DS, np. Layout, Card, Input, Button, Text, Container.
- Opcjonalny obiekt properties występuje bezpośrednio po nazwie. Wartości: string, number lub boolean. Są intencją dla JEV, a nie mapowaniem wariantów w rendererze.
- Pozostałe pozycje to dzieci w kolejności renderowania. Dwa identyczne wpisy tworzą dwie instancje.
- `text` zawiera dokładną treść. Resolver kopiuje ją do jednoznacznej właściwości Label/Text, jedynej właściwości TEXT lub jednoznacznej warstwy tekstowej z katalogu. Przy niejednoznaczności podaj właściwą nazwę property, np. `Title` lub `Placeholder`. Jawne właściwości TEXT/BOOLEAN/INSTANCE_SWAP są kopiowane po nazwie (bez sufiksu `#…`); INSTANCE_SWAP wymaga klucza komponentu biblioteki. Intencje, np. importance/purpose/device, służą tylko do wyboru wariantu przez JEV.
- `width` / `height`: keep, hug, fill lub dodatnia liczba pikseli (np. 50) są wykonywane wprost ze struktury. Liczba ustawia daną oś na FIXED. Brak wartości oznacza KEEP. Nie ma pytań JEV o sizing.
- Plugin nie blokuje zależności Hug/Fill między rodzicem i dziećmi. Przekazuje wybrany tryb bezpośrednio do Figmy, która może dostosować układ lub zwrócić błąd API.
- Dla instancji KEEP dziedziczy tryb osi z komponentu źródłowego, odczytany przed `createInstance`. Renderer przywraca go po wstawieniu, properties i zawartości slotów; jawne HUG/FILL ze struktury ma pierwszeństwo. Katalog udostępnia te tryby jako `defaultSizing`, a konsola loguje `COMPONENT SIZING`. Źródłowe FIXED pozostaje Fixed — nie zgadujemy Fill/Hug na podstawie nazwy komponentu. Dotyczy to wszystkich komponentów DS, nie natywnych prymitywów ani edycji istniejących instancji.
- Limity: 256 elementów, 32 poziomy, 24 properties na element, 1000 znaków na wartość tekstową, 40 000 znaków wejściowego JSON-a. Jeden korzeń. Są to zabezpieczenia aplikacji przed nadmiernym rozmiarem żądania i pracy renderera, a nie limity Figmy. Jawne ograniczenia slotów z DS nadal obowiązują.

Domyślne drzewo: `["Layout", {"device":"mobile"}, ["Card", ["Container", ["Button"]]]]`. Komponenty biblioteczne przyjmujące dzieci muszą mieć natywny slot **Content**. Zwykła ramka o tej nazwie wewnątrz instancji nie wystarczy.

## Resolution

### Dokumentacja i ChatGPT

Pobranie opublikowanej biblioteki zapisuje alfabetyczny katalog z instrukcją formatu do `docs/design-system.md`. Przycisk **Otwórz w GPT** odświeża dokumentację wybranej biblioteki o properties, opisy zestawów i sloty, a następnie otwiera `https://chatgpt.com/?q=…` z linkiem do dokumentacji. Nie wywołuje API GPT ani JEV. Prompt jest również dostępny w panelu do ręcznego skopiowania, jeśli przeglądarka/ChatGPT nie obsłuży parametru `q` (nie jest to gwarantowany kontrakt API).

Lokalny podgląd: `http://localhost:3847/documentation` (GET bez tokenu, backend nadal nasłuchuje tylko lokalnie). Generowanie: POST `/documentation` z tokenem jak pozostałe operacje. Do dokumentacji trafiają nazwy, opisy, dostępne właściwości, sloty i warstwy tekstowe — bez kluczy API, identyfikatorów węzłów, promptów użytkownika i zaznaczenia.

Dokumentacja jest dost?pna pod adresem https://github.com/ryszard-raby/FigmaJEV/blob/main/docs/design-system.md. To domy?lny link przekazywany do GPT; mo?na go zmieni? przez `DOCUMENTATION_PUBLIC_URL` w `.env` i restart backendu. ChatGPT nie odczyta lokalnego endpointu. Aktualizacja pliku lokalnie nie publikuje go automatycznie na GitHubie; aktualizuj opublikowan? kopi? po zmianie DS. Plik dokumentuje ostatnio wybran? bibliotek?.

`UI → katalog + compact tree → parser → jeden wybór komponentów JEV → resolved tree → istniejący renderer`

JEV otrzymuje listę wymaganych elementów z intencją oraz nazwy i opisy kandydatów z Design Systemu. Zwraca wyłącznie mapę ID elementu → ID komponentu/wariantu. Bez osobnego etapu properties, wyboru natywnych prymitywów, szukania zamienników i dzielenia pytań na paczki. Brak pasującego komponentu kończy się czytelnym błędem.

`server/compact-tree.mjs` waliduje drzewo. Elementy o tej samej nazwie, intencji i liście dopuszczalnych komponentów współdzielą wybór w całym drzewie. Treść `text`, `width`, `height` i `slot` są wykonywane lokalnie i nie mnożą decyzji. Pozostałe intencje oraz różnice kandydatów wynikające z pojemności slotów zachowują osobne decyzje. Każdy wpis struktury nadal tworzy oddzielną instancję z własnym tekstem, rozmiarem i dziećmi. Log `COMPONENT RESOLUTION` podaje liczbę elementów i unikalnych decyzji. `server/resolver.mjs` wybiera komponenty przez istniejący klient JEV. `server/structure-render-plan.mjs` odtwarza hierarchię i kopiuje jawne wartości do kontraktu istniejącego renderera. Dzieci trafiają do jednoznacznego slotu Content (lub jedynego slotu); `slot` pozwala wskazać nazwę innego slotu. Wariant i nieokreślone właściwości pochodzą z wybranego komponentu DS.

Szybka edycja zaznaczenia zachowuje osobny flow. Stary planner jest wyłącznie referencją dla dawnych testów. Brak integracji z GPT.
Renderer nadal używa instancji bibliotecznych, slotów, kontroli sizingu i rollback. W nowych instancjach podane dzieci **zastępują domyślną zawartość Content**; pozostałe sloty Content są opróżniane. Przykładowe dzieci biblioteki nie dublują drzewa. Ograniczenia slotów nadal obowiązują. Pozostałe wewnętrzne warstwy komponentu pozostają częścią biblioteki.

Techniczna ramka FigmaJev pozostaje hostem: domyślnie width Hug i height Hug. Natywny korzeń Container łączy się z hostem; korzeń biblioteczny powstaje jako instancja wewnątrz niego. Natywne kontenery mają zerowy padding/gap, a tekst używa Inter Regular. Biblioteka zachowuje własne style. Obrazy muszą istnieć jako komponenty DS; nie ma generowania ani pobierania zdjęć.

## Zaznaczenie i szybka edycja

Zaznacz jeden element i wpisz np. `dodaj przycisk`, `usuń przycisk` lub `zrób większy tekst`. Panel automatycznie pokazuje polecenie edycji. Brak zaznaczenia przywraca tworzenie layoutu ze struktury JSON. Przy wielu zaznaczonych elementach wybierz jeden. Cel edycji jest ustalany przy rozpoczęciu operacji; późniejsza zmiana zaznaczenia nie przekierowuje zmian.

Szybkie polecenia używają małych, niezależnych decyzji:

- Dodawanie: 3 zapytania — wybór operacji, lista nazw/opisów komponentów i wariantów, lista wolnych slotów Content w zaznaczeniu. Instancja zachowuje domyślne properties i rozmiarowanie DS. Nie uruchamiamy resolvera drzewa ani nie pytamy o width/height. Dodawanie z promptu jest ograniczone do slotów; nie proponujemy zwykłych ramek.
- Usuwanie: 2 zapytania — operacja i lista usuwalnych celów z krótką ścieżką nazw. Brak snapshotu, wymiarów, properties i katalogu w pytaniu o cel.
- Edycja: operacja i properties jednego komponentu. JEV dostaje wyłącznie jego nazwę, opis, typy i aktualne wartości properties; dostępne odpowiedzi są zapisane w pytaniach. Dla kilku komponentów w zaznaczonym kontenerze dochodzi osobny wybór celu. Wewnętrzne instancje ikon nie są celami edycji.
- Zmiana ikony: lista komponentów biblioteki pojawia się dopiero w dodatkowym pytaniu, gdy JEV wskaże zmianę właściwości INSTANCE_SWAP. Przy zwykłej zmianie wariantu katalog nie jest wysyłany.

Zmiana tekstu wymaga udostępnionej właściwości TEXT; podaj treść w cudzysłowie. Zmiana wielkości korzysta z właściwości wariantu, np. Size. Szybka edycja nie zmienia surowych warstw tekstowych, fontSize, kierunku auto layoutu ani width/height. Pełny snapshot pozostaje po stronie aplikacji do kontroli równoległych zmian, ale nie trafia do JEV. Generowanie ze struktury JSON zachowuje osobny resolver.

Zmiany dotyczą zaznaczonego poddrzewa. „Usuń element” wskazuje samo zaznaczenie; polecenie dotyczące konkretnego dziecka może wskazać potomka. Nie można usunąć stałych warstw wewnętrznych instancji, a usunięcie dziecka slotu respektuje minimum dzieci z DS. Dodawanie zachowuje istniejącą zawartość. Snapshot chroni przed zastosowaniem odpowiedzi po równoległej zmianie dokumentu. Wynik można cofnąć przez Undo Figmy. Złożone zmiany struktury wykonuj przez edycję JSON-a i utworzenie nowego layoutu.

## Logi i testy

Terminal backendu pokazuje `INPUT TREE`, `REQUIRED COMPONENTS`, `JEV REQUEST`, `JEV RESPONSE`, `RESOLVED TREE`. Konsola wtyczki pokazuje `RENDER RESULT` z powodzeniem lub błędem. Panel „Resolved tree / wynik edycji” pokazuje odpowiedź backendu. Pełne żądania i odpowiedzi trafiają do nadpisywanych, formatowanych plików `logs/request-1.json`, `logs/response-1.json`, `logs/request-2.json`, `logs/response-2.json` itd. Numer to requestNumber w obrębie promptu; nie powstają pliki dla kolejnych UUID ani dat. `logs/prompt.json` zawiera ostatni prompt, `logs/summary.json` status i liczbę wywołań. Początek nowego promptu oznacza stare pary jako `not_called`, wysłanie żądania ustawia odpowiedź na `pending`, a błąd zapisuje się w tym samym `response-N.json`. Pliki pozostają na miejscu, więc można trzymać je otwarte w IDE. Równoległe starsze prompty nie nadpisują logów najnowszego. Historyczny `defapi.log` nie jest już uzupełniany.

`npm test`, `npm run typecheck`, `npm run build`.

Testy obejmują parser, hierarchię i ilości, reuse decyzji, mapowanie intencji przez JEV, edycje oraz compact tree → resolver → renderer z atrapą Figmy i JEV. Nie wykonują płatnych zapytań. Jakość mapowania rzeczywistej biblioteki i działanie slotów wymagają próby we wtyczce z prawdziwym JEV.

Backend nasłuchuje na `127.0.0.1:3847` i wymaga tokenu parowania. Klucze DefAPI i REST Figmy pozostają w `.env`. Token lokalnego serwera i URL biblioteki zapamiętuje `figma.clientStorage`; usuwa je „Zapomnij zapisane dane”. Do DefAPI trafiają struktura, katalog i kontekst edycji. Logi zawierają te dane, bez nagłówków autoryzacji. Snapshot nie ma limitu liczby warstw. Pozostają limity: katalog 180 wariantów, żądanie HTTP 500 kB, planowanie 180 sekund, wywołanie JEV 30 sekund. Brak automatycznych ponowień płatnych żądań.

## Eksport zmiennych CSS

Przycisk **Pobierz zmienne CSS** zapisuje `figma-variables.css` bez backendu i bez JEV. Uruchom wtyczkę w pliku źródłowym design systemu. Eksport obejmuje lokalne zmienne oraz dostępne zależności aliasów. Nie korzysta z katalogu komponentów REST. Niedostępny alias zatrzymuje eksport z komunikatem.

Zaimportuj CSS w aplikacji. Domyślne tryby obowiązują na `:root`; komentarze opisują atrybuty na `<html>`, np. `data-figma-theme="dark"`. Kolekcje przełączasz niezależnie. Aliasy zachowują `var(--...)`. Poprawne nazwy WEB Code syntax mają pierwszeństwo; pozostałe mają prefiks `--cd-` i nazwę zmiennej. Kolizje nazw generowanych otrzymują sufiks liczbowy. Powtórzone jawne nazwy CSS wymagają poprawy w Figmie. Kolory zapisujemy jako `#RRGGBB`, a z przezroczystością jako `#RRGGBBAA`.

Kolory zachowują alpha. Liczby ze scope wyłącznie wymiarowym otrzymują px, inne pozostają bez jednostek (dla długości użyj `calc(var(--token) * 1px)`). String to cytowany tekst CSS, boolean to 1/0. Eksport obejmuje tokeny, nie style komponentów ani layouty. Fonty dostarcz osobno. Plik nie jest automatycznie publikowany na GitHubie.
