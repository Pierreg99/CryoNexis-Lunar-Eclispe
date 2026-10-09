# Prüfung · CRYONEXUS

Geprüft am 9. Oktober 2026 mit Chromium 151.0.7922.173 in der verwalteten Linux-Umgebung. Der abschließende Aufruf `npm test` hat mit Exit-Code 0 abgeschlossen: fünf HTTP-Browser-Suites bestanden, zwei `file://`-Durchläufe ausdrücklich durch die Browser-Richtlinie blockiert. Alle ausgelieferten JavaScript-Dateien bestehen zusätzlich die Syntaxprüfung.

| Prüfung | Ergebnis |
| --- | --- |
| Vollständige lokale Auslieferung | 7 Laufzeitdateien, insgesamt 685.471 Bytes; unter 1,2 MB |
| Skriptreihenfolge und CSS-Struktur | Three.js → Cinema → Szenen → App; 20 nummerierte CSS-Blöcke |
| Desktop und Mobilgerät | Alle sechs Sektionen und Interaktionen geprüft; kein horizontaler Überlauf |
| Lazy-Build | Sechs erfolgreiche Build-Ereignisse, jede Szene genau einmal, auch nach erneutem Scrollen |
| WebGL-Limit | Tatsächliche Kontext-Erzeugung instrumentiert; maximal zwei Kontexte |
| Offscreen-Verhalten | Render-Frame-Zähler pausierter Szenen bleiben unverändert |
| Knoten | Preisdrift, Detail-Aufklappen, Enter/Leertaste, `aria-expanded`, sichtbarer Fokus und Tab-Navigation bestanden |
| Terminal | Alle sieben Befehle, unbekannter Befehl und weitere Eingabe nach `clear` bestanden |
| Phasen | Manuelle Auswahl und automatischer Wechsel; registriertes Intervall 5.200 ms |
| 2D-Effekte | Pointer-Tilt, Glanzposition und vollständig gezählte deutsche Zahlen geprüft |
| Audio | Ein Audio-Kontext, erst durch echte Benutzeraktion; Ein-/Ausschalten bestanden |
| Reduzierte Bewegung beim Start | Null WebGL-Kontexte, null angeforderte Animationsframes, null CSS-Animationen; Inhalte und Bedienelemente verfügbar |
| Reduzierte Bewegung im laufenden Betrieb | Rendering, neue Animationsframes und CSS-Animationen stoppen; erneutes Aktivieren baut auch benachbarte Szenen |
| Kontextverlust und Wiederherstellung | Beide Kontexte verloren, Terminal weiter nutzbar; getrennte Wiederherstellung ohne zusätzliche Kontexte oder Szenen-Neubau |
| Boot-Fail-Safe | Alle Fortschrittsintervalle unterdrückt; unabhängiger 4.200-ms-Timer gibt das Overlay nach gemessenen 4.200,4 ms frei |
| Laufzeit-Netzwerk und Konsole | Keine externen Requests, fehlgeschlagenen Assets, Anwendungsfehler oder Warnungen im abschließenden Durchlauf |

Die Szenenzahlen, Geometrien, GLSL-Chunks, Additive-Materialien mit `depthWrite: false`, ACES im Composite und die Modulgrenzen wurden zusätzlich im Quellcode geprüft. Alle sechs Desktop-Szenen und die mobile Ansicht wurden visuell inspiziert.

## Verbleibende Nachweise

**Direktes Öffnen mit `file://`:** Die verwaltete Chromium-Richtlinie blockiert lokale Datei-URLs mit `ERR_BLOCKED_BY_ADMINISTRATOR`. Sie wurde nicht verändert. Die Dateistruktur verwendet ausschließlich lokale klassische Skripte und prozedurale Assets; ein erfolgreicher direkter Browserlauf ist in dieser Umgebung dennoch nicht belegt. `REQUIRE_FILE_TEST=1 npm test` behandelt die Blockierung als Fehler.

**60 FPS auf schwacher Hardware:** Diese Umgebung rendert mit SwiftShader auf der CPU. Die kurzen anfänglichen Kammermessungen ergaben etwa 0,83 FPS am Desktop und 3,32 FPS in der mobilen Ansicht. Das sind keine Messungen eines physischen GPUs und kein Nachweis des 60-FPS-Ziels. Die Engine reduziert ihre Auflösung bei anhaltend langen Frames; die Zielrate muss auf konkreten Geräten geprüft werden. Dafür `USE_SOFTWARE_GPU=0 npm test` und einen geeigneten Browser mit Hardwarebeschleunigung verwenden.

Testanleitung und auswählbare Suites: [tests/README.md](tests/README.md). Die vollständigen generierten Ergebnisse und Screenshots liegen nach einem Testlauf im ignorierten Verzeichnis `tests/artifacts/`; sie gehören nicht zum Laufzeit-Payload.
