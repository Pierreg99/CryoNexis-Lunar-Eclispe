# Simulation: Regeln und Zahlen

**[Handbuch](Home.md) / Modell**

Alle Zahlen sind Spielregeln einer lokalen, deterministischen Welt. Sie sind keine Finanz-, Astronomie- oder Temperaturvorhersagen. Autoritative Quelle: [simulation.js](../../dist/assets/js/simulation.js).

## Grundzustand

| Größe | Start / Grenze |
| --- | --- |
| Freies Guthaben | 100.000 CNX |
| Kohärenz | 90 von 100 |
| Phase | Kontakt |
| Zufallsstartwert | 404 |
| Simulationsminuten | 5 je Markttakt |
| Geldpräzision | 4 Nachkommastellen |
| Anteilspräzision | 6 Nachkommastellen |
| Handelsmenge | Höchstens 1.000 Anteile pro Vorgang |
| Historie | Letzte 40 Ereignisse; Oberfläche zeigt 20 |

Ein gespeicherter Zustand enthält auch den Zufallsgenerator. Wiederherstellung setzt dieselbe Folge fort. Ungültige Transaktionen ändern weder Zahlen noch Historie.

## Die sechs Basisprofile

Das sind neutrale Basiswerte. Phase, Stärke und Bindung verändern die angezeigte Liquidität, Halbwertszeit und Validatorenzahl bereits beim Ableiten des Zustands.

| Knoten | Sektor | Basispreis CNX | Basisliquidität CNX | Halbwertszeit h | Validatoren | Stärke |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| CN-ALPHA-01 | Eis-Storage | 1.842,60 | 1.840.000 | 128 | 64 | 84 |
| CN-BOREALIS | Cryo-Mining | 927,34 | 2.630.000 | 96 | 128 | 92 |
| CN-LUNAR-09 | Corona-Handel | 3.120,09 | 4.170.000 | 42 | 92 | 78 |
| CN-KRYO-7X | Strahlungsschild | 748,72 | 1.120.000 | 256 | 48 | 96 |
| CN-UMBRA | Schattenmarkt | 2.064,18 | 3.260.000 | 64 | 76 | 68 |
| CN-HALO | Lichtarbitrage | 1.296,46 | 2.080.000 | 32 | 104 | 88 |

## Phasen

| Phase | Manuelle Kohärenzkosten | Strahlungsfaktor | Korona | Kerntemperatur °C | Netzlast | Basis-Jahreszins |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Kontakt | 8 | 0,18 | 8 % | −268 | 2 | 12 % |
| Diamantring | 12 | 0,65 | 44 % | −266,8 | 5 | 15 % |
| Korona | 18 | 0,96 | 99,97 % | −264,2 | 8 | 18 % |
| Freisteller | 14 | 0,42 | 36 % | −266 | 4 | 16 % |
| Reset | 8 | 0,10 | 1,5 % | −269 | 0 | 12 % |

Die aktive Phase erneut auszuwählen ist kostenlos. Ein Wechsel von Reset zu Kontakt erhöht den Zykluszähler. Automatische Phasenwechsel verbrauchen keine manuelle Kohärenz.

Pro Takt driften Preise um höchstens ±0,6 %. Zusätzlich besitzt jede Phase feste Preisfaktoren. Diese kalibrieren den neutralen Preis und werden nicht bei jedem Wechsel erneut aufeinander multipliziert. Ein Phasenwechsel kann daher einen größeren Preissprung erzeugen als ein Markttakt; die ±0,6-%-Grenze gilt für Takte, nicht für Phasenkalibrierungen.

Knotenstärke und Kohärenz bewegen sich je Takt in Richtung begrenzter Phasen-Baselines. Bindungen verbessern diese Bedingungen, hohe Positionsexposition beeinflusst den Kohärenzzielwert. Der visuelle Strahlungsfluss kann vom Phasen-Strahlungsfaktor abweichen, weil er zusätzlich auf Kohärenz und Positionen reagiert.

## Vermögen und Handelskosten

```text
Positionswert = gerundeter Preis × gehaltene Anteile
Portfolio = Summe der gerundeten Positionswerte
Vermögen = freies Guthaben + Portfolio + Vault-Guthaben

Handelsvolumen = Preis × Menge
Gebührenrate = 0,0012 + Phasen-Strahlungsfaktor × 0,0008
Gebühr = Handelsvolumen × Gebührenrate
Liquiditätseinfluss = min(Handelsvolumen / Liquidität × 0,035; 0,025)
Slippage = Handelsvolumen × (Spread / 200 + Liquiditätseinfluss)
Kaufkosten = Handelsvolumen + Gebühr + Slippage
Verkaufserlös = Handelsvolumen − Gebühr − Slippage
```

Geldbeträge werden auf vier Nachkommastellen gerundet. Spread ist in Prozent angegeben; `/200` wandelt den halben Spread in einen Dezimalfaktor um. Die Oberfläche zeigt Cash und Vermögen mit zwei, Gebühren und Zinsertrag mit vier Nachkommastellen. Bindungs- und Stabilisierungskosten sind keine Handelsgebühren.

## Risiko und Netzstabilität

```text
Risiko = (100 − Stärke) × 0,62 + Phasen-Strahlungsfaktor × 23
         + (100 − Kohärenz) × 0,15 − (gebunden ? 8 : 0)
Spread = 0,12 + Risiko × 0,004 + 1.000.000 / Liquidität × 0,06
Stabilität = mittlere Knotenstärke × 0,7 + Kohärenz × 0,3
             + gebundene Knoten × 1,2 − Phasenlast
```

Risiko und Stabilität liegen zwischen 0 und 100, Spread zwischen 0,12 und 2 %. Die angezeigte Risiko-Zahl ist ein Spielindikator, keine statistische Verlustwahrscheinlichkeit.

| Aktion | Cash | Stärke | Kohärenz |
| --- | ---: | ---: | ---: |
| Binden | −1.200 CNX | Bis +6 | −1 |
| Lösen | +400 CNX | −6, mindestens 25 | +1, höchstens 100 |
| Stabilisieren | −700 CNX | Bis +8 | Bis +7 |

## Vault-Fenster und Zinsen

Alle vier Bedingungen müssen gleichzeitig gelten:

1. Phase Korona oder Freisteller.
2. Mindestens drei gebundene Knoten.
3. Stabilität mindestens 75.
4. Kohärenz mindestens 35.

```text
Jahreszins in % = Basis-Jahreszins + Bindungen × 0,25 + Kohärenz × 0,006
                 begrenzt auf 12 bis 20
Ertrag je offenem Takt = Vault-Guthaben × Jahreszins / 100 × 5 / 525.600
```

Bei einer frischen Simulation mit drei Bindungen und manuell gewählter Korona beträgt der Jahreszins **19,164 %**. Einlagern und Entnehmen verschieben Geld zwischen Cash und Vault, ohne das Gesamtvermögen zu verändern. Geschlossene Fenster bewahren Geld, buchen aber keine Zinsen.

**Weiter:** [Modell-API](Architektur.md#modell-api) · [Bedienung](Bedienung.md) · [Tests und Qualität](Tests-und-Qualitaet.md)

## Zeitlich begrenzter CRYO-Zugang

Mit **`unlock cryo`** öffnest du den Vault unabhängig von Phase, Bindungen, Stabilität und Kohärenz bis einschließlich **31. Oktober 2026, 23:59:59 UTC**. Alle Ansichten und vorhandenen Aktionen bleiben nutzbar; Einlagern, Entnehmen und simulierte Zinsen funktionieren im offenen Vault. Guthaben- und Mengenlimits gelten weiterhin. `vault` zeigt den Zugang und das Ablaufdatum; `help` erklärt alle 27 Befehle.

Die Freischaltung wird lokal gespeichert. Ab **1. November 2026, 00:00 UTC** gelten wieder die normalen Zugangsbedingungen; Guthaben bleibt erhalten. `reset confirm` entfernt auch die Freischaltung. Das Datum folgt der Geräteuhr der lokalen Simulation, nicht einer serverseitigen Zugangskontrolle.

Die CRYO-Freischaltung lädt außerdem [Forschungsfähigkeiten](Forschung.md). `missions` zeigt den Forschungsstand; `observe`, `calibrate ID` und `decode` erschließen weitere Bereiche. `cryo unlock` ist eine zusätzliche Schreibweise für `unlock cryo`.
