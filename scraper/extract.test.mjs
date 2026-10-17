import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractPrices } from './extract.mjs';
import { matchProduct, parseEuros } from './products.mjs';

test('erkennt Produkte', () => {
  assert.equal(matchProduct('Goldbarren 1000 g Münze Österreich'), 'bar-1000');
  assert.equal(matchProduct('Feingoldbarren 1.000 g'), 'bar-1000');
  assert.equal(matchProduct('Gegossener Goldbarren 1 kg'), 'bar-1000');
  assert.equal(matchProduct('Goldbarren 2,5 g'), 'bar-2.5');
  assert.equal(matchProduct('Philharmoniker 1/10 oz'), 'phil-1/10');
  assert.equal(matchProduct('Wiener Philharmoniker 1 oz'), 'phil-1');
  assert.equal(matchProduct('Philharmoniker 1 oz ATS'), null);
  assert.equal(matchProduct('Silber Philharmoniker 1 oz'), null);
  assert.equal(matchProduct('Feinsilberbarren 1000 g'), null);
  assert.equal(matchProduct('Feingold 999'), 'fine-1g');
  assert.equal(matchProduct('Goldbarren 1 oz'), 'bar-oz');
});

test('liest Eurobeträge', () => {
  assert.deepEqual(parseEuros('116.334,59 € | 121.005,60 €'), [116334.59, 121005.6]);
  assert.deepEqual(parseEuros('€ 131,79'), [131.79]);
});

test('Tabelle mit Feingewicht, Ankauf und Verkauf', () => {
  const rows = [
    'Produkt | Feingewicht | Verkaufspreis | Kaufpreis',
    'Philharmoniker 1 oz | 31,10 g | 3.677,71 € | 3.789,59 €',
    'Goldbarren 1000 g | 1.000,00 g | 116.334,59 € | 121.005,60 €',
    'Goldbarren 1000 g diverse Hersteller | 1.000,00 g | 116.400,00 € | 120.900,00 €',
  ];
  const r = extractPrices({ rows, lines: [] }, 'buy');
  assert.deepEqual([r['phil-1'].sell, r['phil-1'].buy], [3677.71, 3789.59]);
  assert.equal(r['bar-1000'].buy, 120900);
  assert.equal(r['bar-1000'].sell, 116400);
});

test('Karten ohne Tabelle, nur Verkaufspreis', () => {
  const lines = ['Gegossener Goldbarren 250 g', 'ab', '30.313,32 €', 'In den Warenkorb', 'Goldbarren 10 g', '1.242,64 €'];
  const r = extractPrices({ rows: [], lines }, 'buy');
  assert.equal(r['bar-250'].buy, 30313.32);
  assert.equal(r['bar-10'].buy, 1242.64);
  assert.equal(r['bar-10'].sell, null);
});

test('Ankäufer mit Einzelpreis', () => {
  const lines = ['Philharmoniker 1oz', '3.600,00 €', 'Feingold 999', '115,20 €'];
  const r = extractPrices({ rows: [], lines }, 'sell');
  assert.equal(r['phil-1'].sell, 3600);
  assert.equal(r['fine-1g'].sell, 115.2);
});
