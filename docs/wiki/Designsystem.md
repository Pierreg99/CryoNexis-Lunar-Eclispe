# Designsystem

**[Handbuch](Home.md) / Gestaltung**

Die Gestaltung verbindet kalte Materialien, präzise Instrumente und kurze warme Lichtimpulse. Die zentrale Aussage bleibt **„Du bist Zeitzeuge. Nicht Zuschauer.“** Jedes Bedienelement soll seine Wirkung oder seinen Zustand erklären.

## Palette und Bedeutung

| Token | Wert | Verwendung |
| --- | --- | --- |
| `--void` | `#03060d` | Grundfläche und Raumtiefe |
| `--ice` | `#7fe8ff` | Aktive Bedienung, Fokus, Signale, Eis |
| `--violet` | `#8b7bff` | Zeitbindung, sekundäre Energie und Nebel |
| `--corona` | `#ff7a3d` | Korona, negative Änderungen und Fehlermeldungen |
| `--frost` | `#e0f5fa` | Primärer Text |
| `--steel` | `#8296a9` | Sekundäre Texte und Messbeschriftungen |

Die verbindlichen Tokens stehen in [main.css](../../dist/assets/css/main.css). Farbe unterstützt Text und Symbole; ein Gate oder Fehler darf seine Bedeutung nicht allein über Farbe vermitteln.

## Typografie und Hierarchie

Große System-Sans-Titel eröffnen die sechs Sektionen. Monospace setzt Protokollzeilen, Geldbeträge, Messwerte und Terminal. Zahlen verwenden deutsche Darstellung und tabellarische Ziffern. Externe Fonts werden nicht geladen.

Eine Knotenkarte zeigt zuerst ID, Sektor, Preis und Änderung. Ihre Details enthalten Kennzahlen, Bestand, Quote und Aktionen. Das Dashboard führt Cash und Vermögen getrennt; Vault und Zeitlinie erklären ihre Bedingungen direkt am Bedienort.

## Flächen und Bewegung

Panels besitzen feine cyanfarbene Rahmen, kleine Eckmarkierungen und eine dunkle, transparente Fläche. Die Welt bleibt hinter dem Inhalt sichtbar, ohne die Lesbarkeit zu ersetzen. Hover-Tilt und Pointer-Glanz sind begrenzt und auf Touch deaktiviert.

Einblendungen beobachten eine Sichtbarkeit von 15 % und laufen einmal. Scroll-Tilt, Counters und Audio-Reaktionen unterstützen räumliche Kontinuität. Bei reduzierter Bewegung entfallen dekorative Animationen und Übergänge vollständig; dieselben Aktionen bleiben verfügbar.

## Responsive Gestaltung

Die Haupt-Mobilgrenze liegt bei 760 px, eine zusätzliche Anpassung bei 1.000 px. Das Knotengitter wechselt von drei auf zwei und schließlich eine Spalte. Dashboard-Kennzahlen bleiben in zwei Spalten auf kleineren Breiten. Terminal und Vault werden untereinander angeordnet. Touch-Aktionen erhalten ausreichend große Flächen; Fokus bleibt sichtbar.

## README und Wiki fortführen

Das Titelbild [cryonexus-banner.svg](../assets/cryonexus-banner.svg) verwendet dieselben Tokens, lokale SVG-Geometrie und Systemschrift. Es enthält keine Skripte, externen Ressourcen oder Rastertexturen.

README dient dem Einstieg: Konzept, Start, Handlung/Folge, Architektur und Prüfstand. Das Wiki entwickelt jeweils einen Hauptgedanken pro Seite. Verwende Tabellen für Vergleichswerte, Mermaid für Abläufe und beschreibende Links für nächste Schritte. Prüfdaten und Spielregeln sollen eindeutig von offenen Nachweisen getrennt bleiben.

**Weiter:** [Szenen](Szenen.md) · [Bedienung](Bedienung.md) · [Architektur](Architektur.md)
