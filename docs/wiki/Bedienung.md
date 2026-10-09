# Bedienung

**[Handbuch](Home.md) / Interaktion**

## Knoten und Handel

Die sechs Knoten öffnen sich per Klick, Enter oder Leertaste. Jeder zeigt Preis, Liquidität, Stärke, Spread, simuliertes Risiko, Validatoren, Halbwertszeit und deinen Bestand.

Gib eine positive Anzahl von Anteilen ein. Dezimalkomma und Dezimalpunkt sind erlaubt; verwende keine Tausendertrennzeichen. Vor dem Kauf zeigt die Quote den vollständigen Betrag einschließlich Gebühr und Slippage. Beim Verkauf zeigt sie den tatsächlich gutgeschriebenen Erlös. Fehlendes Guthaben oder zu geringer Bestand sperren den jeweiligen Button.

| Aktion | Bedeutung |
| --- | --- |
| Kaufen / Verkaufen | Ändert Positionen und freies Guthaben |
| Binden | Kostet 1.200 CNX; verbindet den Knoten zeitlich mit dem Netzwerk |
| Lösen | Bringt 400 CNX zurück und prüft die Vault-Bedingungen neu |
| Stabilisieren | Kostet 700 CNX; erhöht Stärke und Kohärenz bis zu deren Grenzen |

## Zeitsteuerung

| Steuerung | Verhalten |
| --- | --- |
| Automatischer Markt | Alle 2,2 Sekunden fünf Simulationsminuten |
| Automatische Phase | Alle 5,2 Sekunden nächste Phase, ohne manuelle Kohärenzkosten |
| Simulation pausieren | Stoppt automatische Markt- und Phasenfortschritte |
| +5 Simulationsminuten | Ein manueller Markttakt, auch während einer Pause |
| Phase auswählen | Ändert Marktbedingungen; kostet je Zielphase 8–18 Kohärenzpunkte |

Pause hält die berechnete Zeit an; die dekorativen Szenen können weiter animieren. Für vollständig ruhige Darstellung die Systemeinstellung „Bewegung reduzieren“ aktivieren. Ist der Browser-Tab verborgen, pausieren die automatischen Aufgaben ebenfalls.

## Vault

Die Bedingungen stehen direkt am Vault. Einlagern und Entnehmen sind nur im offenen Fenster möglich. Wenn eine Bedingung wegfällt, bleiben Guthaben und bereits gebuchte Zinsen erhalten. Während des geschlossenen Fensters entstehen keine neuen Zinsen. Verbessere das Netzwerk oder wähle ein geeignetes Zeitfenster, um wieder zu entnehmen.

Die Phase **Reset** schließt den Vault, löscht aber keine Käufe oder Einlagen. Sie ist unabhängig vom **Neustart** der gesamten Simulation.

## Speicherung und Neustart

Fortschritt liegt unter `cryonexus.simulation.v1` im `localStorage` dieses Browser-Ursprungs. Derselbe Host und Port teilen denselben lokalen Spielstand. Ein anderer Port, ein anderes Gerät oder ein anderes Browserprofil startet getrennt.

Neuladen stellt Zustand und Zufallsfolge wieder her. Beschädigte Zustände werden geprüft und durch einen frischen Start ersetzt; eine sichtbare Meldung erklärt das. Bei gesperrtem Speicher bleiben Handel und Schritte während der Sitzung verfügbar, gehen nach dem Schließen aber verloren.

„Neustart“ verlangt einen zweiten Klick innerhalb von acht Sekunden. Alternativ bestätigt `reset confirm` im Terminal das Löschen. Danach: 100.000 CNX, Phase Kontakt, keine Positionen, Bindungen oder Historie.

## Tastatur, Klang und reduzierte Bewegung

Tab bewegt zwischen den Bedienelementen; geschlossene Knotenfelder sind sofort `inert` und nicht fokussierbar. Enter/Leertaste öffnen Knotendetails. Im Terminal blättern Pfeil hoch und runter durch die Eingabehistorie.

Klang beginnt erst nach einer Pointer-Aktion oder dem Klang-Button. Der Drone entsteht im Browser; es wird kein Mikrofon angefordert. „Bewegung reduzieren“ stoppt Canvas, Animationsframes, CSS-Animationen und automatische Simulationszeit. Inhalte, Terminal, Handel und manuelle Schritte bleiben verfügbar.

**Weiter:** [Terminal](Terminal.md) · [Simulation](Simulation.md) · [FAQ](FAQ.md)
