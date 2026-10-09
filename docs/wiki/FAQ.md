# Häufige Fragen

**[Handbuch](Home.md) / Hilfe**

## Warum ist der Vault gesperrt?

Mindestens eine seiner vier Bedingungen fehlt: Korona/Freisteller, drei Bindungen, Stabilität ≥75 oder Kohärenz ≥35. Die Liste am Vault und der Terminal-Befehl `vault` zeigen die tatsächlichen Gründe. Ein Phasenwechsel kann Kohärenz kosten und damit eine zweite Bedingung beeinflussen.

## Sind Einlagen bei geschlossenem Gate verloren?

Nein. Guthaben und bereits gebuchte Erträge bleiben gespeichert. Entnehmen und weitere Zinsen sind erst wieder im offenen Fenster möglich. Die Phase Reset löscht kein Vermögen.

## Warum bewegt sich nach „Pause“ die Grafik noch?

Pause stoppt die berechnete Simulationszeit und automatische Phasen. Die dekorative Szenenzeit ist getrennt. Die Systemeinstellung „Bewegung reduzieren“ stoppt zusätzlich Grafik und CSS-Bewegung.

## Warum läuft nach „resume“ die Zeit nicht automatisch?

Bei reduzierter Bewegung bleibt der automatische Fortschritt abgeschaltet. Nutze `step` oder den Fünf-Minuten-Button. Ein verborgener Tab pausiert ebenfalls automatische Aufgaben.

## Warum beginnt nach einem anderen Port ein neuer Spielstand?

`localStorage` gehört zum Browser-Origin aus Protokoll, Host und Port. `localhost:8080`, `127.0.0.1:8080` und `localhost:8081` teilen keinen Spielstand. Auch Profile und Geräte sind getrennt.

## Warum unterscheiden sich Halbwertszeit oder Validatoren von der Basistabelle?

Die Basistabelle beschreibt neutrale Knotenprofile. Phase, Stärke und Bindung verändern die abgeleiteten Anzeigen. Schon Kontakt besitzt einen Strahlungsfaktor; die angezeigte Halbwertszeit ist daher nicht zwingend der Basiswert.

## Warum springt ein Preis um mehr als 0,6 %?

Die Grenze gilt für einen Markttakt. Ein Phasenwechsel wendet eine separate, feste Phasenkalibrierung an. Die Prozentanzeige am Knoten beschreibt Takt-Drift und wird bei einem Phasenwechsel zurückgesetzt.

## Was kostet ein Handel genau?

Kaufkosten enthalten Handelsvolumen, Gebühren und Slippage. Verkaufserlös ist Volumen abzüglich dieser Kosten. Die Quote zeigt beides vor dem Vorgang. Bindung und Stabilisierung sind getrennte Spielkosten.

## Sind Zahlen, CNX oder Zinsen real?

Nein. Es gibt keine echte Wallet, Zahlung oder externe Marktquelle. Die Simulation folgt reproduzierbaren, dokumentierten Spielregeln. Sie erstellt keine finanzielle oder naturwissenschaftliche Prognose.

## Warum ist die Software-Grafik so langsam?

SwiftShader berechnet Grafik auf der CPU. Seine Messwerte beweisen keine Leistung auf einem physischen GPU. Die Engine begrenzt Pixelzahl und passt die Auflösung an, aber 60 FPS sind erst auf konkreten Geräten zu bestätigen. Siehe [Qualität](Tests-und-Qualitaet.md).

## Warum scheitert der erste Wiki-Push?

Wenn das Wiki aktiviert ist, aber noch keine erste Seite besitzt, fehlt sein separates Git-Repository. GitHub muss es einmal über seine Wiki-Oberfläche erstellen. Alle fertigen Seiten sind bereits im [Handbuch](Home.md) lesbar; das [Importverfahren](Hosting-und-Wiki.md#github-wiki-veröffentlichen) synchronisiert sie danach.

## Unter welcher Lizenz steht das Projekt?

Das lokal eingebundene Three.js r149 steht unter [MIT](../../dist/assets/vendor/THREE-LICENSE.txt). Für den eigenen CRYONEXUS-Code wurde bislang keine separate Lizenz hinzugefügt. Das öffentliche Repository allein legt keine Nutzungslizenz fest.
