# Quests und Geheimnisse

**[Handbuch](Home.md) / Entdecken**

Das **Entdeckerjournal** verbindet sechs Aufträge, sechs verborgene Übertragungen und zwei ungewöhnliche Echos. Es ist unabhängig vom zeitlich begrenzten CRYO-Zugang verfügbar. Öffne **JOURNAL** in der oberen Leiste oder tippe `quests` ins Terminal.

## Dein erster Auftrag

1. Nimm **Ankunft in Kammer 04** an.
2. Öffne die Kammer und wähle **KAMMERSIGNAL PRÜFEN**.
3. Kehre ins Journal zurück und hole die Belohnung ab.

Weitere Aufträge öffnen sich, sobald du die Belohnung ihrer Vorgänger abgeholt hast. Ein erfüllter Auftrag bleibt erfüllt, wenn du später die Phase wechselst, Bindungen löst oder Geld entnimmst. Jede Belohnung gibt es einmal.

| Auftrag | Nachweis | Belohnung |
| --- | --- | --- |
| Ankunft in Kammer 04 | Kammersignal prüfen | Erstes Dossier |
| Der Schatten hat einen Rand | Finsternis während Korona prüfen | Dossier über die Nachricht am Schattenrand |
| Kartograf des Unsichtbaren | Signale aller sechs Szenen prüfen | Titel „Zeitzeuge“ |
| Eine Bake im Eis | Gebundenen Knoten auf mindestens 90 % stabilisieren | Dossier über die letzte Bake |
| Zeit im Eis | Mit mindestens 1.000 CNX im offenen Vault in einem Schritt positiven Ertrag erzeugen | Dossier über gespeicherte Zeit |
| Die Kammer erinnert sich | Zwei Geheimnisse finden und Vorgänger abschließen | Titel „Hüter der Kammer“ und Aurora |

```mermaid
flowchart LR
    A[Ankunft] --> E[Schattenrand]
    E --> K[Kartografie]
    A --> B[Bake]
    B --> Z[Zeit im Eis]
    K --> R[Erinnerung · zwei Geheimnisse]
    Z --> R
```

Die Kartografie weist auf die nächste noch nicht untersuchte Szene. Im Journal kannst du die Zeit pausieren und direkt zur Phasenwahl springen. So bleiben Signale in einer gewünschten Phase erreichbar. Manuelle Phasenwechsel und die normalen Knotenaktionen behalten ihre Kosten.

Neue gültige Beacon- und Vault-Nachweise zählen auch vor dem Öffnen des Journals. Ein alter Spielstand ohne Journal-Nachweise erfindet keine Vergangenheit: Eine neue Stabilisierung oder ein neuer Ertragsschritt liefert den fehlenden Beleg. Ertrag von einer kleinen Einlage und eine spätere große Einlage ersetzen keinen gemeinsamen Nachweis.

## Verborgene Übertragungen

In jeder Szene liegt ein prüfbares Signal. Es reagiert auf deine aktuelle Situation und enthält manchmal eine Spur zum nächsten Fund. Wiederholtes Prüfen kostet nichts. **Geheimnisse** zeigt zunächst unbekannte Signale; Hinweise lassen sich bewusst aufklappen.

Eine verschlossene Frequenz verlangt drei gelesene Übertragungen und einen daraus abgeleiteten Code. Zwei andere Erinnerungen reagieren auf Stille beziehungsweise zurückkehrendes Licht. Falsche Codes, unbekannte Wörter und wiederholte Belohnungen verändern den Spielstand nicht.

Die drei weiteren Geheimnisse erzählen eigene Geschichten: **Der Rückweg** verbindet die vollständige Karte mit ihrem Anfang, **Die siebte Stimme** verbirgt ein Wort in zusammengehörenden Inschriften, und **Die Gegenspur** wartet auf deine Antwort auf eine empfangene Nachricht. Prüfe die genannten Orte bewusst und lies freigeschaltete Nachrichten im Archiv erneut. Ungelesene Hinweise lassen sich nicht durch einen zufällig richtigen Code ersetzen.

Unter **Geheimnisse** kannst du einen Code über **SIGNAL SENDEN** oder ein einzelnes Wort über **ECHO SENDEN** eingeben. Beide Formen verwenden dieselben Regeln wie `signal Code` und `echo Wort`; Rückmeldungen bleiben direkt am Eingabefeld sichtbar.

Die Randnotizen im Vault weisen außerdem auf alte Geschichten und interaktive Abenteuer hin. Ein Echo kann eine ungewöhnliche Antwort hervorbringen. Gefundene Geheimnisse und Echos erscheinen im Journal und im Archiv.

## Archiv und Signaturen

**Archiv & Signaturen** sammelt verdiente Dossiers, Titel, Geheimnisse und Echos. **Frost** ist von Anfang an verfügbar. Die verlorene Frequenz öffnet **Glut**; der letzte Auftrag öffnet **Aurora**. Wähle dort eine Signatur oder nutze `theme ID`. Die Auswahl bleibt nach dem Neuladen erhalten.

Belohnungen sind Geschichten und Gestaltung. Sie erzeugen keine CNX, verändern keine Zufallsfolge und umgehen keine Vault-Bedingungen. Die regulären Spielaktionen behalten ihre Wirkung. **Neustart** und `reset confirm` löschen auch Journal, Entdeckungen und die gewählte Signatur.

## Terminal

| Befehl | Wirkung |
| --- | --- |
| `quests` | Aufträge, IDs, Fortschritt und nächste Schritte lesen |
| `quest arrival` | Einen verfügbaren Auftrag annehmen |
| `claim arrival` | Eine erreichte Belohnung abholen |
| `inspect kammer` | Signal prüfen; auch finsternis, nexus, knoten, vault und nebel |
| `inspect` | Signal der aktuellen Ansicht prüfen |
| `secrets` | Entdeckungen und Hinweise lesen |
| `signal Code` | Eine Frequenz rekonstruieren oder ihre Antwort senden |
| `echo Wort` | Eine verborgene Stimme oder ungewöhnliche Antwort finden |
| `theme` / `theme frost` | Signaturen lesen / auswählen |

<details>
<summary>Komplette Lösungen anzeigen — Spoiler</summary>

Die **Frequenz 004** entsteht aus Kammer 04, 46 Schollen und Brechungsindex 1,3091: `signal 004-46-13091`. Zuvor Kammer, Finsternis und Nexus prüfen.

Das **Archiv der Stille** öffnet sich mit `pause`, danach `inspect nebel`. **Zwischen Licht und Eis** erscheint nach einer Finsternisinspektion mit `phase Freisteller`, danach `inspect nexus`.

Für **Der Rückweg** alle sechs Szenen prüfen und danach die Kammer erneut prüfen. Wird die Kammer als sechster Ort zum ersten Mal untersucht, ist eine weitere Prüfung nötig.

Für **Die siebte Stimme** Knoten, Vault und Zeitlinie prüfen. Die Anfangsbuchstaben der vier Zeilen im Knotenfeld bilden **HIER**: `echo hier`. Groß-/Kleinschreibung dieses Wortes ist unerheblich.

Für **Die Gegenspur** zuerst **Frequenz 004** empfangen. Ihre Archivnachricht fordert die Feldreihenfolge III — II — I: `signal 13091-46-004`. Die Ziffern innerhalb jedes Feldes bleiben unverändert.

Die alten Antworten lauten `echo 42` und `echo xyzzy`. Ein erfolgreicher Fund wird einmal gespeichert; erneutes Senden erzeugt keine zweite Belohnung.

</details>

**Weiter:** [Bedienung](Bedienung.md) · [Terminal](Terminal.md) · [Forschung](Forschung.md)
