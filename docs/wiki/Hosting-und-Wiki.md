# Hosting und Wiki

**[Handbuch](Home.md) / Veröffentlichung**

Die App und das Wiki besitzen getrennte Auslieferungen. `dist/` ist die statische App; `docs/wiki/` ist die versionierte Markdown-Quelle des Handbuchs.

## GitHub Pages

Für öffentliche Repositories ist GitHub Pages innerhalb der geltenden GitHub-Limits kostenlos. CRYONEXUS benötigt keine bezahlten Datenquellen, API-Schlüssel, Server-Datenbank oder Hintergrundprozesse. Kosten und Limits des Hostingkontos hängen von GitHub ab; die App erzeugt keine zusätzlichen Dienste.

Die App ist noch nicht über Pages veröffentlicht. Für eine Veröffentlichung muss **der Inhalt von `dist/`** im Wurzelverzeichnis des Pages-Artefakts liegen:

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

GitHub Pages bietet bei Branch-Veröffentlichung Root oder `/docs` als Quellordner an, nicht `/dist`. Verwende deshalb ein Pages-Artefakt aus `dist/` über GitHub Actions oder einen separaten Veröffentlichungsbranch mit dessen Inhalt im Root. Der Entwicklungsbranch `codex/lunar-eclipse` enthält die fertige Quelle; das Hauptbranch wurde nicht automatisch überschrieben.

Relative Ressourcenpfade funktionieren auch unter einem Projektpfad. Nach der Veröffentlichung Sektionen, Assets, Tastatur, Klang, reduzierte Bewegung und Speicherung auf der echten Pages-Adresse prüfen. Ein anderer Origin besitzt einen eigenen lokalen Spielstand.

## GitHub-Wiki veröffentlichen

Das Wiki ist in den Repository-Einstellungen aktiviert. GitHub erstellt sein separates Git-Repository erst nach einer ersten Wiki-Seite. Der aktuelle Abruf von `CryoNexis-Lunar-Eclispe.wiki.git` liefert deshalb „Repository not found“.

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
