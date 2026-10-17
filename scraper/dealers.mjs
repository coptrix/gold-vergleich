// Händler und ihre Preisseiten.
// single: was ein einzelner Preis in einer Zeile bedeutet ('buy' = du kaufst, 'sell' = du verkaufst).
// Zeilen mit zwei Preisen: der niedrigere ist immer der Ankauf (du verkaufst), der höhere der Verkauf (du kaufst).
// allowed: erst auf true setzen, wenn der Händler dem Abruf zugestimmt hat. Nur diese Händler werden abgerufen.

export const DEALERS = [
  {
    id: 'oegussa',
    name: 'Ögussa',
    address: 'Schwarzstraße 11, 5020 Salzburg',
    url: 'https://www.oegussa.at/de/charts/tageskurse',
    pages: ['https://www.oegussa.at/de/charts/tageskurse'],
    single: 'buy',
    allowed: false,
  },
  {
    id: 'philoro',
    name: 'philoro',
    address: 'Schallmooser Hauptstraße 18, 5020 Salzburg',
    url: 'https://philoro.at/preisliste/alle',
    pages: ['https://philoro.at/preisliste/alle'],
    single: 'buy',
    allowed: false,
  },
  {
    id: 'alpengold',
    name: 'Alpengold',
    address: 'Siezenheimer Straße 6A, 5020 Salzburg',
    url: 'https://www.alpen-gold.at/Gold/',
    pages: [
      'https://www.alpen-gold.at/Gold/',
      'https://www.alpen-gold-ankauf.at/preise/aktuelle-kurse',
    ],
    single: 'buy',
    // Auf der Ankauf-Seite bedeutet ein einzelner Preis "du verkaufst".
    singleByPage: { 'alpen-gold-ankauf.at': 'sell' },
    allowed: false,
  },
  {
    id: 'kornmesser',
    name: 'Kornmesser',
    address: 'Alpenstraße 48a, Salzburg · Salzburger Straße 7, Eugendorf',
    url: 'https://www.kornmesser-goldankauf.at/',
    pages: ['https://www.kornmesser-goldankauf.at/'],
    single: 'sell',
    note: 'kauft nur an',
    allowed: false,
  },
];
