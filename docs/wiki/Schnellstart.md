# Schnellstart

**[Handbuch](Home.md) / Einstieg**

Die App selbst benötigt nur die Dateien in `dist/`. Entwicklungswerkzeuge und Tests werden erst für Codeänderungen benötigt.

## Lokal öffnen

```sh
git clone --branch main https://github.com/Pierreg99/CryoNexis-Lunar-Eclispe.git
cd CryoNexis-Lunar-Eclispe
python3 -m http.server 8080 --directory dist
```

Öffne **http://localhost:8080**. Python dient nur zum lokalen Bereitstellen der statischen Dateien. Die App lädt keine Daten von einem Backend.

Alternativ `dist/index.html` direkt öffnen, sofern dein Browser Datei-URLs erlaubt. In der verwalteten Testumgebung ist dieser Weg durch eine Richtlinie blockiert; die HTTP-Variante ist geprüft.

## Dein erster Vault

Die Vergleichswerte dieses Beispiels gelten für Kontakt bei 0 Simulationsminuten. Für einen exakt reproduzierbaren Start zuerst „Bewegung reduzieren“ aktivieren und einen vorhandenen Spielstand über „Neustart“ zurücksetzen. „Neustart“ benötigt zwei Klicks und löscht bereits gespeicherten lokalen Fortschritt.

1. Öffne den Schattenmarkt und pausiere die Simulation. So bleiben Phase und Preise während des Beispiels konstant.
2. Öffne **CN-ALPHA-01**, **CN-BOREALIS** und **CN-LUNAR-09** und drücke jeweils **Binden**. Das kostet zusammen 3.600 CNX.
3. Wähle in der Zeitlinie **Korona**. Der manuelle Wechsel kostet 18 Kohärenzpunkte.
4. Der Vault zeigt jetzt vier erfüllte Bedingungen: richtige Phase, drei Bindungen, Stabilität mindestens 75 und Kohärenz mindestens 35.
5. Lagere **1.000 CNX** ein. Freies Guthaben sinkt; Gesamtvermögen bleibt gleich.
6. Drücke **+5 Simulationsminuten**. Der offene Vault bucht einen kleinen simulierten Zinsertrag, die Preise erhalten einen Markttakt.
7. Entnimm einen Betrag oder löse eine Bindung. Beim Lösen schließt das Gate, aber seine Einlage bleibt erhalten.

Ohne vorherige Markttakte liegen nach den drei Bindungen und dem Wechsel zur Korona Kohärenz bei **69** und Stabilität bei **77,4333**. Bei reduzierter Bewegung funktionieren dieselben Schritte ohne automatische Zeitfortschritte.

## Dasselbe im Terminal

Jeweils eine Zeile eingeben und mit Enter ausführen:

```text
pause
link CN-ALPHA-01
link CN-BOREALIS
link CN-LUNAR-09
phase Korona
vault
deposit 1000
step
portfolio
history
```

`step` bleibt auch während einer Pause verfügbar. Der Schritt ändert die Phase nicht automatisch.

## Als Nächstes

[Bedienung](Bedienung.md) erklärt Handel, Speicherung und Tastatur. [Simulation](Simulation.md) zeigt, wie Gebühren, Kohärenz und Zinsen berechnet werden.
