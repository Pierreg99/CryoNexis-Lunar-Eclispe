# Tests und Qualität

**[Handbuch](Home.md) / Nachweise**

Der dokumentierte vollständige Lauf vom **10. Oktober 2026** bestand zehn Modell-Testgruppen und zehn HTTP-Browserdurchläufe mit Chromium 151.0.7922.173. Der maßgebliche [Prüfbericht](../../VERIFICATION.md) enthält Ergebnisse und Messgrenzen.

Die Terminal-Erweiterung vom 11. Oktober ergänzt einschließlich CRYO-Freischaltung fünf reine Terminal-Testgruppen und gezielte Browserprüfungen. Die vorherige Vollprüfung der Engine wird dadurch nicht als neu ausgeführter Hardwaretest ausgegeben.

## Ausführen

```sh
npm ci
npx playwright install chromium
npm test
```

Die App in `dist/` benötigt keine dieser Entwicklungsabhängigkeiten. `npm run test:simulation` prüft nur das reine Modell.

| Auswahl | Schwerpunkt |
| --- | --- |
| `ACCEPTANCE_SUITE=desktop npm test` | Alle Sektionen, Fokus, Terminal, Phasen, Audio und Live-Motion-Wechsel |
| `ACCEPTANCE_SUITE=mobile npm test` | Mobile Layouts und dieselben Kerninteraktionen |
| `ACCEPTANCE_SUITE=reduced npm test` | Null WebGL-Kontexte und Animationsframes beim ruhigen Start |
| `ACCEPTANCE_SUITE=recovery npm test` | Beide Kontexte verlieren und getrennt wiederherstellen |
| `ACCEPTANCE_SUITE=gpu npm test` | DPR 2, Viertel-Bloom, Target-Lebensdauer, tatsächliche GPU-Freigabe und Rückkehr |
| `ACCEPTANCE_SUITE=simulation npm test` | Abrechnung, Gates, Zinsen, Speicherung, Szenenfolgen und Speicherfehler |
| `ACCEPTANCE_SUITE=terminal npm test` | Alle 27 Befehle, Hilfe, Belege, Aufgaben, sichere Argumente und mobile Ausgabe |
| `ACCEPTANCE_SUITE=capabilities npm test` | Fähigkeiten laden, Aufgaben lösen, Fortschritt speichern, Szenenfolgen und Ablauf |
| `ACCEPTANCE_SUITE=zen npm test` | Show-Steuerung, reduzierte Bewegung und alle sechs gerenderten Szenen |
| `ACCEPTANCE_SUITE=boot npm test` | Unabhängiger 4.200-ms-Fail-Safe |
| `ACCEPTANCE_SUITE=startup npm test` | UI und Entscheidungen bei angehaltenem Grafikdownload; keine doppelten Downloads |

Mehrere Suites lassen sich kommasepariert wählen. Ohne Auswahl laufen alle. `/usr/bin/chromium` wird bevorzugt; `CHROMIUM_PATH` kann einen anderen Browserpfad angeben.

## Was tatsächlich geprüft wird

Das Modell überprüft Ledger-Identität, 250 begrenzte Markttakte, Gebühren, abgelehnte atomare Vorgänge, Phasenkalibrierung, Netzwerkbindungen, Zinsen, Seed-Replay, exakte Speicherung und Grenzwerte.

Der Browser bedient die App über Buttons und Terminal. Er vergleicht sichtbare Quotes mit Cash-Abzug, übt Vault-Schließung und Wiederöffnung, lädt den Zustand neu und vergleicht tatsächlich angewandte visuelle Werte in allen sechs Szenen. Beschädigter und gesperrter Speicher werden separat geprüft.

WebGL-Kontexte werden bei ihrer tatsächlichen Erzeugung gezählt. Jeder Renderframe wird gegen die aktuelle Bildschirmposition geprüft. Dadurch wird verzögerte Observer-Zustellung nicht mit einem Offscreen-Draw verwechselt. Die erste Software-Shader-Kompilierung darf beim verzögerten Grafikstart, Zwei-Kontext-Setup und bei Einblendchecks bis zu 30 Sekunden dauern; die funktionalen Bedingungen und der getrennte 4.200-ms-Deadline-Test bleiben erhalten.

Die Startprüfung hält den Three.js-Download gezielt an und bedient trotzdem Pause, Einzelschritt und Phasenwahl. Nach Freigabe muss die Grafik genau diese Phase anzeigen; Motion-Wechsel dürfen keinen zweiten Download starten. Beim ruhigen Kaltstart werden weder Three.js noch Szenen geladen. UI-Zeitmarken messen lokale Browser-Bereitschaft und sind keine Zusage für Netzwerklatenz auf GitHub Pages.

Die GPU-Suite zählt native Buffer-, Textur-, Framebuffer-, Renderbuffer- und Vertex-Array-Erzeugung und -Löschung sowie Render-Target-Konstruktoren. Sie besucht alle sechs Szenen in beide Richtungen, prüft DPR 2 und 1.920 × 1.080, verlässt sämtliche Sektionen und kehrt in den Schattenmarkt zurück. Sie bestätigt drei permanente Targets je Kontext, keine Target-Allokationen innerhalb von Renderframes, Viertel-Bloom, höchstens 950.000 Szenenpixel und 24,7 MB konservativ geschätzten Target-Speicher. Im Leerlauf dürfen nur kleine Renderer-Grundressourcen und das Fullscreen-Quad verbleiben. Das ist ein Ressourcen- und Lebensdauernachweis, keine Messung des gesamten VRAM.

## Artefakte und Grenzen

Screenshots und `report.json` liegen im ignorierten `tests/artifacts/`. `CAPTURE_ALL_SECTIONS=1 npm test` erzeugt zusätzliche Szenenbilder. Laufzeitressourcen und Anwendungskonsole müssen fehlerfrei und ohne externe Requests sein.

Die Standardprüfung nutzt SwiftShader auf der CPU. Die letzten kurzen Kammermessungen ergaben **0,66 FPS am Desktop** und **3,29 FPS mobil**. Diese Werte sind keine Aussage über einen physischen GPU. Für konkrete Hardware `USE_SOFTWARE_GPU=0 npm test` verwenden und tatsächliche Hardwarebeschleunigung prüfen. Das Ziel von 60 FPS und der gesamte VRAM auf konkreten Geräten sind noch offen.

Die verwaltete Browserrichtlinie blockiert `file://` mit `ERR_BLOCKED_BY_ADMINISTRATOR`. Zwei Versuche wurden als blockiert protokolliert, nicht als bestanden. `REQUIRE_FILE_TEST=1 npm test` macht diese Blockierung zu einem Testfehler. Die Richtlinie bleibt unverändert.

**Weiter:** [Architektur](Architektur.md) · [FAQ](FAQ.md) · [Detaillierte Testanleitung](../../tests/README.md)
