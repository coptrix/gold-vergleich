# Goldpreise Salzburg

Private Vergleichsseite für Gold-An- und Verkaufspreise von Händlern im Raum Salzburg
(Ögussa, philoro, Alpengold, Kornmesser). Läuft gratis auf GitHub:

- **Abruf:** GitHub Actions öffnet alle 30 Minuten die Preisseiten der Händler
  (`scraper/`), liest Barren- und Philharmoniker-Preise aus und speichert sie in
  `site/data/latest.json` und `site/data/history.json`.
- **Seite:** `site/` ist eine statische Web-App (PWA) auf GitHub Pages. Am Handy
  über „Zum Home-Bildschirm“ wie eine App nutzbar.

## Händler ergänzen

Neuen Eintrag in `scraper/dealers.mjs` anlegen. Liefert ein Händler keine Preise,
den Workflow manuell mit „Seiteninhalt speichern“ starten und im Artefakt `debug`
nachsehen, wie die Seite aussieht.

## Lokal

```sh
npm install
npm test
CHROME_PATH=/pfad/zu/chrome node scraper/scrape.mjs --dump
```

Preise ohne Gewähr. Die Daten stammen von den öffentlichen Webseiten der Händler
und werden nur privat genutzt.
