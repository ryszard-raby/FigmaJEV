# FigmaJev

Lokalna wtyczka Figma Design: podajesz kompletne drzewo UI, JEV 1.13 wybiera komponenty i właściwości aktualnej biblioteki, a renderer tworzy instancje.

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
- `text` zawiera dokładną treść. JEV wskazuje właściwość tekstową lub warstwę komponentu, która ją otrzyma. Inne ciągi properties też mogą być kandydatami dla właściwości TEXT, np. placeholder. Model nie generuje copy.
- `width` / `height` mogą wyrażać intencję keep, hug lub fill. JEV wybiera konkretny tryb, preferując KEEP. Niepoprawna decyzja kończy się błędem, bez cichej korekty przez renderer.
- Plugin nie blokuje zależności Hug/Fill między rodzicem i dziećmi. Przekazuje wybrany tryb bezpośrednio do Figmy, która może dostosować układ lub zwrócić błąd API.
- Dla instancji KEEP dziedziczy tryb osi z komponentu źródłowego, odczytany przed `createInstance`. Renderer przywraca go po wstawieniu, properties i zawartości slotów; jawne HUG/FILL od JEV ma pierwszeństwo. Katalog udostępnia te tryby jako `defaultSizing`, a konsola loguje `COMPONENT SIZING`. Źródłowe FIXED pozostaje Fixed — nie zgadujemy Fill/Hug na podstawie nazwy komponentu. Dotyczy to wszystkich komponentów DS, nie natywnych prymitywów ani edycji istniejących instancji.
- Limity: 256 elementów, 32 poziomy, 24 properties na element, 1000 znaków na wartość tekstową, 40 000 znaków wejściowego JSON-a. Jeden korzeń. Są to zabezpieczenia aplikacji przed nadmiernym rozmiarem żądania i pracy renderera, a nie limity Figmy. Jawne ograniczenia slotów z DS nadal obowiązują.

Domyślne drzewo: `["Layout", ["Card", ["Container", ["Button"]]]]`. Komponenty biblioteczne przyjmujące dzieci muszą mieć natywny slot **Content**. Zwykła ramka o tej nazwie wewnątrz instancji nie wystarczy.

## Resolution

`UI → katalog + compact tree → parser → dwa etapy decyzji JEV → resolved tree → istniejący renderer`

Małe etapy mieszczą się w jednym żądaniu. Większe klient dzieli na paczki do 24 pytań i 96 kB, ograniczając kontekst do bieżących elementów i przodków. To budżet aplikacji, nie deklarowany limit DefAPI. Odpowiedzi łączą się po ID pytań; struktura nie jest planowana ponownie. Log `JEV BATCH` pokazuje postęp. Przy HTTP 400 klient zapisuje i zwraca szczegóły odpowiedzi serwera, bez automatycznych ponowień.

`server/compact-tree.mjs` waliduje drzewo i przypisuje ścieżki. Identyczne poddrzewa rodzeństwa, wraz z properties i kontekstem rodzica, współdzielą decyzje. Nadal mają oddzielne ścieżki i powstają jako oddzielne elementy. Cache działa tylko w obrębie pojedynczego żądania.

`server/resolver.mjs` używa istniejącego klienta `server/jev.mjs`:

1. JEV wybiera rzeczywisty komponent/wariant dla każdej unikalnej pozycji. Dostaje nazwy, opisy i informacje o slotach. Dla Container oraz Text może jawnie wybrać natywny prymityw.
2. JEV wybiera sizing, właściwości BOOLEAN/TEXT/INSTANCE_SWAP, docelowe warstwy tekstowe i slot. Dla natywnego kontenera wybiera kierunek i wyrównanie; dla tekstu treść i rozmiar fontu. Definicje właściwości dotyczą tylko wybranych komponentów. Wariant został już wybrany jako konkretny wpis katalogu.

Backend składa resolved tree z tej samej hierarchii. Nie pyta o liczbę dzieci, następny element ani spełnione wymagania. Stary planner zachowano w `server/legacy-planner.mjs` wyłącznie jako referencję dla dawnych testów; aktywny endpoint go nie importuje. Brak integracji z GPT.

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

Terminal backendu pokazuje `INPUT TREE`, `REQUIRED COMPONENTS`, `JEV REQUEST`, `JEV RESPONSE`, `RESOLVED TREE`. Konsola wtyczki pokazuje `RENDER RESULT` z powodzeniem lub błędem. Panel „Resolved tree / wynik edycji” pokazuje odpowiedź backendu. Pełne żądania i odpowiedzi klienta trafiają też jako JSONL do `logs/defapi.log`.

`npm test`, `npm run typecheck`, `npm run build`.

Testy obejmują parser, hierarchię i ilości, reuse decyzji, mapowanie intencji przez JEV, edycje oraz compact tree → resolver → renderer z atrapą Figmy i JEV. Nie wykonują płatnych zapytań. Jakość mapowania rzeczywistej biblioteki i działanie slotów wymagają próby we wtyczce z prawdziwym JEV.

Backend nasłuchuje na `127.0.0.1:3847` i wymaga tokenu parowania. Klucze DefAPI i REST Figmy pozostają w `.env`. Token lokalnego serwera i URL biblioteki zapamiętuje `figma.clientStorage`; usuwa je „Zapomnij zapisane dane”. Do DefAPI trafiają struktura, katalog i kontekst edycji. Logi zawierają te dane, bez nagłówków autoryzacji. Snapshot nie ma limitu liczby warstw. Pozostają limity: katalog 180 wariantów, żądanie HTTP 500 kB, planowanie 180 sekund, wywołanie JEV 30 sekund. Brak automatycznych ponowień płatnych żądań.
