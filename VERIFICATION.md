# Prüfung · CRYONEXUS

Geprüft am 9. Oktober 2026 mit Chromium 151.0.7922.173 in der verwalteten Linux-Umgebung. Der abschließende Aufruf `npm test` hat mit Exit-Code 0 abgeschlossen: zehn reine Modell-Testgruppen und 8 HTTP-Browserdurchläufe über sechs Suites bestanden. Zwei `file://`-Durchläufe sind ausdrücklich durch die Browser-Richtlinie blockiert. Alle ausgelieferten JavaScript-Dateien bestehen zusätzlich die Syntaxprüfung.

| Prüfung | Ergebnis |
| --- | --- |
| Vollständige lokale Auslieferung | 8 Laufzeitdateien, insgesamt 739.689 Bytes; unter 1,2 MB |
| Projektstruktur | 16 versionierte Projektdateien; vier getrennte Schichten: Modell, Oberfläche, Szenen, Engine |
| Skriptreihenfolge und CSS-Struktur | Three.js → Cinema → Szenen → Simulation → App; 20 nummerierte CSS-Blöcke |
| Desktop und Mobilgerät | Alle sechs Sektionen und Interaktionen geprüft; kein horizontaler Überlauf |
| Lazy-Build und WebGL-Limit | Jede Szene genau einmal gebaut; maximal zwei tatsächliche WebGL-Kontexte |
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
| Reduzierte Bewegung | Kaltstart null WebGL, null angeforderte Animationsframes, null CSS-Animationen; Live-Wechsel stoppt auch verzögerte Reveal-Übergänge |
| Kontextverlust | Getrennte Wiederherstellung beider Kontexte ohne neue Kontexte oder Szenen-Neubau; Terminal bleibt nutzbar |
| Boot-Fail-Safe | Unabhängiger 4.200-ms-Timer gibt das Overlay ohne Fortschrittsintervalle nach 4.200,5 ms frei |
| Laufzeit-Netzwerk und Konsole | Keine externen Requests, fehlgeschlagenen Assets, Anwendungsfehler oder Anwendungswarnungen |

Die exakten Geometriezahlen und prozeduralen Shader bleiben erhalten. Zustandsänderungen verwenden vorhandene Materialien, Geometrien und Instanzdaten; sie erzeugen keine zusätzlichen Renderer. Die neue Oberfläche wurde zusätzlich am Desktop mit und ohne Animation visuell inspiziert.

## Verbleibende Nachweise

**Direktes Öffnen mit `file://`:** Die verwaltete Chromium-Richtlinie blockiert lokale Datei-URLs mit `ERR_BLOCKED_BY_ADMINISTRATOR`. Sie wurde nicht verändert. Ausschließlich lokale klassische Skripte und prozedurale Assets erhalten die Offline-Struktur; ein erfolgreicher direkter Browserlauf ist in dieser Umgebung dennoch nicht belegt. `REQUIRE_FILE_TEST=1 npm test` behandelt die Blockierung als Fehler.

**60 FPS auf schwacher Hardware:** Diese Umgebung rendert mit SwiftShader auf der CPU. Die kurzen anfänglichen Kammermessungen im abschließenden Durchlauf ergaben 0,83 und 1,11 FPS. Das ist kein Nachweis der Zielrate auf einem physischen GPU. Die Engine reduziert ihre Auflösung bei anhaltend langen Frames; konkrete Geräte müssen mit Hardwarebeschleunigung geprüft werden, etwa über `USE_SOFTWARE_GPU=0 npm test`.

Die Simulation folgt dokumentierten Spielregeln; ihre CNX, Marktbedingungen und Zinsen sind fiktiv. Die Tests belegen die implementierten Zusammenhänge und Abrechnungen, keine wissenschaftliche oder finanzielle Vorhersage.

Testanleitung: [tests/README.md](tests/README.md). Generierte Ergebnisse und Screenshots liegen in `tests/artifacts/` und gehören nicht zum Laufzeit-Payload.
