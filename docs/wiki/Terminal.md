# Terminal-Referenz

**[Handbuch](Home.md) / Befehle**

Das Terminal ist eine zweite Bedienoberfläche desselben Modells. Ein Kommando führt keine versteckte Serveranfrage aus. Ausgabe und Eingaben werden als Text behandelt. Groß-/Kleinschreibung der Befehle und Knoten-IDs ist unerheblich; für `reset confirm` bleibt die Bestätigung exakt `confirm`.

## Lesen und navigieren

| Befehl | Ergebnis |
| --- | --- |
| `help` | Alle Befehle und ein Handelsbeispiel |
| `status` | Uhrzeit, Szenen, Phase, Temperatur, Stabilität, Kohärenz und Simulationszeit |
| `nodes` | Sechs Knoten mit Preis, Stärke, Bestand und Bindung |
| `phase` | Aktuelle Phase und nummerierte Zeitlinie |
| `eclipse` | Korona, Strahlungsfluss und kalibrierte Finsterniswerte |
| `vault` | Gate-Bedingungen, Guthaben, Ertrag und Jahreszins |
| `portfolio` | Gesamtvermögen, Cash, Positionen, Vault und Gebühren |
| `history` | Letzte 20 Simulationsereignisse |
| `clear` | Terminal-Ausgabe leeren; verändert den Spielstand nicht |

## Handeln und verbinden

| Syntax | Beispiel |
| --- | --- |
| `buy ID Menge` | `buy CN-ALPHA-01 2,5` |
| `sell ID Menge` | `sell CN-ALPHA-01 0,5` |
| `link ID` | `link CN-BOREALIS` |
| `unlink ID` | `unlink CN-BOREALIS` |
| `stabilize ID` | `stabilize CN-UMBRA` |
| `deposit Betrag` | `deposit 1000` |
| `withdraw Betrag` | `withdraw 250` |

Positive Dezimalzahlen können Komma oder Punkt enthalten. Keine Tausendertrennzeichen, Vorzeichen oder Exponentialschreibweise verwenden. Handelsmengen besitzen höchstens sechs, Geldbeträge höchstens vier Nachkommastellen. Fehler verändern den Modellzustand nicht.

## Zeit und Neustart

| Befehl | Verhalten |
| --- | --- |
| `phase 1` bis `phase 5` | Kontakt, Diamantring, Korona, Freisteller, Reset |
| `phase Korona` | Phase über ihren Namen auswählen |
| `pause` / `resume` | Automatische Simulationszeit pausieren / freigeben |
| `step` | Fünf Simulationsminuten, auch während einer Pause |
| `reset` | Erläutert die erforderliche Bestätigung; löscht nichts |
| `reset confirm` | Setzt den lokalen Modellzustand sofort zurück |

`resume` hebt reduzierte Bewegung nicht auf: Dort bleibt die Zeit manuell. Die Phase Reset löscht keine Daten. Pfeil hoch/runter ruft frühere Terminal-Eingaben auf; diese Eingabehistorie ist von den gespeicherten Simulations-Zeitspuren getrennt.

**Weiter:** [Erster Vault](Schnellstart.md#dein-erster-vault) · [Regeln](Simulation.md) · [FAQ](FAQ.md)
