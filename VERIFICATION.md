# Prüfung · CRYONEXUS

## CRYO-Freischaltung · 11. Oktober 2026

Aktueller Umfang: **36 Projektdateien**, **10 Laufzeitdateien mit 761.814 Bytes**, davon 95.122 Bytes Start-JavaScript. Der Befehl `unlock cryo` ist bis zum 31.10.2026 einschließlich UTC aktivierbar. Die persistierte Freischaltung wird bei jeder Vault-Prüfung gegen die Gerätezeit geprüft; normale Zugangsbedingungen gelten nach Ablauf wieder. Alte Speicherstände bleiben kompatibel. Die Freischaltung erzeugt kein Guthaben.

Zehn Modell- und fünf Terminal-Testgruppen bestanden einschließlich Speicherung, Guthabenlimits, Reset und der Grenze zwischen 31.10.2026 23:59:59.999 UTC und 01.11.2026 00:00 UTC.

`ACCEPTANCE_SUITE=terminal,startup,zen npm test` bestand zusätzlich vier lokale Browserdurchläufe. Nach erfolgreichem [Pages-Workflow 38099383500](https://github.com/Pierreg99/CryoNexis-Lunar-Eclispe/actions/runs/38099383500) wurden alle zehn öffentlichen Dateien bytegenau mit Commit `2456cfaf1584272eaef4f4b3190b6c6bb1680b4f` verglichen: 761.814 Bytes stimmen überein. Dieselben vier Browserdurchläufe bestanden anschließend auf der echten HTTPS-Adresse: verzögerter Grafikstart, alle Terminalbefehle einschließlich persistiertem CRYO-Zugang und Ablauf, mobile Show-Steuerung und sechs gerenderte Show-Szenen. Keine blockierten Durchläufe oder Anwendungsfehler. Die Live-UI-Zeitmarke betrug in diesem einzelnen Test 1.581,5 ms; die Grafikantwort wurde absichtlich angehalten. Physische GPU-Leistung ist damit nicht nachgewiesen.


## Astro Zen Show · 11. Oktober 2026

Umfang vor CRYO-Freischaltung: **36 versionierte Projektdateien**, davon **10 Laufzeitdateien mit 759.765 Bytes** und 93.088 Bytes Start-JavaScript. Das separate Show-Modul verwendet die vorhandenen sechs Szenen ohne zusätzliche Renderer oder Dienste.

Zehn Modell- und vier Terminal-Testgruppen bestanden. Drei gezielte HTTP-Browserdurchläufe für Start, Terminal und Show bestanden; anschließend bestanden zwei Show-Durchläufe einschließlich tatsächlicher Darstellung aller sechs Szenen. Geprüft: mobile Bedienung ohne horizontalen Überlauf, 18-Sekunden-Wechsel mit kontrollierter Browserzeit, Pause, manuelle Navigation, reduzierte Bewegung, Escape, Fokus-Rückkehr und unveränderte Modelldaten bei Show-Navigation. Die sechs gerenderten Szenen hielten das Limit von zwei WebGL-Kontexten ein. Die lokale UI-Zeitmarke im verzögerten Grafiktest lag bei 238,2 ms, ohne Zusage für andere Geräte. Mobile Bedienung und Finsternis im Show-Modus wurden zusätzlich visuell geprüft.

## Terminal-Erweiterung · 11. Oktober 2026

Umfang vor Astro Zen: **35 versionierte Projektdateien**, davon **9 Laufzeitdateien mit 754.345 Bytes**. Die vier Startskripte umfassen 89.514 Bytes; Three.js und Szenen bleiben verzögert geladen. Das eigenständige `terminal.js` enthält Eingabeprüfung, Hilfe, Ergebnisbelege und den aus der Simulation abgeleiteten Aufgabenstand.

`ACCEPTANCE_SUITE=terminal,startup,simulation npm test` bestand zehn Modell-Testgruppen, vier Terminal-Testgruppen und fünf HTTP-Browserdurchläufe. Geprüft wurden alle 21 Befehle und ihre Einzelhilfe, zustandsneutrale Lese- und Fehlerfälle, genaue Handelsbelege, vollständiger Aufgaben-/Vault-Ablauf, bestätigter Reset, Speicherung und sichtbare Folgen in allen sechs Szenen. Die UI-Zeitmarke lag beim absichtlich verzögerten Grafikdownload lokal bei 285,6 ms; dies ist keine Ladezeit-Zusage für andere Geräte.

Ein zusätzlicher mobiler Terminal-Durchlauf bei 390 × 844 Pixeln bestand: alle Befehle, sechs erfüllte Aufgaben, Rückmeldungen bei geschlossenem Vault, Fokus, Reset und kein horizontaler Überlauf. Die Aufgaben-Ausgabe wurde zusätzlich visuell geprüft. Alle ausgelieferten JavaScript-Dateien bestehen die Syntaxprüfung; lokale Dokumentationslinks zeigen auf vorhandene Dateien.

## Vorherige Vollprüfung · 10. Oktober 2026

Die folgenden Messungen dokumentieren den Stand vor der Terminal-Erweiterung; aktuelle Laufzeitgrößen stehen oben.

Geprüft am 10. Oktober 2026 mit Chromium 151.0.7922.173 in der verwalteten Linux-Umgebung. Der vollständige Aufruf `npm test` hat mit Exit-Code 0 abgeschlossen: zehn reine Modell-Testgruppen und zehn HTTP-Browserdurchläufe über acht Suites bestanden, einschließlich nativer Vertex-Arrays und verzögertem Grafikdownload. Zwei `file://`-Durchläufe sind ausdrücklich durch die Browser-Richtlinie blockiert. Alle ausgelieferten JavaScript-Dateien bestehen zusätzlich die Syntaxprüfung. Nach Ergänzung der Inhaltsversionen bestanden außerdem drei fokussierte HTTP-Durchläufe für UI-Start, reduzierte Bewegung und Boot-Fail-Safe; dabei wurde ein weiterer Datei-URL-Versuch als blockiert protokolliert.

| Prüfung | Ergebnis |
| --- | --- |
| Vollständige lokale Auslieferung | 8 Laufzeitdateien, insgesamt 742.968 Bytes; unter 1,2 MB |
| Projektstruktur | 33 versionierte Quelldateien auf `main` einschließlich README, Wiki, Wiki-Skript und Pages-Workflow; vier getrennte Schichten: Modell, Oberfläche, Szenen, Engine |
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

Die vollständige App ist unter [pierreg99.github.io/CryoNexis-Lunar-Eclispe](https://pierreg99.github.io/CryoNexis-Lunar-Eclispe/) veröffentlicht. Der [Actions-Deploy der optimierten UI-Ladefolge](https://github.com/Pierreg99/CryoNexis-Lunar-Eclispe/actions/runs/38086786019) hat erfolgreich abgeschlossen. Die Auslieferung enthält alle acht Laufzeitdateien aus `main/dist/`: insgesamt 742.968 Bytes einschließlich Three.js-Lizenz.

Die aktuelle Pages-Konfiguration verwendet GitHub Actions. Der [Workflow](.github/workflows/pages.yml) liefert `dist/` direkt aus `main` aus und wurde erfolgreich mit dieser Konfiguration ausgeführt. App- und Workflow-Änderungen starten automatisch einen Deploy; `workflow_dispatch` erlaubt eine manuelle Veröffentlichung. Das frühere Skript für die Branch-Veröffentlichung wurde entfernt. Anleitung: [Hosting](docs/wiki/Hosting-und-Wiki.md#app-aktualisieren).

Die neue UI-Auslieferung aus Commit `5706744e53f2334fe01e3f808a8c02cdea05b062` wurde öffentlich geprüft: Alle acht Laufzeitdateien stimmen bytegenau mit `dist/` überein. Die Suites `startup,reduced,boot` bestanden zusätzlich als drei HTTPS-Browserdurchläufe. Auch auf Pages blieben Simulation und Phasenwahl bei absichtlich angehaltenem Grafikdownload bedienbar; verspätete Szenen übernahmen die vorherige Entscheidung. Der Browser lud beim ruhigen Kaltstart keine Grafikskripte. Im einzelnen HTTPS-Startlauf lag die UI-Zeitmarke bei **1.349,1 ms** ab Navigation, einschließlich öffentlicher Netzwerkzugriffe. Dieser Einzelwert ist keine Ladezeit-Zusage für andere Verbindungen oder Geräte. Keine externen App-Requests oder Anwendungsfehler; ein lokaler Datei-URL-Versuch wurde richtlinienbedingt blockiert.

Beim vorherigen Engine-Deploy wurden alle acht Dateien bytegenau mit dem damaligen `dist/` verglichen. Die GPU-Suite einschließlich Vertex-Arrays und die unabhängige Kontext-Wiederherstellung bestanden dort zusätzlich als zwei Browserdurchläufe gegen die öffentliche HTTPS-Adresse. Dabei gab es keine externen App-Requests, fehlgeschlagenen Ressourcen oder Anwendungsfehler.

Bei der ersten Veröffentlichung am 9. Oktober bestanden zusätzlich acht Browserdurchläufe gegen die öffentliche HTTPS-Adresse. Die aktuelle vollständige lokale Prüfung umfasst zehn Browserdurchläufe einschließlich GPU-Lebensdauer und UI-Ladepfad; das Modell besteht zehn Testgruppen.

Die Tests warten bei initialer Software-Shader-Kompilierung bis zu 30 Sekunden auf funktionale Zustände; die eigenständige 4.200-ms-Deadline-Prüfung bleibt unverändert und wurde separat auf seinen 4.200-ms-Zeitraum geprüft. Für die Prüfung wurden keine Laufzeitdateien verändert. Der Wiki-Export enthält weiterhin 13 Seiten einschließlich Sidebar und Footer.

## Verbleibende Nachweise

**Direktes Öffnen mit `file://`:** Die verwaltete Chromium-Richtlinie blockiert lokale Datei-URLs mit `ERR_BLOCKED_BY_ADMINISTRATOR`. Sie wurde nicht verändert. Ausschließlich lokale klassische Skripte und prozedurale Assets erhalten die Offline-Struktur; ein erfolgreicher direkter Browserlauf ist in dieser Umgebung dennoch nicht belegt. `REQUIRE_FILE_TEST=1 npm test` behandelt die Blockierung als Fehler.

**60 FPS und gesamter VRAM auf schwacher Hardware:** Diese Umgebung rendert mit SwiftShader auf der CPU. Die kurzen anfänglichen Kammermessungen im vollständigen Durchlauf ergaben 0,66 und 3,29 FPS. Das ist kein Nachweis der Zielrate oder des gesamten VRAM auf einem physischen GPU. Die Engine reduziert ihre Auflösung bei anhaltend langen Frames; konkrete Geräte müssen mit Hardwarebeschleunigung geprüft werden, etwa über `USE_SOFTWARE_GPU=0 npm test`.

Die Simulation folgt dokumentierten Spielregeln; ihre CNX, Marktbedingungen und Zinsen sind fiktiv. Die Tests belegen die implementierten Zusammenhänge und Abrechnungen, keine wissenschaftliche oder finanzielle Vorhersage.

Testanleitung: [tests/README.md](tests/README.md). Generierte Ergebnisse und Screenshots liegen in `tests/artifacts/` und gehören nicht zum Laufzeit-Payload.
