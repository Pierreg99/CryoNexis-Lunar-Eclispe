# CRYONEXUS · Lunar Eclipse

Eine vollständige, deutschsprachige Single-Page-Erfahrung: Krypto-Kammer, Sonnenfinsternis, Eis-Nexus, Schattenmarkt, Vault-Terminal und Nebula. Alle Grafik- und Audioinhalte entstehen prozedural. Ein gemeinsames, deterministisches Simulationsmodell verbindet Märkte, Zeitlinie, Vermögen, Vault und alle sechs Szenen. Alles bleibt auf dem Gerät.

## Starten

`dist/index.html` direkt im Browser öffnen oder das Verzeichnis lokal bereitstellen:

```sh
python3 -m http.server 8080 --directory dist
```

Danach `http://localhost:8080` öffnen. Die App benötigt keinen Build, keine Installation, kein Konto und keine Internetverbindung. Eine Browser-Richtlinie kann lokale `file://`-URLs sperren; in diesem Fall den lokalen Server verwenden.

## Bedienung

- Navigation und „Kammer betreten“ führen durch sechs Sektionen.
- Startkapital: 100.000 fiktive CNX. Knoten lassen sich öffnen, kaufen, verkaufen, zeitlich binden und stabilisieren. Vor jedem Kauf zeigt die Quote Gebühren und Slippage.
- Dashboard und Terminal zeigen freies Guthaben, Positionen, Gesamtvermögen, Gebühren, Stabilität, Kohärenz, Simulationszeit und Phase aus demselben Zustand.
- Drei gebundene Knoten, Stabilität ≥75 und Kohärenz ≥35 öffnen den Vault in Korona oder Freisteller. Einlagen verdienen während des offenen Fensters simulierte Zinsen; geschlossene Fenster bewahren das Guthaben.
- Ein Markttakt alle 2,2 Sekunden entspricht fünf Simulationsminuten. Die fünf Phasen wechseln alle 5,2 Sekunden. Manuelle Wechsel kosten 8–18 Kohärenzpunkte; Stabilisierung oder ruhige Phasen bauen Kohärenz wieder auf.
- „Simulation pausieren“ hält Marktzeit und automatische Phasen an. „+5 Simulationsminuten“ funktioniert auch während einer Pause oder bei reduzierter Bewegung. Eine Schrittaktion wechselt die Phase nicht automatisch.
- Fortschritt und reproduzierbarer Zufallszustand werden lokal im Browser gespeichert. „Neustart“ verlangt zwei Klicks und löscht nur diesen lokalen Simulationszustand. Ist der Speicher gesperrt, funktioniert eine Sitzung ohne dauerhafte Speicherung weiter.
- Das Terminal unterstützt die ursprünglichen sieben Befehle und `portfolio`, `history`, `buy ID Menge`, `sell ID Menge`, `link ID`, `unlink ID`, `stabilize ID`, `deposit Betrag`, `withdraw Betrag`, `pause`, `resume`, `step` sowie `reset confirm`. `phase 1..5` oder `phase Korona` wählt eine Phase. Dezimalkommas sind erlaubt.
- „Klang einschalten“ startet nach einer Benutzeraktion einen leisen, lokal erzeugten Drone. Es wird kein Mikrofonzugriff angefordert.
- Die Systemeinstellung „Bewegung reduzieren“ deaktiviert Canvas, automatische Bewegungen und dekorative Effekte sowie den automatischen Simulationsfortschritt; Handel, Vault, Terminal, Einzelschritte und manuelle Phasenauswahl bleiben verfügbar.

## Dateien

```text
dist/
├── index.html
└── assets/
    ├── css/main.css
    ├── js/
    │   ├── scenes.js
    │   ├── simulation.js
    │   └── app.js
    └── vendor/
        ├── three.min.js
        ├── THREE-LICENSE.txt
        └── cinema_engine.js
```

Die klassischen Skripte laden in der Reihenfolge Three.js → Cinema → Szenen → Simulation → App. Es gibt keine ES-Modulimporte, CDN-URLs, externen Fonts, Bilddateien oder Modelldateien. Three.js r149 ist lokal enthalten und unter MIT lizenziert.

## Architektur

Die sechs logischen Szenen werden einmalig gebaut, sobald ihre Sektion bis auf 250 px in Sicht kommt. Zwei gemeinsam genutzte WebGL-Renderer wandern zwischen den sichtbaren Sektionen; die sechs Canvas-Elemente der Seite sind Anker und erzeugen selbst keinen WebGL-Kontext. Nur Sektionen mit tatsächlicher sichtbarer Fläche erhalten einen Renderer. Außerhalb des Viewports, bei verborgenem Dokument und bei reduzierter Bewegung sind ihre Animationsschleifen beendet.

Die Post-FX-Kette besteht aus einem linearen Render-Target, Bright-Pass, horizontalem und vertikalem Gaussian Blur und Composite. Der Renderer verwendet `NoToneMapping`; ACES, Bloom, radiale chromatische Aberration, Vignette, Grain und Scanlines entstehen im Composite. HDR verwendet Half-Float, wenn unterstützt, und andernfalls einen kompatiblen 8-Bit-Target.

Die Audioanalyse verwendet einen `AnalyserNode` mit Bass-, Mitten- und Höhenband. Ohne aktivierten Klang hält ein prozeduraler Sinus-Drift die Bänder lebendig. Audio und Marktdaten bleiben auf dem Gerät.

Für Diagnosezwecke stehen `cinema.getStats()`, `CryoScenes.built()` und `CryoScenes.failed()` in der Browserkonsole bereit. Erfolgreiche Builds senden `cryonexus:scene`; Phasenwechsel senden `cryonexus:phase`; jede Simulationsaktualisierung sendet `cryonexus:simulation` mit einem begrenzten visuellen Zustand. `getStats()` zeigt den empfangenen Zustand und tatsächlich angewandte Szenenwerte.

## Modulgrenzen

Die vier Laufzeitschichten — Modell, Oberfläche, Szenen und Engine — sind getrennt und kommunizieren über kleine Schnittstellen. Klassische Skripte erhalten die direkte Offline-Nutzung; ES-Modulimporte und ein Bundler sind nicht erforderlich.

| Modul | Verantwortung | Schnittstelle |
| --- | --- | --- |
| `index.html` | Semantische Sektionen, Navigation, Terminal und Phasen | Stabile DOM- und Canvas-IDs |
| `main.css` | 20 nummerierte Blöcke, Tokens, Responsive Layout und reduzierte Bewegung | Klassen und CSS-Variablen |
| `three.min.js` | Lokal eingebundene 3D-Bibliothek | `window.THREE` |
| `cinema_engine.js` | Renderer-Pool, Post-FX, Sichtbarkeit und Audio | `cinema.boot()`, `setAudio()`, `getStats()` |
| `scenes.js` | Sechs einmalig gebaute Szenen, gemeinsame GLSL-Chunks und Eis-Materialien | Boot-Callbacks und `cryonexus:scene` |
| `simulation.js` | Deterministische Wirtschaft, Phasen, Transaktionen, Vault-Regeln und Zustandsprüfung | `CryoSimulation.create()`, `snapshot()`, `act()`, `tick()`, `quote()`, `subscribe()`, `serialize()` |
| `app.js` | DOM, Eingaben, HUD, Speicherung und Darstellung des Modellzustands | DOM-Ereignisse, `cryonexus:phase`, `cryonexus:simulation` |

Szenen definieren statische `onBuild`- und animierte `onUpdate`-Callbacks. Die Engine besitzt ihre Renderer und die Frame-Schleifen. Die Oberfläche erzeugt keine Geometrie und enthält keine Shader. Der Szenenzähler hört auf Build-Ereignisse; Modellzustände erreichen die Engine über ein Ereignis. Szenen verändern vorhandene Materialien, Shader-Uniforms und Instanzdaten; Transaktionen erzeugen keine weiteren Renderer oder Geometrien.

## Simulation und Zahlen

Der Startwert 404 erzeugt reproduzierbare Markttakte; ein gespeicherter Zustand setzt auch die Zufallsfolge exakt fort. Preise driften je Takt höchstens ±0,6 %. Phasen kalibrieren neutrale Preise, statt bei jedem Wechsel erneut Multiplikatoren anzuwenden. Liquidität, Spread, Risiko, Halbwertszeit und Validatorenzahl reagieren auf Phase, Knotenstärke und Bindungen.

`Vermögen = Guthaben + Marktwert der Positionen + Vault-Guthaben`. Handelsgebühren betragen `0,12 % + Phasen-Strahlungsfaktor × 0,08 %`. Slippage kombiniert halben Spread mit `min(Handelsvolumen / Liquidität × 0,035; 0,025)`. Die Kaufquote zeigt den vollständigen Betrag, die Verkaufsquote den tatsächlichen Erlös. Geld wird auf vier, Anteile auf sechs Nachkommastellen geführt; unzulässige Eingaben verändern nichts.

`Stabilität = mittlere Knotenstärke × 0,7 + Kohärenz × 0,3 + Bindungen × 1,2 − Phasenlast`, begrenzt auf 0–100. Binden kostet 1.200 CNX und bringt bis zu sechs Stärkepunkte; Lösen bringt 400 CNX zurück. Stabilisieren kostet 700 CNX und erhöht Stärke um bis zu acht sowie Kohärenz um bis zu sieben Punkte. Der simulierte Jahreszins liegt zwischen 12 und 20 %. Je offenem Fünf-Minuten-Takt entsteht `Vault-Guthaben × Jahreszins / 100 × 5 / 525.600` Ertrag.

Die Phasentemperaturen reichen von −269 bis −264,2 °C; Bindungen und gehaltene Positionen beeinflussen den angezeigten Kernwert. Die kalibrierte maximale Korona bleibt 99,97 %. Das sind bewusst gestaltete Spielregeln und fiktive Werte, keine astronomische, thermodynamische oder finanzielle Vorhersage. Es gibt keine echte Kryptowährung, Wallet, kostenpflichtige API oder Server-Datenbank.

Deine letzten 40 Ereignisse bleiben im Modell, die letzten 20 erscheinen als Zeitspuren. Die Kammer reagiert auf Stabilität und Kohärenz; die Finsternis auf Phase und Strahlung; der Eisring auf Bindungen; das Kristallfeld auf Knotenstärken und Positionen; der Vault auf Zugang und Einlagen; der Nebel auf Kohärenz und Ereignisse.

## Prüfung

`npm test` prüft zuerst das reine Modell und danach die Browserintegration. `npm run test:simulation` prüft ausschließlich das Modell ohne Browser. Die Entwicklungstests sind vom auslieferbaren `dist/` getrennt. Hinweise und Ergebnisse stehen in [VERIFICATION.md](VERIFICATION.md). Das Rendering passt seine Auflösung bei anhaltend langen Frames nach unten an. 60 fps auf beliebiger schwacher Hardware sind keine überprüfbare Garantie; dafür sind Messungen auf konkreten Geräten erforderlich.
