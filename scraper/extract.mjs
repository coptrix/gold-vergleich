import { matchProduct, parseEuros, plausible } from './products.mjs';

// Zerlegt eine gerenderte Seite in Zeilen und sucht darin Produkte mit Preisen.
// rows: Tabellenzeilen (Zellen mit " | " verbunden); lines: sichtbarer Text Zeile für Zeile.
export function extractPrices({ rows, lines }, single) {
  const found = {};

  const take = (key, prices, name) => {
    const ok = prices.filter((p) => plausible(key, p));
    if (!ok.length) return;
    let buy = null;
    let sell = null;
    if (ok.length >= 2) {
      const [a, b] = ok.slice(0, 2);
      sell = Math.min(a, b);
      buy = Math.max(a, b);
    } else if (single === 'sell') sell = ok[0];
    else buy = ok[0];

    // Bei mehreren Herstellern gilt das günstigste Angebot bzw. der beste Ankauf.
    const cur = found[key] || { buy: null, sell: null };
    if (buy != null && (cur.buy == null || buy < cur.buy)) { cur.buy = buy; cur.buyName = name; }
    if (sell != null && (cur.sell == null || sell > cur.sell)) { cur.sell = sell; cur.sellName = name; }
    found[key] = cur;
  };

  // 1. Tabellen: Produktname und Preise stehen in derselben Zeile.
  for (const row of rows) {
    const cells = row.split(' | ');
    const name = cells.find((c) => matchProduct(c)) || row;
    const key = matchProduct(name);
    if (!key) continue;
    take(key, parseEuros(cells.filter((c) => c !== name).join(' ')), name.trim());
  }

  // 2. Karten/Listen: Preise folgen in den nächsten Zeilen nach dem Produktnamen.
  if (!Object.keys(found).length) {
    for (let i = 0; i < lines.length; i++) {
      const key = matchProduct(lines[i]);
      if (!key) continue;
      const prices = [...parseEuros(lines[i].replace(/^.*?(oz|unze|kg|g|gramm)\b/i, ''))];
      for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
        if (matchProduct(lines[j])) break;
        prices.push(...parseEuros(lines[j]));
        if (prices.length >= 2) break;
      }
      take(key, prices, lines[i].trim());
    }
  }
  return found;
}

// Läuft im Browser: sammelt Tabellenzeilen und sichtbaren Text.
export function collectInPage() {
  const rows = [...document.querySelectorAll('tr')].map((tr) =>
    [...tr.querySelectorAll('th,td')].map((c) => c.innerText.replace(/\s+/g, ' ').trim()).join(' | '),
  );
  const lines = document.body.innerText.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return { rows, lines };
}
