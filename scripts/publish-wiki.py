#!/usr/bin/env python3
"""Export portable wiki pages or synchronize an initialized GitHub wiki."""

import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs' / 'wiki'
LINK = re.compile(r'(!?\[[^\]\n]*\]\()([^\s)]+)(\))')


def git(*args, cwd=ROOT, check=True):
    result = subprocess.run(['git', *args], cwd=cwd, capture_output=True,
                            text=True, timeout=60)
    if check and result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return result


def repository():
    remote = git('remote', 'get-url', 'origin').stdout.strip()
    match = re.fullmatch(r'(?:https://github\.com/|git@github\.com:)([^/]+/[^/]+?)(?:\.git)?', remote)
    if not match:
        raise RuntimeError('origin muss auf ein GitHub-Repository zeigen.')
    return match.group(1)


def convert(text, page, repo, ref):
    def rewrite(match):
        target = urlsplit(match.group(2))
        if target.scheme or target.netloc or not target.path:
            return match.group(0)
        local = (page.parent / target.path).resolve()
        if not local.is_file():
            raise RuntimeError(f'Fehlendes Linkziel: {page.name} → {target.path}')
        if local.parent == SOURCE and local.suffix == '.md':
            path = quote(local.stem)
        else:
            try:
                relative = local.relative_to(ROOT).as_posix()
            except ValueError as error:
                raise RuntimeError('Ein Dokumentationslink verlässt das Projekt.') from error
            if match.group(1).startswith('!'):
                path = f'https://raw.githubusercontent.com/{repo}/{quote(ref, safe="/")}/{quote(relative, safe="/")}'
            else:
                path = f'https://github.com/{repo}/blob/{quote(ref, safe="/")}/{quote(relative, safe="/")}'
        url = urlunsplit(('', '', path, target.query, target.fragment))
        return match.group(1) + url + match.group(3)
    return LINK.sub(rewrite, text)


def export(target, repo, ref):
    target = target.resolve()
    if target == SOURCE or SOURCE in target.parents:
        raise RuntimeError('Der Export darf die versionierten Wiki-Quellen nicht überschreiben.')
    target.mkdir(parents=True, exist_ok=True)
    pages = sorted(SOURCE.glob('*.md'))
    if not pages or not (SOURCE / 'Home.md').is_file():
        raise RuntimeError('Wiki-Quellen oder Home.md fehlen.')
    for page in pages:
        (target / page.name).write_text(convert(page.read_text(encoding='utf-8'), page, repo, ref), encoding='utf-8')
    return pages


def main():
    parser = argparse.ArgumentParser(description='CRYONEXUS-Wiki exportieren oder veröffentlichen.')
    parser.add_argument('--dry-run', action='store_true', help='Nur einen lokalen Export erzeugen; kein Netzwerk oder Push.')
    parser.add_argument('--output', type=Path, help='Exportverzeichnis; nur zusammen mit --dry-run.')
    parser.add_argument('--ref', help='Bereits gepushter Projektbranch oder Commit für Quellen- und Bildlinks.')
    args = parser.parse_args()
    if args.output and not args.dry_run:
        parser.error('--output benötigt --dry-run')
    ref = args.ref or git('branch', '--show-current').stdout.strip() or git('rev-parse', 'HEAD').stdout.strip()
    if ref.startswith('-') or any(character.isspace() for character in ref):
        parser.error('Ungültiger Projektverweis')
    git('rev-parse', '--verify', ref + '^{commit}')
    repo = repository()
    if args.dry_run:
        target = args.output or Path(tempfile.mkdtemp(prefix='cryonexus-wiki-'))
        pages = export(target, repo, ref)
        print(f'{len(pages)} Wiki-Dateien exportiert: {target.resolve()}')
        print(f'Quellenverweis: {ref}. Kein Wiki-Commit und kein Push.')
        return 0
    remote = f'https://github.com/{repo}.wiki.git'
    available = git('ls-remote', remote, check=False)
    if available.returncode:
        print('Wiki-Repository nicht erreichbar. Prüfe Git-Zugang und Wiki-Einstellungen.', file=sys.stderr)
        print(f'Wenn das Wiki noch leer ist: https://github.com/{repo}/wiki/_new öffnen,', file=sys.stderr)
        print('eine erste Seite namens Home speichern und den Aufruf wiederholen.', file=sys.stderr)
        return 2
    with tempfile.TemporaryDirectory(prefix='cryonexus-wiki-publish-') as temporary:
        checkout = Path(temporary) / 'wiki'
        git('clone', remote, str(checkout))
        pages = export(checkout, repo, ref)
        git('add', '--', *(page.name for page in pages), cwd=checkout)
        changed = git('diff', '--cached', '--quiet', cwd=checkout, check=False)
        if changed.returncode == 0:
            print('Wiki ist bereits aktuell; kein Commit und kein Push nötig.')
            return 0
        if changed.returncode != 1:
            raise RuntimeError(changed.stderr.strip() or 'Wiki-Diff konnte nicht geprüft werden.')
        print(git('status', '--short', cwd=checkout).stdout.strip())
        source_commit = git('rev-parse', '--short', ref).stdout.strip()
        git('commit', '-m', f'Synchronize CRYONEXUS documentation from {source_commit}', cwd=checkout)
        git('push', 'origin', 'HEAD', cwd=checkout)
        print(f'{len(pages)} Wiki-Dateien synchronisiert: https://github.com/{repo}/wiki')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (RuntimeError, OSError, subprocess.TimeoutExpired) as error:
        print(f'Wiki-Veröffentlichung abgebrochen: {error}', file=sys.stderr)
        sys.exit(2)
