# FigmaJev — dokumentacja struktury UI

Biblioteka: "Biblioteka iCotPXnNLa5DV1OsJEgsio"
Liczba komponentów i wariantów: 124.

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

```json
[
  {
    "name": "Button / Variant=Accent, Size=Default",
    "description": "Button accent",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Button / Variant=Accent, Size=Small",
    "description": "Button accent small",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Button / Variant=Blank, Size=Default",
    "description": "Button blank",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Button / Variant=Blank, Size=Small",
    "description": "Button blank small",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Button / Variant=Dashed, Size=Default",
    "description": "Button outline",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Button / Variant=Dashed, Size=Small",
    "description": "Button outline small",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Button / Variant=Gray, Size=Default",
    "description": "Button gray",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Button / Variant=Gray, Size=Small",
    "description": "Button gray small",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Button / Variant=Outline, Size=Default",
    "description": "Button outline",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Button / Variant=Outline, Size=Small",
    "description": "Button outline small",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Button / Variant=Primary, Size=Default",
    "description": "Przycisk akcji\nZazwyczaj pokazujemy jedną ikonę",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Button / Variant=Primary, Size=Small",
    "description": "Przycisk akcji\nZazwyczaj pokazujemy jedną ikonę",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Button / Variant=Selected, Size=Default",
    "description": "Button outline",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Button / Variant=Selected, Size=Small",
    "description": "Button outline small",
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
    "textLayers": [
      "Button text"
    ]
  },
  {
    "name": "Card / Style=Border bottom",
    "description": "'Card' jest ramą każdego nowego komponentu\nNie umieszczaj 'Card' wewnątrz inneog 'Card'\nUstaw szerokość na fill\nUstaw wysokość na hug",
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
    }
  },
  {
    "name": "Card / Style=Gray",
    "description": "'Card' jest ramą każdego nowego komponentu\nNie umieszczaj 'Card' wewnątrz inneog 'Card'\nUstaw szerokość na fill\nUstaw wysokość na hug",
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
    }
  },
  {
    "name": "Card / Style=Outlined",
    "description": "'Card' jest ramą każdego nowego komponentu\nNie umieszczaj 'Card' wewnątrz inneog 'Card'\nUstaw szerokość na fill\nUstaw wysokość na hug",
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
    }
  },
  {
    "name": "Card / Style=White",
    "description": "'Card' jest ramą każdego nowego komponentu\nNie umieszczaj 'Card' wewnątrz inneog 'Card'\nUstaw szerokość na fill\nUstaw wysokość na hug",
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
    }
  },
  {
    "name": "Ceneo Header / Property 1=Desktop",
    "description": "",
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
    "textLayers": [
      "Label",
      "Button text"
    ]
  },
  {
    "name": "Ceneo Header / Property 1=Mobile",
    "description": "",
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
    "textLayers": [
      "Label",
      "Button text"
    ]
  },
  {
    "name": "Checkbox / Property 1=Checked",
    "description": "",
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
    "textLayers": [
      "checkbox"
    ]
  },
  {
    "name": "Checkbox / Property 1=Default",
    "description": "",
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
    "textLayers": [
      "checkbox"
    ]
  },
  {
    "name": "Container / Direction=Horizontal",
    "description": "'Container' układa elementy w pionie lub poziomie\nKontener powinien być umieszczony wewnątrz 'Card'\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    }
  },
  {
    "name": "Container / Direction=Vertical",
    "description": "'Container' układa elementy w pionie lub poziomie\nKontener powinien być umieszczony wewnątrz 'Card'\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    }
  },
  {
    "name": "Icon",
    "description": "",
    "slots": [],
    "properties": {
      "Icon#158:3": {
        "type": "INSTANCE_SWAP"
      }
    }
  },
  {
    "name": "Icons / Alarm",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Angle down",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Angle right",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Arrow",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Box",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Campain",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Cards",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Cart empty",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Cart fill",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Cart plus",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Chart",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Check",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Comment",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Compare",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Contact",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Contact phone",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Delivery",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Filtr",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Handshake",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Heart",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Incognito",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Loader",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / minus",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / More",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Note",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Plus",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Price down",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Ranking",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Recycle",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Search",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Search alt",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Search check",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Search plus",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Send",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Set",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Setting",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Sort",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Star",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Thumb",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / Trash",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / User",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / VS",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Icons / ZO",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Input - text",
    "description": "Input text",
    "slots": [],
    "properties": {
      "Label#69:0": {
        "type": "TEXT"
      }
    },
    "textLayers": [
      "Label"
    ]
  },
  {
    "name": "Label / Color=Primary, Style=Filled",
    "description": "",
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
    "textLayers": [
      "Label"
    ]
  },
  {
    "name": "Label / Color=Primary, Style=Plain",
    "description": "",
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
    "textLayers": [
      "Label"
    ]
  },
  {
    "name": "Layout / Device=Desktop",
    "description": "'Layout' ustala szerokość desktop / mobile\nStruktura widoku:Layout → Card → Container → content elements.\nNie zmieniaj szerokości 'Layout'",
    "slots": [
      {
        "name": "Content"
      }
    ],
    "properties": {
      "Content#305:0": {
        "type": "SLOT"
      },
      "Device": {
        "type": "VARIANT",
        "options": [
          "Desktop",
          "Mobile"
        ]
      }
    }
  },
  {
    "name": "Layout / Device=Mobile",
    "description": "'Layout' ustala szerokość desktop / mobile\nStruktura widoku:Layout → Card → Container → content elements.\nNie zmieniaj szerokości 'Layout'",
    "slots": [
      {
        "name": "Content"
      }
    ],
    "properties": {
      "Content#305:0": {
        "type": "SLOT"
      },
      "Device": {
        "type": "VARIANT",
        "options": [
          "Desktop",
          "Mobile"
        ]
      }
    }
  },
  {
    "name": "Offer - compact / Property 1=Default",
    "description": "",
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
          "Default"
        ]
      }
    },
    "textLayers": [
      "Button text",
      "Text",
      "Text",
      "Text",
      "Text",
      "Label",
      "Prefix",
      "Price",
      "Sufix",
      "Label",
      "Label",
      "Label",
      "Text",
      "Label",
      "Button text",
      "Button text",
      "Button text",
      "Button text"
    ]
  },
  {
    "name": "Offer / Property 1=Default",
    "description": "",
    "slots": [],
    "properties": {
      "Property 1": {
        "type": "VARIANT",
        "options": [
          "Default"
        ]
      }
    },
    "textLayers": [
      "Button text",
      "Text",
      "Text",
      "Text",
      "Text",
      "Text",
      "Label",
      "Prefix",
      "Price",
      "Sufix",
      "Label",
      "Label",
      "Label",
      "Button text",
      "Button text"
    ]
  },
  {
    "name": "Photo/Default",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "Price",
    "description": "",
    "slots": [],
    "properties": {
      "Show Prefix#81:0": {
        "type": "BOOLEAN"
      }
    },
    "textLayers": [
      "Prefix",
      "Price",
      "Sufix"
    ]
  },
  {
    "name": "Product / Property 1=Horizontal",
    "description": "",
    "slots": [],
    "properties": {
      "Property 1": {
        "type": "VARIANT",
        "options": [
          "Vertical",
          "Horizontal"
        ]
      }
    },
    "textLayers": [
      "Label",
      "Text",
      "Prefix",
      "Price",
      "Sufix",
      "Label",
      "Label",
      "Text",
      "Text",
      "Text",
      "Text"
    ]
  },
  {
    "name": "Product / Property 1=Vertical",
    "description": "",
    "slots": [],
    "properties": {
      "Property 1": {
        "type": "VARIANT",
        "options": [
          "Vertical",
          "Horizontal"
        ]
      }
    },
    "textLayers": [
      "Label",
      "Prefix",
      "Price",
      "Sufix",
      "Label",
      "Label",
      "Text",
      "Text",
      "Text",
      "Text",
      "Text"
    ]
  },
  {
    "name": "Radio / Property 1=Checked",
    "description": "",
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
    "textLayers": [
      "radio button"
    ]
  },
  {
    "name": "Radio / Property 1=Default",
    "description": "",
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
    "textLayers": [
      "radio button"
    ]
  },
  {
    "name": "Stars / Property 1=Compact",
    "description": "",
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
    "textLayers": [
      "Text",
      "Text"
    ]
  },
  {
    "name": "Stars / Property 1=Default",
    "description": "",
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
    "textLayers": [
      "Text",
      "Text"
    ]
  },
  {
    "name": "Stars / Property 1=Small",
    "description": "",
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
    "textLayers": [
      "Text",
      "Text"
    ]
  },
  {
    "name": "Switch-alternative / Property 1=Checked",
    "description": "",
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
    "textLayers": [
      "Switch"
    ]
  },
  {
    "name": "Switch-alternative / Property 1=Default",
    "description": "",
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
    "textLayers": [
      "Switch"
    ]
  },
  {
    "name": "Table",
    "description": "",
    "slots": [],
    "properties": {},
    "textLayers": [
      "Text",
      "Text"
    ]
  },
  {
    "name": "Text / Size=2xl, Weight=Bold",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "Text / Size=2xl, Weight=Normal",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "Text / Size=3xl, Weight=Bold",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "Text / Size=3xl, Weight=Normal",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "Text / Size=base, Weight=Bold",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "Text / Size=base, Weight=Normal",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "Text / Size=lg, Weight=Bold",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "Text / Size=lg, Weight=Normal",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "Text / Size=sm, Weight=Bold",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "Text / Size=sm, Weight=Normal",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "Text / Size=xl, Weight=Bold",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "Text / Size=xl, Weight=Normal",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "Text / Size=xs, Weight=Bold",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "Text / Size=xs, Weight=Normal",
    "description": "Użyj 'sm' dla zwykłego tekstu\nUżyj 'lg' / 'bold' dla nagłówków\nUstaw szerokość na 'fill'\nUstaw wysokość na 'hug'",
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
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "UI Elements / Assistant Avatar",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "UI Elements / Badge=Handshake",
    "description": "",
    "slots": [],
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
    "name": "UI Elements / Badge=Handshake ex",
    "description": "",
    "slots": [],
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
    },
    "textLayers": [
      "Dbam o klienta"
    ]
  },
  {
    "name": "UI Elements / Badge=Ranking",
    "description": "",
    "slots": [],
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
    "name": "UI Elements / Badge=Ranking ext",
    "description": "",
    "slots": [],
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
    },
    "textLayers": [
      "Sklep Roku"
    ]
  },
  {
    "name": "UI Elements / Badge=ZO",
    "description": "",
    "slots": [],
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
    "name": "UI Elements / Badge=ZO ext",
    "description": "",
    "slots": [],
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
    },
    "textLayers": [
      "Zaufane Opinie"
    ]
  },
  {
    "name": "UI Elements / Ceneo Logo",
    "description": "",
    "slots": [],
    "properties": {}
  },
  {
    "name": "UI Elements / Energy label",
    "description": "",
    "slots": [],
    "properties": {},
    "textLayers": [
      "Text"
    ]
  },
  {
    "name": "UI Elements / Shop logo=allegro",
    "description": "",
    "slots": [],
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
    "name": "UI Elements / Shop logo=best store",
    "description": "",
    "slots": [],
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
    "name": "UI Elements / Shop logo=deluxry",
    "description": "",
    "slots": [],
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
    "name": "UI Elements / Shop logo=media expert",
    "description": "",
    "slots": [],
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
    "name": "UI Elements / Shop logo=media markt",
    "description": "",
    "slots": [],
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
    "name": "UI Elements / Shop logo=morele",
    "description": "",
    "slots": [],
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
    "name": "UI Elements / Shop logo=partner",
    "description": "",
    "slots": [],
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
    "name": "UI Elements / Shop promotion=Darmowa wysyłka",
    "description": "",
    "slots": [],
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
    },
    "textLayers": [
      "Label"
    ]
  },
  {
    "name": "UI Elements / Shop promotion=Deposit",
    "description": "",
    "slots": [],
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
    },
    "textLayers": [
      "Label"
    ]
  },
  {
    "name": "UI Elements / Shop promotion=Discount",
    "description": "",
    "slots": [],
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
    },
    "textLayers": [
      "Label"
    ]
  },
  {
    "name": "UI Elements / Shop promotion=Kupione ostatnio",
    "description": "",
    "slots": [],
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
    },
    "textLayers": [
      "Label"
    ]
  },
  {
    "name": "UI Elements / Shop promotion=Promo tekst",
    "description": "",
    "slots": [],
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
    },
    "textLayers": [
      "Label"
    ]
  },
  {
    "name": "UI Elements / Shop promotion=Shop promotion7",
    "description": "",
    "slots": [],
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
    },
    "textLayers": [
      "Label"
    ]
  },
  {
    "name": "UI Elements / Shop promotion=Wysyłka w 1 dzień",
    "description": "",
    "slots": [],
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
    },
    "textLayers": [
      "Label"
    ]
  }
]
```
