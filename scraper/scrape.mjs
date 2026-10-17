// Holt die aktuellen Preise aller Händler und schreibt data/latest.json und data/history.json.
// Aufruf: node scraper/scrape.mjs [--dump]   (--dump speichert Seitentext in debug/ zur Fehlersuche)
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DEALERS } from './dealers.mjs';
import { PRODUCTS } from './products.mjs';
import { extractPrices, collectInPage } from './extract.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA = path.join(ROOT, 'site', 'data');
const DUMP = process.argv.includes('--dump');
const RECENT_DAYS = 3;

async function launch() {
  const executablePath = process.env.CHROME_PATH || undefined;
  return chromium.launch({ executablePath, channel: executablePath ? undefined : 'chrome' });
}

// Prüft, ob die robots.txt des Händlers den Abruf dieser Seite erlaubt.
async function robotsAllow(url) {
  const u = new URL(url);
  let text;
  try {
    const res = await fetch(`${u.origin}/robots.txt`, { signal: AbortSignal.timeout(15000) });
    if (res.status >= 400 && res.status < 500) return true;
    if (!res.ok) return false;
    text = await res.text();
  } catch {
    return false;
  }
  let applies = false;
  let longest = { len: -1, allow: true };
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const [field, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (/^user-agent$/i.test(field)) applies = value === '*';
    else if (applies && /^(dis)?allow$/i.test(field) && value && u.pathname.startsWith(value) && value.length > longest.len) {
      longest = { len: value.length, allow: /^allow$/i.test(field) };
    }
  }
  return longest.allow;
}

async function scrapeDealer(browser, dealer) {
  const products = {};
  const errors = [];
  for (const url of dealer.pages) {
    if (!(await robotsAllow(url))) {
      errors.push(`${url}: laut robots.txt nicht erlaubt`);
      continue;
    }
    const page = await browser.newPage({
      locale: 'de-AT',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const content = await page.evaluate(collectInPage);
      if (DUMP) {
        await fs.mkdir(path.join(ROOT, 'debug'), { recursive: true });
        const name = `${dealer.id}-${new URL(url).hostname}`;
        await fs.writeFile(path.join(ROOT, 'debug', `${name}.txt`), content.lines.join('\n'));
        await fs.writeFile(path.join(ROOT, 'debug', `${name}.rows.txt`), content.rows.join('\n'));
        await fs.writeFile(path.join(ROOT, 'debug', `${name}.html`), await page.content());
      }
      const host = new URL(url).hostname.replace(/^www\./, '');
      const single = dealer.singleByPage?.[host] || dealer.single;
      for (const [key, p] of Object.entries(extractPrices(content, single))) {
        const cur = products[key] || {};
        products[key] = {
          buy: cur.buy ?? p.buy ?? null,
          sell: cur.sell ?? p.sell ?? null,
        };
      }
    } catch (e) {
      errors.push(`${url}: ${e.message.split('\n')[0]}`);
    } finally {
      await page.close();
    }
  }
  return {
    id: dealer.id,
    name: dealer.name,
    address: dealer.address,
    url: dealer.url,
    note: dealer.note || null,
    ok: Object.keys(products).length > 0,
    error: errors.join('; ') || (Object.keys(products).length ? null : 'keine Preise gefunden'),
    products,
  };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function vienna(d) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vienna' }).format(d);
}

async function main() {
  if (!DEALERS.some((d) => d.allowed)) {
    console.log('Noch kein Händler freigegeben, es wird nichts abgerufen.');
    return;
  }
  const browser = await launch();
  const now = new Date();
  const previous = await readJson(path.join(DATA, 'latest.json'), { dealers: [] });
  const dealers = [];
  for (const d of DEALERS.filter((x) => x.allowed)) {
    const result = await scrapeDealer(browser, d);
    // Fällt ein Händler aus, bleiben seine letzten Preise mit altem Zeitstempel stehen.
    const old = previous.dealers.find((x) => x.id === d.id);
    if (!result.ok && old?.ok) {
      dealers.push({ ...old, stale: true, error: result.error });
    } else {
      dealers.push({ ...result, fetchedAt: now.toISOString() });
    }
    console.log(`${d.name}: ${Object.keys(result.products).length} Produkte${result.error ? ` (${result.error})` : ''}`);
  }
  await browser.close();

  const latest = { updated: now.toISOString(), products: PRODUCTS, dealers };
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(path.join(DATA, 'latest.json'), JSON.stringify(latest, null, 1));

  // Verlauf: alle Abrufe der letzten Tage, danach ein Wert pro Tag (der letzte des Tages).
  const history = await readJson(path.join(DATA, 'history.json'), { recent: [], daily: [] });
  const snap = { t: now.toISOString(), d: {} };
  for (const d of dealers) {
    if (!d.ok || d.stale) continue;
    snap.d[d.id] = Object.fromEntries(Object.entries(d.products).map(([k, p]) => [k, [p.buy, p.sell]]));
  }
  if (Object.keys(snap.d).length) {
    history.recent.push(snap);
    const today = vienna(now);
    history.daily = history.daily.filter((x) => x.date !== today);
    history.daily.push({ date: today, t: snap.t, d: snap.d });
  }
  const cutoff = now.getTime() - RECENT_DAYS * 864e5;
  history.recent = history.recent.filter((x) => new Date(x.t).getTime() >= cutoff);
  await fs.writeFile(path.join(DATA, 'history.json'), JSON.stringify(history));

  if (!dealers.some((d) => d.ok)) {
    console.error('Kein einziger Händler lieferte Preise.');
    process.exitCode = 1;
  }
}

main();
