# FigmaJev — dokumentacja struktury UI

Biblioteka: "Biblioteka iCotPXnNLa5DV1OsJEgsio"
Liczba komponentów: 21. Liczba dostępnych wpisów biblioteki (łącznie z wariantami): 126.

## Jak przygotować strukturę

GPT określa kompletną hierarchię UI. JEV wybiera komponenty i warianty z poniższej biblioteki. Renderer wykonuje strukturę. Nie używamy GPT API we wtyczce: użytkownik kopiuje wynik rozmowy do pola „Struktura projektu”.

- Node: ["Nazwa komponentu", {"property":"wartość"}, ...dzieci]. Obiekt properties jest opcjonalny. Jeden korzeń.
- Używaj nazw z listy, ewentualnie nazwy rodziny przed ukośnikiem (np. Button). Nie wymyślaj komponentów ani wariantów.
- Każdy wpis tworzy osobną instancję. Zachowaj kolejność i liczbę dzieci. Nie dodawaj technicznego wrappera FigmaJev.
- Dzieci umieszczaj w komponentach ze slotem Content. Preferuj Card jako otoczenie treści i Container do układania elementów.
- Wskazówki device, direction, type, weight, importance, purpose pomagają JEV wybrać wariant. Nie tworzą nowych właściwości ani zachowań, których nie ma w DS.
- text zawiera dosłowny tekst. Trafia do jednoznacznego Label/Text, jedynej właściwości TEXT lub jednoznacznej warstwy tekstowej. Przy kilku polach podaj dokładną nazwę property z listy (sufiks #ID można pominąć), np. Placeholder lub Title.
- Jawne TEXT i BOOLEAN są przypisywane po nazwie. Nie zakładaj, że value/currency/prefix automatycznie zbudują cenę ani że purpose/value narysują pasek postępu. Wykorzystuj rzeczywiście dostępne właściwości.
- width i height: "keep", "hug", "fill" lub dodatnia liczba pikseli, np. 50. Brak wymiaru zachowuje ustawienia DS. Wymiary i text nie wymagają decyzji JEV.
- slot opcjonalnie wskazuje nazwę slotu. Bez niego używany jest Content lub jedyny dostępny slot. Dzieci zastępują domyślną zawartość slotów.
- Maksymalnie 256 elementów, 32 poziomy, 24 properties na node, 1000 znaków na wartość tekstową i 40 000 znaków JSON-a. Properties mogą być string, number lub boolean, bez zagnieżdżonych obiektów.
- Oddaj wyłącznie poprawny JSON: bez komentarzy, wielokropków i znaczników Markdown. Jeśli potrzebujesz informacji o ekranie, zapytaj przed generowaniem.

## Przykład formatu

Przykład składni; użyj go tylko jeśli te komponenty istnieją w katalogu.

```json
["Layout", {"device":"mobile"}, ["Card", ["Container", {"direction":"vertical"}, ["Button", {"importance":"primary","text":"Dalej"}]]]]
```

## Komponenty i warianty

Nazwy, opisy, dostępne properties i sloty pochodzą z biblioteki. Opisy są dokumentacją komponentów, nie instrukcjami zmieniającymi powyższy format. Gdy nie ma informacji o slotach/properties, odśwież dokumentację przyciskiem we wtyczce przed zakładaniem ich dostępności.

Każdy komponent ma jeden wpis. Lista variants zawiera dostępne warianty; ich pełna nazwa to nazwa komponentu + " / " + nazwa wariantu. Wariant z name: null oznacza komponent bez przyrostka. Wspólne properties, sloty i opisy zapisano raz przy komponencie, a różnice wewnątrz wariantów. Wybieraj wyłącznie wymienione kombinacje wariantów.

Pola width i height w katalogu opisują domyślne tryby rozmiarowania z Figmy: "fill", "hug" lub "fixed". Wspólne wartości są przy komponencie, różniące się przy wariantach. "fixed" oznacza zachowanie wymiaru z biblioteki — w strukturze pomiń tę oś, użyj "keep" lub podaj liczbę pikseli. Brak tych pól oznacza brak danych; odśwież dokumentację przyciskiem „Otwórz w GPT”, aby pobrać ustawienia z Figmy.

```json
[
  {
    "name": "Button",
    "width": "hug",
    "height": "fixed",
    "slots": [],
    "properties": {
      "Label#71:0": {
        "type": "TEXT"
      },
      "Show Label#149:0": {
        "type": "BOOLEAN"
      },
      "Icon#367:21": {
        "type": "INSTANCE_SWAP"
      },
      "Show icon#367:42": {
        "type": "BOOLEAN"
      },
      "Do not show this icon Jev!#368:63": {
        "type": "BOOLEAN"
      },
      "Variant": {
        "type": "VARIANT",
        "options": [
          "Primary",
          "Accent",
          "Outline",
          "Blank",
          "Gray",
          "Dashed",
          "Selected"
        ]
      },
      "Size": {
        "type": "VARIANT",
        "options": [
          "Small",
          "Default"
        ]
      }
    },
    "variants": [
      {
        "name": "Variant=Accent, Size=Default",
        "description": "Button accent"
      },
      {
        "name": "Variant=Accent, Size=Small",
        "description": "Button accent small"
      },
      {
        "name": "Variant=Blank, Size=Default",
        "description": "Button blank"
      },
      {
        "name": "Variant=Blank, Size=Small",
        "description": "Button blank small"
      },
      {
        "name": "Variant=Dashed, Size=Default",
        "description": "Button outline"
      },
      {
        "name": "Variant=Dashed, Size=Small",
        "description": "Button outline small"
      },
      {
        "name": "Variant=Gray, Size=Default",
        "description": "Button gray"
      },
      {
        "name": "Variant=Gray, Size=Small",
        "description": "Button gray small"
      },
      {
        "name": "Variant=Outline, Size=Default",
        "description": "Button outline"
      },
      {
        "name": "Variant=Outline, Size=Small",
        "description": "Button outline small"
      },
      {
        "name": "Variant=Primary, Size=Default",
        "description": "Przycisk akcji\nZazwyczaj pokazujemy jedną ikonę"
      },
      {
        "name": "Variant=Primary, Size=Small",
        "description": "Przycisk akcji\nZazwyczaj pokazujemy jedną ikonę"
      },
      {
        "name": "Variant=Selected, Size=Default",
        "description": "Button outline"
      },
      {
        "name": "Variant=Selected, Size=Small",
        "description": "Button outline small"
      }
    ]
  },
  {
    "name": "Card",
    "description": "'Card' jest ramą każdego nowego komponentu\nUstaw szerokość na fill\nUstaw wysokość na hug",
    "width": "fill",
    "height": "hug",
    "slots": [
      {
        "name": "Content"
      }
    ],
    "properties": {
      "Content#102:0": {
        "type": "SLOT"
      },
      "Style": {
        "type": "VARIANT",
        "options": [
          "White",
          "Outlined",
          "Gray",
          "Border bottom"
        ]
      }
    },
    "variants": [
      {
        "name": "Style=Border bottom"
      },
      {
        "name": "Style=Gray"
      },
      {
        "name": "Style=Outlined"
      },
      {
        "name": "Style=White"
      }
    ]
  },
  {
    "name": "Ceneo Header",
    "description": "",
    "height": "hug",
    "slots": [],
    "properties": {
      "Property 1": {
        "type": "VARIANT",
        "options": [
          "Desktop",
          "Mobile"
        ]
      }
    },
    "variants": [
      {
        "name": "Property 1=Desktop",
        "width": "fill"
      },
      {
        "name": "Property 1=Mobile",
        "width": "fixed"
      }
    ]
  },
  {
    "name": "Checkbox",
    "description": "",
    "width": "hug",
    "slots": [],
    "properties": {
      "Text#2:0": {
        "type": "TEXT"
      },
      "Property 1": {
        "type": "VARIANT",
        "options": [
          "Default",
          "Checked"
        ]
      }
    },
    "variants": [
      {
        "name": "Property 1=Checked",
        "height": "hug"
      },
      {
        "name": "Property 1=Default",
        "height": "fixed"
      }
    ]
  },
  {
    "name": "Container",
    "description": "'Container' układa elementy w pionie lub poziomie\nKontener powinien być umieszczony wewnątrz 'Card'\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
    "width": "fill",
    "height": "hug",
    "slots": [
      {
        "name": "Content"
      }
    ],
    "properties": {
      "Content#316:0": {
        "type": "SLOT"
      },
      "Direction": {
        "type": "VARIANT",
        "options": [
          "Horizontal",
          "Vertical"
        ]
      }
    },
    "variants": [
      {
        "name": "Direction=Horizontal"
      },
      {
        "name": "Direction=Vertical"
      }
    ]
  },
  {
    "name": "Icon",
    "description": "",
    "width": "fixed",
    "height": "fixed",
    "slots": [],
    "properties": {
      "Icon#158:3": {
        "type": "INSTANCE_SWAP"
      }
    }
  },
  {
    "name": "Icons",
    "description": "",
    "slots": [],
    "properties": {},
    "variants": [
      {
        "name": "Alarm",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Angle down",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Angle right",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Arrow",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Box",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Campain",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Cards",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Cart empty",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Cart fill",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Cart plus",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Chart",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Check",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Comment",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Compare",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Contact",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Contact phone",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Delivery",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Filtr",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Handshake",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Heart",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Incognito",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Loader",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "minus",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "More",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Note",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Plus",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Price down",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Ranking",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Recycle",
        "width": "fixed",
        "height": "fixed"
      },
      {
        "name": "Search",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Search alt",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Search check",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Search plus",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Send",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Set",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Setting",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Sort",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Star",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Thumb",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "Trash",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "User",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "VS",
        "width": "fill",
        "height": "fill"
      },
      {
        "name": "ZO",
        "width": "fill",
        "height": "fill"
      }
    ]
  },
  {
    "name": "Input - text",
    "description": "Input text",
    "width": "fixed",
    "height": "fixed",
    "slots": [],
    "properties": {
      "Label#69:0": {
        "type": "TEXT"
      }
    }
  },
  {
    "name": "Label",
    "description": "",
    "width": "hug",
    "height": "fixed",
    "slots": [],
    "properties": {
      "Show Icon#85:0": {
        "type": "BOOLEAN"
      },
      "Icon#85:3": {
        "type": "INSTANCE_SWAP"
      },
      "Show Label#228:0": {
        "type": "BOOLEAN"
      },
      "Label#272:0": {
        "type": "TEXT"
      },
      "Color": {
        "type": "VARIANT",
        "options": [
          "Primary"
        ]
      },
      "Style": {
        "type": "VARIANT",
        "options": [
          "Filled",
          "Plain"
        ]
      }
    },
    "variants": [
      {
        "name": "Color=Primary, Style=Filled"
      },
      {
        "name": "Color=Primary, Style=Plain"
      }
    ]
  },
  {
    "name": "Layout",
    "description": "'Layout' ustala szerokość desktop / mobile\nStruktura widoku:Layout → Card → Container → content elements.\nNie zmieniaj szerokości 'Layout'",
    "width": "fixed",
    "height": "hug",
    "slots": [
      {
        "name": "Content"
      }
    ],
    "properties": {
      "Content#305:0": {
        "type": "SLOT"
      },
      "Property 1": {
        "type": "VARIANT",
        "options": [
          "Default",
          "Variant2"
        ]
      }
    },
    "variants": [
      {
        "name": "Property 1=Default"
      }
    ]
  },
  {
    "name": "Offer",
    "description": "",
    "width": "fill",
    "height": "hug",
    "slots": [],
    "properties": {
      "Property 1": {
        "type": "VARIANT",
        "options": [
          "Default"
        ]
      }
    },
    "variants": [
      {
        "name": "Property 1=Default"
      }
    ]
  },
  {
    "name": "Offer - compact",
    "description": "",
    "width": "hug",
    "height": "hug",
    "slots": [],
    "properties": {
      "Show expand button#455:8": {
        "type": "BOOLEAN"
      },
      "Show Company Label#455:10": {
        "type": "BOOLEAN"
      },
      "Show promotion#455:12": {
        "type": "BOOLEAN"
      },
      "Property 1": {
        "type": "VARIANT",
        "options": [
          "Default",
          "simple"
        ]
      }
    },
    "variants": [
      {
        "name": "Property 1=Default"
      },
      {
        "name": "Property 1=simple"
      }
    ]
  },
  {
    "name": "Photo",
    "description": "",
    "width": "fixed",
    "height": "fixed",
    "slots": [],
    "properties": {},
    "variants": [
      {
        "name": "Default"
      }
    ]
  },
  {
    "name": "Price",
    "description": "",
    "width": "hug",
    "height": "hug",
    "slots": [],
    "properties": {
      "Show Prefix#81:0": {
        "type": "BOOLEAN"
      }
    }
  },
  {
    "name": "Product",
    "description": "",
    "width": "fill",
    "height": "hug",
    "slots": [],
    "properties": {
      "Property 1": {
        "type": "VARIANT",
        "options": [
          "Vertical",
          "Horizontal",
          "Variant3"
        ]
      }
    },
    "variants": [
      {
        "name": "Property 1=Horizontal"
      },
      {
        "name": "Property 1=Variant3"
      },
      {
        "name": "Property 1=Vertical"
      }
    ]
  },
  {
    "name": "Radio",
    "description": "",
    "width": "hug",
    "height": "hug",
    "slots": [],
    "properties": {
      "Text#2:0": {
        "type": "TEXT"
      },
      "Property 1": {
        "type": "VARIANT",
        "options": [
          "Default",
          "Checked"
        ]
      }
    },
    "variants": [
      {
        "name": "Property 1=Checked"
      },
      {
        "name": "Property 1=Default"
      }
    ]
  },
  {
    "name": "Stars",
    "description": "",
    "width": "hug",
    "height": "hug",
    "slots": [],
    "properties": {
      "Property 1": {
        "type": "VARIANT",
        "options": [
          "Default",
          "Small",
          "Compact"
        ]
      }
    },
    "variants": [
      {
        "name": "Property 1=Compact"
      },
      {
        "name": "Property 1=Default"
      },
      {
        "name": "Property 1=Small"
      }
    ]
  },
  {
    "name": "Switch-alternative",
    "description": "",
    "width": "hug",
    "height": "hug",
    "slots": [],
    "properties": {
      "Text#2:0": {
        "type": "TEXT"
      },
      "Property 1": {
        "type": "VARIANT",
        "options": [
          "Default",
          "Checked"
        ]
      }
    },
    "variants": [
      {
        "name": "Property 1=Checked"
      },
      {
        "name": "Property 1=Default"
      }
    ]
  },
  {
    "name": "Table",
    "description": "",
    "width": "fixed",
    "height": "hug",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Text",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
    "width": "fill",
    "height": "hug",
    "slots": [],
    "properties": {
      "Content#73:0": {
        "type": "TEXT"
      },
      "Size": {
        "type": "VARIANT",
        "options": [
          "xs",
          "sm",
          "lg",
          "xl",
          "2xl",
          "3xl",
          "base"
        ]
      },
      "Weight": {
        "type": "VARIANT",
        "options": [
          "Normal",
          "Bold"
        ]
      }
    },
    "variants": [
      {
        "name": "Size=2xl, Weight=Bold"
      },
      {
        "name": "Size=2xl, Weight=Normal"
      },
      {
        "name": "Size=3xl, Weight=Bold"
      },
      {
        "name": "Size=3xl, Weight=Normal"
      },
      {
        "name": "Size=base, Weight=Bold"
      },
      {
        "name": "Size=base, Weight=Normal"
      },
      {
        "name": "Size=lg, Weight=Bold"
      },
      {
        "name": "Size=lg, Weight=Normal"
      },
      {
        "name": "Size=sm, Weight=Bold"
      },
      {
        "name": "Size=sm, Weight=Normal"
      },
      {
        "name": "Size=xl, Weight=Bold"
      },
      {
        "name": "Size=xl, Weight=Normal"
      },
      {
        "name": "Size=xs, Weight=Bold"
      },
      {
        "name": "Size=xs, Weight=Normal"
      }
    ]
  },
  {
    "name": "UI Elements",
    "description": "",
    "slots": [],
    "variants": [
      {
        "name": "Assistant Avatar",
        "width": "fixed",
        "height": "fixed",
        "properties": {}
      },
      {
        "name": "Badge=Handshake",
        "width": "fixed",
        "height": "fixed",
        "properties": {
          "Badge": {
            "type": "VARIANT",
            "options": [
              "ZO",
              "Handshake",
              "Ranking",
              "ZO ext",
              "Ranking ext",
              "Handshake ex"
            ]
          }
        }
      },
      {
        "name": "Badge=Handshake ex",
        "width": "hug",
        "height": "hug",
        "properties": {
          "Badge": {
            "type": "VARIANT",
            "options": [
              "ZO",
              "Handshake",
              "Ranking",
              "ZO ext",
              "Ranking ext",
              "Handshake ex"
            ]
          }
        }
      },
      {
        "name": "Badge=Ranking",
        "width": "fixed",
        "height": "fixed",
        "properties": {
          "Badge": {
            "type": "VARIANT",
            "options": [
              "ZO",
              "Handshake",
              "Ranking",
              "ZO ext",
              "Ranking ext",
              "Handshake ex"
            ]
          }
        }
      },
      {
        "name": "Badge=Ranking ext",
        "width": "hug",
        "height": "hug",
        "properties": {
          "Badge": {
            "type": "VARIANT",
            "options": [
              "ZO",
              "Handshake",
              "Ranking",
              "ZO ext",
              "Ranking ext",
              "Handshake ex"
            ]
          }
        }
      },
      {
        "name": "Badge=ZO",
        "width": "fixed",
        "height": "fixed",
        "properties": {
          "Badge": {
            "type": "VARIANT",
            "options": [
              "ZO",
              "Handshake",
              "Ranking",
              "ZO ext",
              "Ranking ext",
              "Handshake ex"
            ]
          }
        }
      },
      {
        "name": "Badge=ZO ext",
        "width": "hug",
        "height": "hug",
        "properties": {
          "Badge": {
            "type": "VARIANT",
            "options": [
              "ZO",
              "Handshake",
              "Ranking",
              "ZO ext",
              "Ranking ext",
              "Handshake ex"
            ]
          }
        }
      },
      {
        "name": "Energy label",
        "width": "hug",
        "height": "hug",
        "properties": {}
      },
      {
        "name": "Property 1=Ceneo",
        "width": "fixed",
        "height": "fixed",
        "properties": {
          "Property 1": {
            "type": "VARIANT",
            "options": [
              "Ceneo",
              "Zaufane Opinie"
            ]
          }
        }
      },
      {
        "name": "Property 1=Zaufane Opinie",
        "width": "hug",
        "height": "hug",
        "properties": {
          "Property 1": {
            "type": "VARIANT",
            "options": [
              "Ceneo",
              "Zaufane Opinie"
            ]
          }
        }
      },
      {
        "name": "Shop logo=allegro",
        "width": "fixed",
        "height": "fixed",
        "properties": {
          "Shop logo": {
            "type": "VARIANT",
            "options": [
              "allegro",
              "best store",
              "media markt",
              "media expert",
              "morele",
              "deluxry",
              "partner"
            ]
          }
        }
      },
      {
        "name": "Shop logo=best store",
        "width": "fixed",
        "height": "fixed",
        "properties": {
          "Shop logo": {
            "type": "VARIANT",
            "options": [
              "allegro",
              "best store",
              "media markt",
              "media expert",
              "morele",
              "deluxry",
              "partner"
            ]
          }
        }
      },
      {
        "name": "Shop logo=deluxry",
        "width": "fixed",
        "height": "fixed",
        "properties": {
          "Shop logo": {
            "type": "VARIANT",
            "options": [
              "allegro",
              "best store",
              "media markt",
              "media expert",
              "morele",
              "deluxry",
              "partner"
            ]
          }
        }
      },
      {
        "name": "Shop logo=media expert",
        "width": "fixed",
        "height": "fixed",
        "properties": {
          "Shop logo": {
            "type": "VARIANT",
            "options": [
              "allegro",
              "best store",
              "media markt",
              "media expert",
              "morele",
              "deluxry",
              "partner"
            ]
          }
        }
      },
      {
        "name": "Shop logo=media markt",
        "width": "fixed",
        "height": "fixed",
        "properties": {
          "Shop logo": {
            "type": "VARIANT",
            "options": [
              "allegro",
              "best store",
              "media markt",
              "media expert",
              "morele",
              "deluxry",
              "partner"
            ]
          }
        }
      },
      {
        "name": "Shop logo=morele",
        "width": "fixed",
        "height": "fixed",
        "properties": {
          "Shop logo": {
            "type": "VARIANT",
            "options": [
              "allegro",
              "best store",
              "media markt",
              "media expert",
              "morele",
              "deluxry",
              "partner"
            ]
          }
        }
      },
      {
        "name": "Shop logo=partner",
        "width": "fixed",
        "height": "hug",
        "properties": {
          "Shop logo": {
            "type": "VARIANT",
            "options": [
              "allegro",
              "best store",
              "media markt",
              "media expert",
              "morele",
              "deluxry",
              "partner"
            ]
          }
        }
      },
      {
        "name": "Shop promotion=Darmowa wysyłka",
        "width": "hug",
        "height": "hug",
        "properties": {
          "Shop promotion": {
            "type": "VARIANT",
            "options": [
              "Darmowa wysyłka",
              "Wysyłka w 1 dzień",
              "Promo tekst",
              "Kupione ostatnio",
              "Deposit",
              "Discount",
              "Shop promotion7"
            ]
          }
        }
      },
      {
        "name": "Shop promotion=Deposit",
        "width": "hug",
        "height": "hug",
        "properties": {
          "Shop promotion": {
            "type": "VARIANT",
            "options": [
              "Darmowa wysyłka",
              "Wysyłka w 1 dzień",
              "Promo tekst",
              "Kupione ostatnio",
              "Deposit",
              "Discount",
              "Shop promotion7"
            ]
          }
        }
      },
      {
        "name": "Shop promotion=Discount",
        "width": "hug",
        "height": "hug",
        "properties": {
          "Shop promotion": {
            "type": "VARIANT",
            "options": [
              "Darmowa wysyłka",
              "Wysyłka w 1 dzień",
              "Promo tekst",
              "Kupione ostatnio",
              "Deposit",
              "Discount",
              "Shop promotion7"
            ]
          }
        }
      },
      {
        "name": "Shop promotion=Kupione ostatnio",
        "width": "hug",
        "height": "hug",
        "properties": {
          "Shop promotion": {
            "type": "VARIANT",
            "options": [
              "Darmowa wysyłka",
              "Wysyłka w 1 dzień",
              "Promo tekst",
              "Kupione ostatnio",
              "Deposit",
              "Discount",
              "Shop promotion7"
            ]
          }
        }
      },
      {
        "name": "Shop promotion=Promo tekst",
        "width": "hug",
        "height": "hug",
        "properties": {
          "Shop promotion": {
            "type": "VARIANT",
            "options": [
              "Darmowa wysyłka",
              "Wysyłka w 1 dzień",
              "Promo tekst",
              "Kupione ostatnio",
              "Deposit",
              "Discount",
              "Shop promotion7"
            ]
          }
        }
      },
      {
        "name": "Shop promotion=Shop promotion7",
        "width": "hug",
        "height": "hug",
        "properties": {
          "Shop promotion": {
            "type": "VARIANT",
            "options": [
              "Darmowa wysyłka",
              "Wysyłka w 1 dzień",
              "Promo tekst",
              "Kupione ostatnio",
              "Deposit",
              "Discount",
              "Shop promotion7"
            ]
          }
        }
      },
      {
        "name": "Shop promotion=Wysyłka w 1 dzień",
        "width": "hug",
        "height": "hug",
        "properties": {
          "Shop promotion": {
            "type": "VARIANT",
            "options": [
              "Darmowa wysyłka",
              "Wysyłka w 1 dzień",
              "Promo tekst",
              "Kupione ostatnio",
              "Deposit",
              "Discount",
              "Shop promotion7"
            ]
          }
        }
      }
    ]
  }
]
```
