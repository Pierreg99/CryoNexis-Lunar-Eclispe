# Architektur und Modulverträge

**[Handbuch](Home.md) / Entwicklung**

Vier Laufzeitschichten besitzen getrennte Zuständigkeiten. Marktrechnungen finden ausschließlich im Modell statt; sichtbare Effekte lesen dessen abgeleiteten Zustand.

```mermaid
flowchart TD
    UI["app.js · DOM und Eingaben"] -->|act / selectPhase / tick| MODEL["simulation.js · Regeln und Ledger"]
    MODEL -->|subscribe / snapshot| UI
    UI <-->|Befehl / Ergebnistext| TERM["terminal.js · Syntax, Hilfe und Belege"]
    UI <-->|serialize / create saved| STORE["lokaler Browser-Speicher"]
    UI -->|cryonexus:simulation| ENGINE["cinema_engine.js · Renderer und Audio"]
    SCENES["scenes.js · sechs Builder und Updates"] -->|cinema.boot| ENGINE
    ENGINE -->|Audio, Zeit und visueller Zustand| SCENES
```

## Dateien und Eigentum

| Datei | Verantwortung | Darf nicht besitzen |
| --- | --- | --- |
| [simulation.js](../../dist/assets/js/simulation.js) | Phasenprofile, PRNG, Transaktionen, Zustand, Validierung | DOM, `localStorage`, Renderer |
| [app.js](../../dist/assets/js/app.js) | Eingaben, HUD, Terminal, Speicherung, Modell-Abonnement | Geometrie, Shader, Marktformeln |
| [terminal.js](../../dist/assets/js/terminal.js) | Befehlsprüfung, Hilfe, Ergebnisbelege, abgeleiteter Aufgabenstand | Eigener Spielstand, DOM, Marktformeln |
| [scenes.js](../../dist/assets/js/scenes.js) | Sechs einmalige Builder, bestehende Materialien und Instanzen aktualisieren | Cash, Transaktionen, Renderer-Pool |
| [cinema_engine.js](../../dist/assets/vendor/cinema_engine.js) | Maximal zwei Renderer, Sichtbarkeit, Frame-Schleifen, Audio, Post-FX | Wirtschaftsentscheidungen |
| [index.html](../../dist/index.html) | Sechs semantische Sektionen und stabile IDs | Laufzeitberechnungen |
| [main.css](../../dist/assets/css/main.css) | 20 nummerierte Blöcke, Tokens, responsive Gestaltung | Modellzustand |

Die kritische Ladefolge ist **Cinema → Simulation → Terminal → App → Astro Zen**, mit fünf `defer`-Skripten im HTML-Kopf. Die kleine Engine stellt Audio und Simulations-Abonnements auch ohne Three.js bereit. Sobald die Oberfläche bedienbar ist, lädt die App nach zwei Animationsframes und einer Idle-Gelegenheit **Three.js → Szenen** nach. `requestIdleCallback` besitzt einen 1.500-ms-Timeout; Browser ohne diese API verwenden einen Timer. Verborgene Tabs und reduzierte Bewegung starten keinen Grafikdownload. Beim späteren Aktivieren der Bewegung wird einmalig nachgeladen; laufende Downloads werden nicht dupliziert. Entscheidungen vor dem Grafikstart bleiben in der Engine gespeichert und werden beim ersten Szenenframe angewandt. Der Boot-Schirm verschwindet beim UI-Start ohne künstliche Kalibrierungswartezeit; der unabhängige 4.200-ms-Fail-Safe bleibt erhalten. Die fünf Startskripte tragen jeweils die ersten acht Zeichen ihres SHA-256-Inhaltshashes als `?v=`-Parameter. Änderungen erhalten damit eine neue Browser-Cache-URL; unveränderte Inhalte behalten ihre URL. Der statische Test prüft die Übereinstimmung mit den ausgelieferten Dateien. Klassische Skripte ermöglichen die lokale Dateistruktur ohne Bundler und ohne ES-Modulimporte. Das Modell exportiert zusätzlich CommonJS für seine Node-Tests.

## Modell-API

```js
const model = CryoSimulation.create({ seed: 404 });
const unsubscribe = model.subscribe(snapshot => {
  console.log(snapshot.cash, snapshot.vault.open);
});

const quote = model.quote('buy', 'CN-ALPHA-01', 2);
if (quote.ok) model.act('buy', { id: 'CN-ALPHA-01', quantity: 2 });

model.selectPhase(2, { manual: true });
model.tick({ force: true });
const saved = model.serialize();
const restored = CryoSimulation.create({ saved });
unsubscribe();
```

| Methode | Vertrag |
| --- | --- |
| `snapshot()` | Abgeleitete Kopie von Zustand, Knoten, Vault, Historie und `visual` |
| `act(type, payload)` | Führt eine gültige Aktion atomar aus; gibt `{ok, message}` zurück |
| `quote(type, id, quantity)` | Reine Kauf-/Verkaufsquote; verändert den Zustand nicht |
| `tick({force})` | Ein Fünf-Minuten-Takt; Pause sperrt gewöhnliche Takte, `force: true` erlaubt einen Schritt |
| `selectPhase(index, {manual})` | Index 0–4; manuelle Wechsel kosten Kohärenz, automatische nicht |
| `subscribe(fn)` | Ruft sofort mit einer Kopie auf und liefert eine Abmeldefunktion |
| `serialize()` | Versionierter JSON-fähiger Rohzustand inklusive PRNG |

Ungültige gespeicherte Versionen, Zahlen, IDs, Schlüssel oder Historien starten sauber neu und setzen `restoreError`. Snapshot- und Subscriber-Kopien können das Modell nicht verändern. DOM-Abonnements und Speicherausfälle bleiben Aufgabe der Oberfläche.

## Ereignisse zwischen Oberfläche und Grafik

| Ereignis | Inhalt | Empfänger |
| --- | --- | --- |
| `cryonexus:scene` | `{id, section}` nach erfolgreichem Build | HUD-Szenenzähler |
| `cryonexus:phase` | `{index, name}` | Phasendiagnose; Engine-Fallback vor erstem Modellzustand |
| `cryonexus:simulation` | Nur `snapshot.visual`, keine Transaktionsbefehle | Engine und nächste sichtbare Szenen-Updates |
| `cryonexus:graphics` | Grafik-Fallback-Meldung | Oberflächenstatus |

`visual` enthält Phase, Kohärenz/Stabilität/Flux/Korona in 0–1, Temperatur in °C, sechs Bindungen, sechs Stärken und Holdings, Vault-Zugang/Leistung sowie die Ereignissequenz. Die Engine begrenzt ihre Anzeigeeingaben. Sobald ein Modellzustand vorliegt, ist dessen Phase maßgeblich.

## Renderer und Lebenszyklus

Szenen werden innerhalb eines 250-px-Vorlaufs einmalig gebaut. Ihre CPU-Geometrien und Spielzustände bleiben gecacht. Die sechs ursprünglichen Canvas-Elemente sind Anker. Zwei gemeinsam genutzte Renderer bewegen ihre tatsächlichen Canvas-Flächen zu den sichtbaren Sektionen; die Zahl der Kontexte wächst auch bei wiederholtem Scrollen nicht.

Vor jedem Draw prüft die Engine die aktuelle Bildschirmposition. Verborgene Tabs, Offscreen-Sektionen und reduzierte Bewegung erzeugen keine Renderframes. Beim Freigeben einer Szene werden ihre GPU-Geometrien, Instanzbuffer und Materialprogramme disposed; die CPU-Objekte bleiben für die nächste Sichtbarkeit verfügbar. Three.js lädt deren Daten beim Zurückscrollen erneut hoch, ohne den Szenen-Builder neu auszuführen.

Ein freier Renderer-Slot schrumpft seine Canvas-Fläche und drei Render-Targets auf 1 × 1. Dadurch werden große Texturen und Framebuffer freigegeben. Die zwei Kontexte bleiben wiederverwendbar, einschließlich ihrer kleinen Standardsampler, des Fullscreen-Quads und der drei Post-FX-Programme. Kontextwiederherstellung ersetzt verlorene Render-Targets, erhält aber Szenen und Kontextanzahl.

Jeder aktive Slot nutzt ein Szenen-Target mit Tiefenpuffer und zwei Bloom-Targets auf Viertelbreite und Viertelhöhe. Der Blur wechselt zwischen den beiden kleinen Targets. Auflösung: DPR höchstens 1,5, höchstens 1.600 × 1.300 und 950.000 Pixel, zusätzlich adaptive Skalierung. Bei Half-Float ergeben sich konservativ höchstens **12,35 MB Target-Speicher je Slot**, also **24,7 MB für zwei Slots**. Die Schätzung setzt vier Bytes pro Tiefenpixel an; Canvas-Backbuffer, Geometrie und Treiber-Overhead sind nicht enthalten. Sie ist keine Messung des gesamten VRAM.

Diagnose in der Browserkonsole:

```js
cinema.getStats();       // Contexts, scenes, slots, estimated target bytes and visual values
CryoScenes.built();      // Successfully built canvas IDs
CryoScenes.failed();     // Failed canvas IDs
```

## Änderungen einordnen

Neue Spielregeln gehören in `simulation.js`, Eingaben in `app.js`, Geometrie in Builder und visuelle Reaktionen in `onUpdate`. Erzeuge beim Handeln keine neuen Geometrien, Materialien oder Renderer. Behalte Offline-Ressourcen, reduzierte Bewegung und die Trennung von Modell und Grafik bei.

**Weiter:** [Szenen](Szenen.md) · [Simulation](Simulation.md) · [Tests](Tests-und-Qualitaet.md)

## Astro Zen Show

`astro-zen.js` steuert ausschließlich die Präsentation der vorhandenen sechs Sektionen. Es erzeugt keine Renderer und besitzt keinen wirtschaftlichen Zustand. Die Show verwendet einen einzelnen 18-Sekunden-Timer, stoppt ihn bei Pause, verborgenem Dokument und Beenden und respektiert reduzierte Bewegung. Die ausgeblendete Oberfläche wird vorübergehend `inert`; der vorherige Inert-Zustand, Scrollposition und Fokus werden anschließend wiederhergestellt. Die bestehenden Simulationsjobs behalten ihren Zeitmodus.
