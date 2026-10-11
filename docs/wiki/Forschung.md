# Forschung und Fähigkeiten

**[Handbuch](Home.md) / Forschungssphäre**

`unlock cryo` oder `cryo unlock` aktiviert den CRYO-Zugang und lädt das Observatorium. Die Forschung erscheint in der letzten Sektion bei der Zeitlinie. Alle Aufgaben sind über Schaltflächen oder Terminalbefehle bedienbar. `missions` zeigt Fortschritt und nächste Freischaltungen.

| Modul | Freischaltung | Fähigkeit und Folge |
| --- | --- | --- |
| Observatorium | Aktiver CRYO-Zugang | Phase wählen und `observe`: jede der fünf Phasen einmal erfassen; die Finsternis erhält eine stärkere Lichtsignatur |
| Resonanzlabor | Zwei unterschiedliche Phasen erfasst und eine Knotenposition gehalten | Gebundene Knoten mit Stärke ≥90 % per `calibrate ID` zu Resonanzbaken machen; das Nexus-Signal wächst |
| Zeitarchiv | Alle fünf Phasen erfasst, drei Knoten kalibriert und positiver Vault-Ertrag | `decode` entschlüsselt Zeitspur 004, öffnet das Dossier und verstärkt die Nebelsignatur |

## Ein vollständig interaktiver Weg

1. Im Terminal `unlock cryo` eingeben und zur Forschung bei der Zeitlinie wechseln.
2. Die aktuelle Phase erfassen. Diamantring wählen und ebenfalls erfassen.
3. Im Observatorium eine Borealis-Position kaufen. Der Button zeigt den gesamten Preis inklusive Handelskosten vor dem Kauf; danach öffnet sich das Resonanzlabor.
4. Die übrigen drei Phasen wählen und jeweils erfassen. Manuelle Phasenwechsel verbrauchen wie bisher Kohärenz.
5. Im Labor mindestens drei Knoten binden und bei Bedarf stabilisieren. Binden kostet 1.200 CNX; Stabilisieren kostet 700 CNX. Ab Stärke 90 % lässt sich ein gebundener Knoten kalibrieren. Kalibrieren selbst kostet keine CNX.
6. Über das Labor 1.000 CNX in den Vault einlagern und fünf Simulationsminuten berechnen. Ein positiver Ertrag öffnet das Zeitarchiv.
7. Zeitspur 004 entschlüsseln und über den Archiv-Link den Nebel ansehen.

Alle Preise und Erträge sind fiktiv. Befehle `observe`, `calibrate ID` und `decode` führen dieselben Modellaktionen aus wie die Schaltflächen. Bestehende Befehle für Handel, Bindungen, Stabilität und Zeit bleiben verfügbar. Doppelte Beobachtungen, Kalibrierungen und Entschlüsselungen werden ohne Zustandsänderung zurückgewiesen.

## Fortschritt und Zugang

Entdeckte Module bleiben entdeckt, auch wenn du später eine Position verkaufst oder eine Bindung löst. Eine neue Kalibrierung prüft weiterhin die aktuelle Bindung und Stärke. Freischaltungen und Forschungsnachweise werden im vorhandenen lokalen Spielstand gespeichert. Alte Spielstände ohne Forschung bleiben lesbar.

Neue Forschungsaktionen benötigen den zeitlich begrenzten CRYO-Zugang bis einschließlich **31.10.2026 UTC**. Nach Ablauf bleiben vorhandene Forschung und entschlüsseltes Dossier einsehbar. `reset confirm` löscht Forschung und Zugang zusammen mit der Simulation. Das Datum folgt der Geräteuhr.

## Laden und Architektur

Beim gesperrten Erststart werden keine Forschungsdateien angefordert. `expedition.js` lädt nach Aktivierung; `capabilities/observatory.js`, `resonance.js` und `archive.js` laden jeweils erst bei ihrer Freischaltung. Gespeicherte Entdeckungen laden beim nächsten Besuch wieder, auch als Leseansicht nach Ablauf. Die Module nutzen die vorhandenen Renderer, die bestehende Simulation und deren Abonnements.

Fehlgeschlagene Moduldownloads bieten „Erneut laden“. Forschungsaktionen im Terminal bleiben verfügbar. Inhaltshashes geben geänderten Modulen neue Cache-URLs. Das Modell besitzt die Nachweise und Zugangsprüfungen; die Module präsentieren Fähigkeiten und Bedienelemente.
