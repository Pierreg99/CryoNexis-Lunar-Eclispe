# Terminal-Referenz

**[Handbuch](Home.md) / Befehle**

Das Terminal ist eine zweite Bedienoberfläche desselben Modells. Ein Kommando führt keine versteckte Serveranfrage aus. Ausgabe und Eingaben werden als Text behandelt. Groß-/Kleinschreibung der Befehle und Knoten-IDs ist unerheblich; für `reset confirm` bleibt die Bestätigung exakt `confirm`.

## Lesen und navigieren

| Befehl | Ergebnis |
| --- | --- |
| `help` | Alle Befehle und ein Handelsbeispiel |
| `help buy` (oder anderer Befehl) | Zweck, genaue Syntax, Beispiel und Grenzen |
| `tasks` | Sechs Aufgaben mit aktuellem Erfüllungsstand und nächsten Schritten |
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

## Verständliche Ergebnisse

Jede erfolgreiche Änderung liefert einen Beleg. Handel zeigt Einheiten, Kurswert, Slippage, Gebühr, tatsächlichen Gesamtabzug beziehungsweise Nettoerlös, Bestand und verfügbares Guthaben. Bindung, Lösung und Stabilisierung zeigen Stärke, Kohärenz und Stabilität vor und nach der Aktion sowie die tatsächliche Guthabenänderung. Vault-Vorgänge und Einzelschritte nennen Guthaben, gutgeschriebenen Ertrag und die Zugangsentscheidung. Phasen werden durchgehend von 1 bis 5 nummeriert; `phase` nennt auch die jeweiligen Wechselkosten.

Fehler beginnen mit **NICHT AUSGEFÜHRT**, erklären den Grund und verweisen auf passende Hilfe. Fehlende und zusätzliche Argumente werden abgewiesen; etwa `reset confirm extra` setzt nichts zurück. `clear` leert weiterhin nur die Ausgabe. Lese-Befehle erzeugen keine Kosten, Buchungen oder neuen Zeitspuren.

`tasks` prüft sechs aktuelle Bedingungen: eine Position halten, drei Knoten binden, Korona/Freisteller wählen, Stabilität und Kohärenz erfüllen, Vault-Guthaben halten und simulierten Ertrag erhalten. Beispiele für nächste Schritte enthalten die zugehörigen Kosten. Der Stand wird aus dem vorhandenen Modell abgeleitet; er vergibt keine Zusatzbelohnungen. Nach Verkauf oder Lösen einer Bindung kann eine Aufgabe wieder offen sein. Auch `tasks` verändert den Spielstand nicht.

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

## Zeitlich begrenzter CRYO-Zugang

Mit **`unlock cryo`** öffnest du den Vault unabhängig von Phase, Bindungen, Stabilität und Kohärenz bis einschließlich **31. Oktober 2026, 23:59:59 UTC**. Alle Ansichten und vorhandenen Aktionen bleiben nutzbar; Einlagern, Entnehmen und simulierte Zinsen funktionieren im offenen Vault. Guthaben- und Mengenlimits gelten weiterhin. `vault` zeigt den Zugang und das Ablaufdatum; `help` erklärt alle 27 Befehle.

Die Freischaltung wird lokal gespeichert. Ab **1. November 2026, 00:00 UTC** gelten wieder die normalen Zugangsbedingungen; Guthaben bleibt erhalten. `reset confirm` entfernt auch die Freischaltung. Das Datum folgt der Geräteuhr der lokalen Simulation, nicht einer serverseitigen Zugangskontrolle.

Die CRYO-Freischaltung lädt außerdem [Forschungsfähigkeiten](Forschung.md). `missions` zeigt den Forschungsstand; `observe`, `calibrate ID` und `decode` erschließen weitere Bereiche. `cryo unlock` ist eine zusätzliche Schreibweise für `unlock cryo`.
