// Erkennt aus einem Produktnamen das vergleichbare Produkt (Barren-Gewicht oder Philharmoniker-Größe).

const OZ = 31.1035;

export const PRODUCTS = [
  { key: 'bar-1', label: 'Goldbarren 1 g', group: 'Barren', grams: 1 },
  { key: 'bar-2', label: 'Goldbarren 2 g', group: 'Barren', grams: 2 },
  { key: 'bar-2.5', label: 'Goldbarren 2,5 g', group: 'Barren', grams: 2.5 },
  { key: 'bar-5', label: 'Goldbarren 5 g', group: 'Barren', grams: 5 },
  { key: 'bar-10', label: 'Goldbarren 10 g', group: 'Barren', grams: 10 },
  { key: 'bar-20', label: 'Goldbarren 20 g', group: 'Barren', grams: 20 },
  { key: 'bar-oz', label: 'Goldbarren 1 oz', group: 'Barren', grams: OZ },
  { key: 'bar-50', label: 'Goldbarren 50 g', group: 'Barren', grams: 50 },
  { key: 'bar-100', label: 'Goldbarren 100 g', group: 'Barren', grams: 100 },
  { key: 'bar-250', label: 'Goldbarren 250 g', group: 'Barren', grams: 250 },
  { key: 'bar-500', label: 'Goldbarren 500 g', group: 'Barren', grams: 500 },
  { key: 'bar-1000', label: 'Goldbarren 1000 g', group: 'Barren', grams: 1000 },
  { key: 'phil-1', label: 'Philharmoniker 1 oz', group: 'Münzen', grams: OZ },
  { key: 'phil-1/2', label: 'Philharmoniker 1/2 oz', group: 'Münzen', grams: OZ / 2 },
  { key: 'phil-1/4', label: 'Philharmoniker 1/4 oz', group: 'Münzen', grams: OZ / 4 },
  { key: 'phil-1/10', label: 'Philharmoniker 1/10 oz', group: 'Münzen', grams: OZ / 10 },
  { key: 'phil-1/25', label: 'Philharmoniker 1/25 oz', group: 'Münzen', grams: OZ / 25 },
  { key: 'fine-1g', label: 'Feingold (pro g)', group: 'Feingold', grams: 1 },
];

const NOT_GOLD = /silber|silver|platin|palladium|rhodium|kupfer/i;
// Sonderausgaben, Sammlerstücke und Sets verzerren den Vergleich.
const SPECIAL = /\bats\b|schilling|proof|polierte platte|\bpp\b|jubil|sonder|set\b|satz|\d+\s*x\s*\d|tafel|combi|minted\s*sets?|geschenk|etui|jahrgang\s*\d{4}\s*-/i;

export function matchProduct(name) {
  const n = name.replace(/\s+/g, ' ').trim();
  if (!n || NOT_GOLD.test(n) || SPECIAL.test(n)) return null;

  if (/philharmoniker/i.test(n)) {
    const frac = n.match(/\b1\s*\/\s*(2|4|10|25)\b/);
    if (frac) return `phil-1/${frac[1]}`;
    if (/\b1\s*(oz|unze)/i.test(n) || !/\d+\s*(g|oz|unze)/i.test(n)) return 'phil-1';
    return null;
  }

  if (/feingold|999/i.test(n) && !/barren|\d+(?:[.,]\d+)?\s*(kg|g|gr|gramm|oz)\b/i.test(n)) return 'fine-1g';

  if (/barren|bar\b|feingold|gold\s*\d/i.test(n)) {
    if (/\b1\s*(oz|unze)\b/i.test(n)) return 'bar-oz';
    const m = n.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gramm)\b/i);
    if (!m) return null;
    // "1.000 g" ist tausend Gramm, "2,5 g" zweieinhalb.
    let grams = parseFloat(/^\d{1,3}\.\d{3}$/.test(m[1]) ? m[1].replace('.', '') : m[1].replace(',', '.'));
    if (/kg/i.test(m[2])) grams *= 1000;
    const p = PRODUCTS.find((x) => x.group === 'Barren' && Math.abs(x.grams - grams) < 0.01);
    return p ? p.key : null;
  }
  return null;
}

// "119.830,00 €" -> 119830
export function parseEuros(text) {
  const out = [];
  const re = /(\d{1,3}(?:[.\s  ]\d{3})*,\d{2}|\d+,\d{2})/g;
  let m;
  while ((m = re.exec(text))) {
    const v = parseFloat(m[1].replace(/[.\s  ]/g, '').replace(',', '.'));
    if (v > 0) out.push(v);
  }
  return out;
}

// Grobe Plausibilitätsprüfung: Gold kostet je nach Stückelung etwa 60 bis 260 € pro Gramm.
export function plausible(key, price) {
  const p = PRODUCTS.find((x) => x.key === key);
  if (!p) return false;
  const perGram = price / p.grams;
  return perGram > 60 && perGram < 260;
}
