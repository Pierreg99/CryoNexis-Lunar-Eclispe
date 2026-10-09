# CRYONEXUS · Lunar Eclipse

Eine vollständige, deutschsprachige Single-Page-Erfahrung: Krypto-Kammer, Sonnenfinsternis, Eis-Nexus, Schattenmarkt, Vault-Terminal und Nebula. Alle Grafik- und Audioinhalte entstehen prozedural. Die Marktdaten sind eine lokale Simulation.

## Starten

`dist/index.html` direkt im Browser öffnen oder das Verzeichnis lokal bereitstellen:

```sh
python3 -m http.server 8080 --directory dist
```

Danach `http://localhost:8080` öffnen. Die App benötigt keinen Build, keine Installation, kein Konto und keine Internetverbindung. Eine Browser-Richtlinie kann lokale `file://`-URLs sperren; in diesem Fall den lokalen Server verwenden.

## Bedienung

- Navigation und „Kammer betreten“ führen durch sechs Sektionen.
- Die sechs Knoten lassen sich per Klick, Enter oder Leertaste öffnen; ihre simulierten Preise ändern sich alle paar Sekunden.
- Das Terminal unterstützt `help`, `status`, `nodes`, `phase`, `eclipse`, `vault` und `clear`.
- Die fünf Phasen lassen sich direkt auswählen und wechseln zusätzlich automatisch.
- „Klang einschalten“ startet nach einer Benutzeraktion einen leisen, lokal erzeugten Drone. Es wird kein Mikrofonzugriff angefordert.
- Die Systemeinstellung „Bewegung reduzieren“ deaktiviert Canvas, automatische Bewegungen und dekorative Effekte; Inhalt, Terminal und manuelle Phasenauswahl bleiben verfügbar.

## Dateien

```text
dist/
├── index.html
└── assets/
    ├── css/main.css
    ├── js/
    │   ├── scenes.js
    │   └── app.js
    └── vendor/
        ├── three.min.js
        ├── THREE-LICENSE.txt
        └── cinema_engine.js
```

Die klassischen Skripte laden in der Reihenfolge Three.js → Cinema → Szenen → App. Es gibt keine Module, CDN-URLs, externen Fonts, Bilddateien oder Modelldateien. Three.js r149 ist lokal enthalten und unter MIT lizenziert.

## Architektur

Die sechs logischen Szenen werden einmalig gebaut, sobald ihre Sektion bis auf 250 px in Sicht kommt. Zwei gemeinsam genutzte WebGL-Renderer wandern zwischen den sichtbaren Sektionen; die sechs Canvas-Elemente der Seite sind Anker und erzeugen selbst keinen WebGL-Kontext. Nur Sektionen mit tatsächlicher sichtbarer Fläche erhalten einen Renderer. Außerhalb des Viewports, bei verborgenem Dokument und bei reduzierter Bewegung sind ihre Animationsschleifen beendet.

Die Post-FX-Kette besteht aus einem linearen Render-Target, Bright-Pass, horizontalem und vertikalem Gaussian Blur und Composite. Der Renderer verwendet `NoToneMapping`; ACES, Bloom, radiale chromatische Aberration, Vignette, Grain und Scanlines entstehen im Composite. HDR verwendet Half-Float, wenn unterstützt, und andernfalls einen kompatiblen 8-Bit-Target.

Die Audioanalyse verwendet einen `AnalyserNode` mit Bass-, Mitten- und Höhenband. Ohne aktivierten Klang hält ein prozeduraler Sinus-Drift die Bänder lebendig. Audio und Marktdaten bleiben auf dem Gerät.

Für Diagnosezwecke stehen `cinema.getStats()`, `CryoScenes.built()` und `CryoScenes.failed()` in der Browserkonsole bereit. Erfolgreiche Builds senden `cryonexus:scene`; Phasenwechsel senden `cryonexus:phase`.

## Prüfung

Die Entwicklungstests sind vom auslieferbaren `dist/` getrennt. Hinweise und Ergebnisse stehen in [VERIFICATION.md](VERIFICATION.md). Das Rendering passt seine Auflösung bei anhaltend langen Frames nach unten an. 60 fps auf beliebiger schwacher Hardware sind keine überprüfbare Garantie; dafür sind Messungen auf konkreten Geräten erforderlich.
