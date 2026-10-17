'use strict';

const OZ = 31.1035;
const COLORS = ['#c08a10', '#2f6fd6', '#1f9d6a', '#c2410c', '#8b5cf6', '#db2777'];
const state = {
  side: load('side', 'buy'),
  group: load('group', 'Barren'),
  chartKey: load('chartKey', 'spot'),
  days: Number(load('days', '30')),
  latest: null,
  history: null,
};
let chart = null;

const eur = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' });
const pct = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 1 });
const when = new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Vienna' });

function load(k, d) {
  try { return localStorage.getItem(k) ?? d; } catch { return d; }
}
function save(k, v) {
  try { localStorage.setItem(k, v); } catch {}
}
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function fetchData() {
  const bust = `?t=${Date.now()}`;
  const [latest, history] = await Promise.all([
    fetch(`data/latest.json${bust}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`data/history.json${bust}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  state.latest = latest;
  state.history = history || { recent: [], daily: [] };
}

// Goldpreis pro Unze: Mittel aus An- und Verkauf des 1-kg-Barrens, Median über alle Händler.
function spotFrom(dealerMap) {
  const vals = [];
  for (const products of Object.values(dealerMap)) {
    const p = products['bar-1000'];
    const buy = Array.isArray(p) ? p[0] : p?.buy;
    const sell = Array.isArray(p) ? p[1] : p?.sell;
    if (buy && sell) vals.push(((buy + sell) / 2 / 1000) * OZ);
  }
  if (!vals.length) return null;
  vals.sort((a, b) => a - b);
  const m = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
}

function render() {
  const L = state.latest;
  document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-checked', b.dataset.side === state.side));
  document.querySelectorAll('.controls .chips button').forEach((b) => b.setAttribute('aria-checked', b.dataset.group === state.group));

  if (!L) {
    $('#updated').textContent = 'Noch keine Preise vorhanden';
    $('#list').innerHTML = '<div class="card empty muted">Der erste Abruf läuft noch. Schau in ein paar Minuten wieder vorbei.</div>';
    renderChart();
    return;
  }
  $('#updated').textContent = `Stand ${when.format(new Date(L.updated))}`;

  const map = Object.fromEntries(L.dealers.filter((d) => d.ok).map((d) => [d.id, d.products]));
  const spot = spotFrom(map);
  const spotEl = $('#spot');
  spotEl.hidden = !spot;
  if (spot) {
    spotEl.innerHTML = `<div><div class="muted">Goldpreis pro Unze</div><strong>${eur.format(spot)}</strong></div>
      <div class="muted">${eur.format(spot / OZ)} pro Gramm</div>`;
  }

  const buying = state.side === 'buy';
  const cards = [];
  for (const prod of L.products.filter((p) => p.group === state.group)) {
    const entries = L.dealers
      .filter((d) => d.ok)
      .map((d) => ({ d, p: d.products[prod.key] }))
      .filter((e) => e.p && (e.p.buy || e.p.sell));
    if (!entries.length) continue;

    const val = (e) => (buying ? e.p.buy : e.p.sell);
    const withVal = entries.filter((e) => val(e));
    withVal.sort((a, b) => (buying ? val(a) - val(b) : val(b) - val(a)));
    const without = entries.filter((e) => !val(e));
    const best = withVal[0];
    const rows = [...withVal, ...without].map((e) => {
      const v = val(e);
      const other = buying ? e.p.sell : e.p.buy;
      const spread = e.p.buy && e.p.sell ? ((e.p.buy - e.p.sell) / e.p.buy) * 100 : null;
      const isBest = e === best && withVal.length > 1;
      const diff = v && best && e !== best ? ` · ${eur.format(Math.abs(v - val(best)))} ${buying ? 'teurer' : 'weniger'}` : '';
      return `<li class="${isBest ? 'best' : ''} ${v ? '' : 'none'}">
        <span class="dealer">${esc(e.d.name)}${isBest ? '<span class="badge">Bester</span>' : ''}</span>
        <span class="price">${v ? eur.format(v) : buying ? 'kein Verkauf' : 'kein Ankauf'}</span>
        <span class="sub"><span>${other ? `${buying ? 'Ankauf' : 'Verkauf'} ${eur.format(other)}` : ''}${diff}</span>
        <span>${spread != null ? `Spanne ${pct.format(spread)} %` : ''}${e.d.stale ? ' · veraltet' : ''}</span></span>
      </li>`;
    });
    if (!withVal.length) continue;
    cards.push(`<article class="product"><h3>${esc(prod.label)}<span class="muted">${eur.format(val(best) / prod.grams)}/g</span></h3>
      <ul class="rows">${rows.join('')}</ul></article>`);
  }
  $('#list').innerHTML = cards.length
    ? cards.join('')
    : `<div class="card empty muted">Für diese Auswahl hat gerade kein Händler Preise online.</div>`;

  renderDealers();
  renderChartSelect();
  renderChart();
}

function renderDealers() {
  $('#dealers').innerHTML = state.latest.dealers
    .map((d) => {
      const n = Object.keys(d.products || {}).length;
      const status = d.ok
        ? `${n} Produkte · abgerufen ${when.format(new Date(d.fetchedAt))}${d.stale ? ' (letzter Abruf fehlgeschlagen)' : ''}`
        : 'derzeit keine Preise';
      return `<li><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a>
        <span class="muted small-text">${esc(d.address)}${d.note ? ` · ${esc(d.note)}` : ''}</span>
        <span class="${d.ok && !d.stale ? 'muted small-text' : 'err'}">${esc(status)}</span></li>`;
    })
    .join('');
}

function renderChartSelect() {
  const sel = $('#chart-product');
  const opts = [['spot', 'Goldpreis pro Unze'], ...state.latest.products.map((p) => [p.key, p.label])];
  if (!opts.some(([k]) => k === state.chartKey)) state.chartKey = 'spot';
  sel.innerHTML = opts.map(([k, l]) => `<option value="${k}" ${k === state.chartKey ? 'selected' : ''}>${esc(l)}</option>`).join('');
}

function historyPoints() {
  const { recent = [], daily = [] } = state.history || {};
  const firstRecent = recent.length ? recent[0].t : null;
  const older = daily.filter((x) => !firstRecent || x.t < firstRecent);
  let pts = [...older, ...recent].map((x) => ({ t: new Date(x.t).getTime(), d: x.d }));
  if (state.days) {
    const from = Date.now() - state.days * 864e5;
    pts = pts.filter((p) => p.t >= from);
  }
  return pts;
}

function renderChart() {
  document.querySelectorAll('#chart-range button').forEach((b) => b.setAttribute('aria-checked', Number(b.dataset.days) === state.days));
  const pts = historyPoints();
  const buying = state.side === 'buy';
  let datasets = [];

  if (state.chartKey === 'spot') {
    datasets = [{ label: 'Goldpreis pro Unze', data: pts.map((p) => ({ x: p.t, y: spotFrom(p.d) })).filter((p) => p.y), color: COLORS[0] }];
  } else if (state.latest) {
    datasets = state.latest.dealers.map((d, i) => ({
      label: d.name,
      color: COLORS[i % COLORS.length],
      data: pts
        .map((p) => {
          const v = p.d[d.id]?.[state.chartKey];
          return { x: p.t, y: v ? v[buying ? 0 : 1] : null };
        })
        .filter((p) => p.y),
    }));
  }
  datasets = datasets.filter((d) => d.data.length);
  const enough = datasets.some((d) => d.data.length >= 2);
  $('#chart-empty').hidden = enough;
  if (!window.Chart) return;

  const css = getComputedStyle(document.documentElement);
  const muted = css.getPropertyValue('--muted').trim();
  const line = css.getPropertyValue('--line').trim();
  const span = pts.length ? pts[pts.length - 1].t - pts[0].t : 0;
  const tickFmt = new Intl.DateTimeFormat('de-AT', span < 2 * 864e5
    ? { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' }
    : { day: '2-digit', month: '2-digit', timeZone: 'Europe/Vienna' });

  const config = {
    type: 'line',
    data: {
      datasets: datasets.map((d) => ({
        label: d.label, data: d.data, borderColor: d.color, backgroundColor: d.color,
        borderWidth: 2, pointRadius: d.data.length < 30 ? 2 : 0, tension: 0.2,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: { type: 'linear', min: pts[0]?.t, max: pts[pts.length - 1]?.t, ticks: { color: muted, maxTicksLimit: 6, callback: (v) => tickFmt.format(new Date(v)) }, grid: { color: line } },
        y: { ticks: { color: muted, callback: (v) => eur.format(v).replace(',00', '') }, grid: { color: line } },
      },
      plugins: {
        legend: { display: datasets.length > 1, labels: { color: muted, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            title: (items) => when.format(new Date(items[0].parsed.x)),
            label: (item) => `${item.dataset.label}: ${eur.format(item.parsed.y)}`,
          },
        },
      },
    },
  };
  if (chart) chart.destroy();
  chart = new Chart($('#chart'), config);
}

function bind() {
  document.querySelectorAll('.seg button').forEach((b) =>
    b.addEventListener('click', () => { state.side = b.dataset.side; save('side', state.side); render(); }));
  document.querySelectorAll('.controls .chips button').forEach((b) =>
    b.addEventListener('click', () => { state.group = b.dataset.group; save('group', state.group); render(); }));
  document.querySelectorAll('#chart-range button').forEach((b) =>
    b.addEventListener('click', () => { state.days = Number(b.dataset.days); save('days', state.days); renderChart(); }));
  $('#chart-product').addEventListener('change', (e) => { state.chartKey = e.target.value; save('chartKey', state.chartKey); renderChart(); });
  $('#reload').addEventListener('click', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}

async function refresh() {
  $('#reload').classList.add('spin');
  await fetchData();
  render();
  $('#reload').classList.remove('spin');
}

bind();
refresh();
setInterval(refresh, 5 * 60 * 1000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
