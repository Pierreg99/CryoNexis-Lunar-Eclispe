# Hosting und Wiki

**[Handbuch](Home.md) / Veröffentlichung**

Die App und das Wiki besitzen getrennte Auslieferungen. `dist/` ist die statische App; `docs/wiki/` ist die versionierte Markdown-Quelle des Handbuchs.

## GitHub Pages

Für öffentliche Repositories ist GitHub Pages innerhalb der geltenden GitHub-Limits kostenlos. CRYONEXUS benötigt keine bezahlten Datenquellen, API-Schlüssel, Server-Datenbank oder Hintergrundprozesse. Kosten und Limits des Hostingkontos hängen von GitHub ab; die App erzeugt keine zusätzlichen Dienste.

Die vollständige App ist unter **[pierreg99.github.io/CryoNexis-Lunar-Eclispe](https://pierreg99.github.io/CryoNexis-Lunar-Eclispe/)** veröffentlicht. GitHub Pages verwendet den Branch `codex/lunar-eclipse` und dessen Root (`/`). Dort liegen **alle acht Dateien aus `main/dist/`** unverändert, ergänzt um `.nojekyll` für die direkte statische Auslieferung:

```text
index.html
assets/
  css/main.css
  js/app.js
  js/scenes.js
  js/simulation.js
  vendor/cinema_engine.js
  vendor/three.min.js
  vendor/THREE-LICENSE.txt
```

GitHub Pages bietet bei Branch-Veröffentlichung Root oder `/docs` als Quellordner an, nicht `/dist`. Deshalb kopiert die Veröffentlichung die Laufzeitdateien in das Root des bereits konfigurierten Pages-Branches. Der Hauptbranch `main` bleibt die Quelle für Simulation, Tests und Handbuch. Änderungen an `main` werden erst nach dem folgenden Veröffentlichungsaufruf live; der GitHub-Zugang dieser Einrichtung erlaubt Code-Pushes, aber keine Umstellung der Pages-Einstellungen über die API.

## App aktualisieren

Nach dem Commit deiner Änderungen:

```sh
python3 scripts/publish-pages.py --dry-run
git push origin main
python3 scripts/publish-pages.py
```

Das [Veröffentlichungsskript](../../scripts/publish-pages.py) klont den Pages-Branch in ein temporäres Verzeichnis, übernimmt den bereits gepushten `main` und exportiert dessen exakte `dist/`-Dateien in das Root. Es committet die Auslieferung und pusht ohne Force; andere Branch-Dateien bleiben erhalten. Lokale uncommittete App-Änderungen werden nicht veröffentlicht. GitHub startet anschließend den bestehenden Pages-Build und die Veröffentlichung. `--branch` wählt bei einer späteren Umstellung einen anderen, bereits in Pages konfigurierten Zielbranch.

Relative Ressourcenpfade funktionieren auch unter dem Projektpfad. Die veröffentlichten Dateien wurden bytegenau mit der Quelle verglichen. Nach weiteren Veröffentlichungen Sektionen, Assets, Tastatur, Klang, reduzierte Bewegung und Speicherung auf der echten Pages-Adresse prüfen. Ein anderer Origin besitzt einen eigenen lokalen Spielstand.

## GitHub-Wiki veröffentlichen

Das Wiki ist in den Repository-Einstellungen aktiviert. GitHub erstellt sein separates Git-Repository erst nach einer ersten Wiki-Seite. Ein noch nicht initialisiertes `CryoNexis-Lunar-Eclispe.wiki.git` liefert beim Abruf „Repository not found“.

1. Öffne [die erste Wiki-Seite](https://github.com/Pierreg99/CryoNexis-Lunar-Eclispe/wiki/_new), nenne sie **Home** und speichere sie einmal. Der Inhalt kann durch den folgenden Import ersetzt werden.
2. Prüfe den vorbereiteten Export:

   ```sh
   python3 scripts/publish-wiki.py --dry-run --output /tmp/cryonexus-wiki-preview
   ```

3. Synchronisiere die fertigen Seiten mit deinem bestehenden GitHub-Git-Zugang:

   ```sh
   python3 scripts/publish-wiki.py
   ```

Das Skript klont das vorhandene Wiki, kopiert die 13 Markdown-Dateien einschließlich Sidebar/Footer und erzeugt bei Änderungen einen Commit. Es pusht ohne Force und entfernt keine fremden Seiten. Vor dem Commit zeigt es den Dateistatus. Der aktuelle Branch bestimmt die Links zur Projektquelle und zum Titelbild; `--ref` kann einen anderen **bereits gepushten** Branch oder Commit wählen.

Im Export werden lokale `.md`-Seitenlinks zu GitHub-Wiki-Seitennamen, Datei- und Assetlinks zu passenden GitHub-URLs. Die Originalseiten bleiben im Hauptrepository lesbar. Fehlende Initialisierung, fehlender Git-Zugang oder Push-Konflikte beenden die Veröffentlichung mit einer konkreten Fehlermeldung; sie werden nicht umgangen.

## Dokumentation pflegen

Bearbeite README und `docs/wiki/` im Projekt. Prüfe Links und Beispiele, committe und pushe die Projektänderungen und synchronisiere dann das Wiki. Änderungen direkt im Live-Wiki werden durch eine spätere Synchronisierung der gleichnamigen Quelldatei ersetzt; fremde Seitennamen bleiben erhalten.

**Weiter:** [Handbuch](Home.md) · [Tests und Qualität](Tests-und-Qualitaet.md)
