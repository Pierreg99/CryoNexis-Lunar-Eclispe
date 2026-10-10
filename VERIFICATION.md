# Prüfung · CRYONEXUS

Geprüft am 10. Oktober 2026 mit Chromium 151.0.7922.173 in der verwalteten Linux-Umgebung. Der vollständige Aufruf `npm test` hat mit Exit-Code 0 abgeschlossen: zehn reine Modell-Testgruppen und zehn HTTP-Browserdurchläufe über acht Suites bestanden, einschließlich nativer Vertex-Arrays und verzögertem Grafikdownload. Zwei `file://`-Durchläufe sind ausdrücklich durch die Browser-Richtlinie blockiert. Alle ausgelieferten JavaScript-Dateien bestehen zusätzlich die Syntaxprüfung. Nach Ergänzung der Inhaltsversionen bestanden außerdem drei fokussierte HTTP-Durchläufe für UI-Start, reduzierte Bewegung und Boot-Fail-Safe; dabei wurde ein weiterer Datei-URL-Versuch als blockiert protokolliert.

| Prüfung | Ergebnis |
| --- | --- |
| Vollständige lokale Auslieferung | 8 Laufzeitdateien, insgesamt 742.968 Bytes; unter 1,2 MB |
| Projektstruktur | 32 versionierte Quelldateien auf `main` einschließlich README, Wiki, Wiki-Skript und Pages-Workflow; vier getrennte Schichten: Modell, Oberfläche, Szenen, Engine |
| Skriptreihenfolge und CSS-Struktur | Cinema → Simulation → App (`defer`); Three.js → Szenen nach UI-Paint/Idle; 20 nummerierte CSS-Blöcke |
| Desktop und Mobilgerät | Alle sechs Sektionen und Interaktionen geprüft; kein horizontaler Überlauf |
| Lazy-Build und WebGL-Limit | Jede Szene genau einmal gebaut; maximal zwei tatsächliche WebGL-Kontexte |
| GPU-Ressourcen und Bloom | Drei permanente Targets je Kontext; zwei Bloom-Targets auf Viertelbreite/-höhe; keine Target-Allokationen in Renderframes bei DPR 2 |
| GPU-Freigabe und Rückkehr | Alle sechs Szenen in beide Richtungen besucht, alle Sektionen verlassen, erneut Kristallfeld besucht; keine Szenen-Neubauten oder zusätzlichen Kontexte |
| Speichergrenze | Höchstens 24,7 MB konservativ geschätzter Target-Speicher; im GPU-Lauf höchster abgetasteter Wert 18.408.984 Bytes und im Leerlauf null |
| Offscreen-Verhalten | Jeder tatsächlich gerenderte Frame wurde unabhängig von verzögerter Observer-Zustellung gegen die Bildschirmposition geprüft; kein Offscreen-Frame |
| Tastatur und Fokus | Enter/Leertaste, `aria-expanded`, sichtbarer Fokus und Tab-Navigation; geschlossene Handelsfelder sofort `inert` |
| Deterministisches Modell | 250 begrenzte Markttakte, Ledger-Identität, Seed-Replay und exakte Fortsetzung nach Wiederherstellung |
| Handel und Kosten | Kaufquote stimmt mit Cash-Abzug und Gebühren überein; Verkauf, Bestände, Spread und Gesamtvermögen geprüft |
| Ungültige Vorgänge | Negative/zu große Mengen, unbekannte Knoten, fehlende Bestände und geschlossener Vault verändern nichts |
| Phasen und Netzwerk | Manuelle Kohärenzkosten, nicht kumulierende Preiskalibrierung, Bindungen und Stabilisierung geprüft |
| Vault | Drei Bindungen und Korona öffnen das Gate; Einlage, Fünf-Minuten-Zins, Gate-Schließung mit erhaltenem Guthaben und Entnahme geprüft |
| Pause und Einzelschritt | Keine automatischen Markttakte bei Pause/reduzierter Bewegung; manuelle Schritte und Zinsbuchung bleiben nutzbar |
| Speicherung und Zeitspuren | Neuladen erhält Vermögen, Bestände, Gate-Zustand, Phase, Zufallsfolge und Historie; reale Ereignisstempel geprüft |
| Speicherfehler | Beschädigtes JSON startet nachvollziehbar neu; gesperrter Speicher erlaubt weiterhin Handel und Einzelschritte |
| Neustart | Unbestätigter Terminal-Neustart und erster Klick erhalten Fortschritt; bestätigter Neustart setzt ihn zurück |
| Alle sechs Szenen reagieren | Angewandte Transform-/Shader-Werte vor und nach Entscheidungen verglichen: Kammer, Finsternis, Nexus, Kristallfeld, Vault und Nebel |
| Terminal und Audio | Ursprüngliche und neue Befehle, Fehlermeldungen, `clear`; Audio erst nach Benutzeraktion, Ein-/Ausschalten |
| Reduzierte Bewegung | Kaltstart ohne Three.js-/Szenen-Downloads: null WebGL, null angeforderte Animationsframes, null CSS-Animationen; Live-Wechsel stoppt auch verzögerte Reveal-Übergänge |
| Kontextverlust | Getrennte Wiederherstellung beider Kontexte ohne neue Kontexte oder Szenen-Neubau; Terminal bleibt nutzbar |
| UI-Ladepfad | Nur 78.197 Bytes JavaScript vor UI-Bereitschaft; 632.861 Bytes Grafikcode werden nachgeladen (89 % vom Startpfad entfernt); die künstliche 2,4-Sekunden-Sequenz entfällt |
| Browser-Cache | Die drei Startskripte besitzen geprüfte SHA-256-Inhaltsversionen in ihrer URL; neue Inhalte erhalten neue URLs, unveränderte Skripte behalten ihre Cache-URL |
| Verspätete Grafik | Angehaltener Three.js-Download blockiert weder Simulation noch Phasenwahl; spätere Szenen erhalten die vorab gewählte Phase |
| Grafikfehler | Ergänzender HTTP-503-Test: Ersatzstatus, sechs Knoten, Pause und Einzelschritt bleiben nutzbar; keine JavaScript-Ausnahme |
| Boot-Fail-Safe | Unabhängiger 4.200-ms-Timer läuft ohne Intervalle nach 4.200,5 ms; normaler Start schließt das Overlay bereits bei UI-Bereitschaft |
| Laufzeit-Netzwerk und Konsole | Keine externen Requests, fehlgeschlagenen Assets, Anwendungsfehler oder Anwendungswarnungen |

Die exakten Geometriezahlen und prozeduralen Szenen-Shader bleiben erhalten. Zustandsänderungen verwenden vorhandene Materialien, Geometrien und Instanzdaten; sie erzeugen keine zusätzlichen Renderer. CPU-Szenen bleiben gecacht, während Offscreen-Geometrien, Instanzbuffer und Materialprogramme auf der GPU freigegeben werden. Freie Slots verkleinern Canvas und Targets auf 1 × 1. Der native Leerlaufnachweis zeigte je Renderer vier Quad-Buffer, zwei kleine Standardsampler, drei Quad-Vertex-Arrays und keine Szenen-Texturen, Framebuffer oder Renderbuffer. Die visuelle Prüfung nutzt zusätzlich die aktualisierten Szenen-Screenshots.

Die Target-Schätzung setzt acht Bytes je Half-Float-Farbpixel und konservativ vier Bytes je Tiefenpixel an: höchstens 950.000 Szenenpixel plus zwei Bloom-Flächen mit je 1/16 der Pixel ergeben höchstens 12,35 MB je Slot. Canvas-Backbuffer, Geometrie, Shader- und Treiber-Overhead sind ausgeschlossen; dies ist keine Gesamt-VRAM-Messung. Die frühere Pipeline dieser Engine hatte bereits permanente Targets, einen gemeinsamen Composite, DPR ≤1,5 und maximal zwei Kontexte. Die aktuelle Änderung reduziert die Bloom-Puffer von drei Flächen auf Halbbreite/-höhe auf zwei Flächen auf Viertelbreite/-höhe und ergänzt die tatsächliche Offscreen-Freigabe.

Die UI-Zeitmarke lag im abschließenden lokalen Lauf bei **236,2 ms** ab Navigation; Three.js war dabei absichtlich noch nicht ausgeliefert. Nach Freigabe zeigte die Grafik die vorab ausgewählte Phase. Die Messung umfasst lokale Navigation und UI-Initialisierung, keinen öffentlichen Netzwerktest oder Hardware-Benchmark. Die nominellen 2,4 Sekunden der früheren Boot-Sequenz wurden vollständig entfernt. FPS bleiben mit einer Nachkommastelle sichtbar, auch unter einem Frame pro Sekunde. Der Browser-Test wartet auf einen tatsächlich folgenden Renderframe und räumt Preisänderungen auf dem Software-GPU bis zu zehn Sekunden ein; die Modell-Timer bleiben bei 2,2 und 5,2 Sekunden.

## Dokumentationsprüfung

Die README wurde mit GitHubs Markdown-Renderer geprüft. 13 Wiki-Markdown-Dateien einschließlich Sidebar und Footer wurden lokal exportiert; 100 relative Links und Seitenanker wurden auf vorhandene Ziele geprüft. Das Schnellstart-Beispiel wurde gegen das Modell ausgeführt: Kohärenz 69, Stabilität 77,4333, Vault-Zins 19,164 %. Titelbild und README wurden in heller, dunkler und mobiler Vorschau geprüft.

Das Veröffentlichungsskript meldet die noch fehlende Wiki-Initialisierung ausdrücklich. Das Wiki ist aktiviert, besitzt aber noch kein separates Git-Repository; die erste Home-Seite muss über GitHub angelegt werden. Alle Wiki-Quellen sind bereits im Projekt verfügbar. Das Handbuch beschreibt auch die neue Trennung zwischen UI-Start und verzögertem Grafikdownload.

## GitHub Pages

Die vollständige App ist unter [pierreg99.github.io/CryoNexis-Lunar-Eclispe](https://pierreg99.github.io/CryoNexis-Lunar-Eclispe/) veröffentlicht. Der vorherige [Actions-Deploy der optimierten Engine](https://github.com/Pierreg99/CryoNexis-Lunar-Eclispe/actions/runs/38060361512) hat erfolgreich abgeschlossen. Die Auslieferung enthält alle acht Laufzeitdateien aus `main/dist/`: insgesamt 742.968 Bytes einschließlich Three.js-Lizenz.

Die aktuelle Pages-Konfiguration verwendet GitHub Actions. Der [Workflow](.github/workflows/pages.yml) liefert `dist/` direkt aus `main` aus und wurde erfolgreich mit dieser Konfiguration ausgeführt. App- und Workflow-Änderungen starten automatisch einen Deploy; `workflow_dispatch` erlaubt eine manuelle Veröffentlichung. Das frühere Skript für die Branch-Veröffentlichung wurde entfernt. Anleitung: [Hosting](docs/wiki/Hosting-und-Wiki.md#app-aktualisieren).

Beim vorherigen Engine-Deploy wurden alle acht Dateien bytegenau mit dem damaligen `dist/` verglichen. Die GPU-Suite einschließlich Vertex-Arrays und die unabhängige Kontext-Wiederherstellung bestanden dort zusätzlich als zwei Browserdurchläufe gegen die öffentliche HTTPS-Adresse. Dabei gab es keine externen App-Requests, fehlgeschlagenen Ressourcen oder Anwendungsfehler.

Bei der ersten Veröffentlichung am 9. Oktober bestanden zusätzlich acht Browserdurchläufe gegen die öffentliche HTTPS-Adresse. Die aktuelle vollständige lokale Prüfung umfasst zehn Browserdurchläufe einschließlich GPU-Lebensdauer und UI-Ladepfad; das Modell besteht zehn Testgruppen.

Die Tests warten bei initialer Software-Shader-Kompilierung bis zu 30 Sekunden auf funktionale Zustände; die eigenständige 4.200-ms-Deadline-Prüfung bleibt unverändert und bestand mit 4.200,4 ms. Für die Prüfung wurden keine Laufzeitdateien verändert. Der Wiki-Export enthält weiterhin 13 Seiten einschließlich Sidebar und Footer.

## Verbleibende Nachweise

**Direktes Öffnen mit `file://`:** Die verwaltete Chromium-Richtlinie blockiert lokale Datei-URLs mit `ERR_BLOCKED_BY_ADMINISTRATOR`. Sie wurde nicht verändert. Ausschließlich lokale klassische Skripte und prozedurale Assets erhalten die Offline-Struktur; ein erfolgreicher direkter Browserlauf ist in dieser Umgebung dennoch nicht belegt. `REQUIRE_FILE_TEST=1 npm test` behandelt die Blockierung als Fehler.

**60 FPS und gesamter VRAM auf schwacher Hardware:** Diese Umgebung rendert mit SwiftShader auf der CPU. Die kurzen anfänglichen Kammermessungen im vollständigen Durchlauf ergaben 0,66 und 3,29 FPS. Das ist kein Nachweis der Zielrate oder des gesamten VRAM auf einem physischen GPU. Die Engine reduziert ihre Auflösung bei anhaltend langen Frames; konkrete Geräte müssen mit Hardwarebeschleunigung geprüft werden, etwa über `USE_SOFTWARE_GPU=0 npm test`.

Die Simulation folgt dokumentierten Spielregeln; ihre CNX, Marktbedingungen und Zinsen sind fiktiv. Die Tests belegen die implementierten Zusammenhänge und Abrechnungen, keine wissenschaftliche oder finanzielle Vorhersage.

Testanleitung: [tests/README.md](tests/README.md). Generierte Ergebnisse und Screenshots liegen in `tests/artifacts/` und gehören nicht zum Laufzeit-Payload.
