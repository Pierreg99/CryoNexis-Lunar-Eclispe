#!/usr/bin/env python3
"""Publish the complete app through the repository's existing Pages branch."""

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def git(*args, cwd=ROOT):
    result = subprocess.run(['git', *args], cwd=cwd, capture_output=True,
                            text=True, timeout=120)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return result.stdout.strip()


def main():
    parser = argparse.ArgumentParser(description='Vollständiges dist/ auf den bestehenden Pages-Branch veröffentlichen.')
    parser.add_argument('--source', default='main', help='Bereits gepushter Quellbranch (Standard: main).')
    parser.add_argument('--branch', default='codex/lunar-eclipse', help='In GitHub Pages konfigurierter Zielbranch.')
    parser.add_argument('--dry-run', action='store_true', help='Nur lokale Dateien prüfen; kein Netzwerk oder Push.')
    args = parser.parse_args()
    for branch in (args.source, args.branch):
        if branch.startswith('-'):
            parser.error('Ungültiger Branchname')
        git('check-ref-format', '--branch', branch)
    if args.source == args.branch:
        parser.error('Quellbranch und Pages-Branch müssen unterschiedlich sein.')
    local_files = sorted(path for path in (ROOT / 'dist').rglob('*') if path.is_file())
    if not (ROOT / 'dist/index.html').is_file() or not local_files:
        raise RuntimeError('dist/index.html oder die vollständige Anwendung fehlt.')
    if args.dry_run:
        print(f'{len(local_files)} Laufzeitdateien, {sum(path.stat().st_size for path in local_files)} Bytes.')
        print(f'Quelle: {args.source}; Pages-Branch: {args.branch}. Kein Commit und kein Push.')
        return 0
    remote = git('remote', 'get-url', 'origin')
    with tempfile.TemporaryDirectory(prefix='cryonexus-pages-') as temporary:
        checkout = Path(temporary) / 'site'
        git('clone', '--single-branch', '--branch', args.branch, remote, str(checkout))
        for key in ('user.name', 'user.email'):
            git('config', key, git('config', key), cwd=checkout)
        git('fetch', 'origin', args.source, cwd=checkout)
        source_commit = git('rev-parse', 'FETCH_HEAD', cwd=checkout)
        git('merge', '--no-edit', source_commit, cwd=checkout)
        # Export the exact pushed source, independently of local edits or merge results.
        export = Path(temporary) / 'app'
        export.mkdir()
        archive = Path(temporary) / 'app.tar'
        git('archive', '--format=tar', '--output=' + str(archive), source_commit, 'dist', cwd=checkout)
        shutil.unpack_archive(str(archive), str(export))
        files = sorted(path for path in (export / 'dist').rglob('*') if path.is_file())
        if not (export / 'dist/index.html').is_file():
            raise RuntimeError('Der gepushte Quellbranch enthält keine vollständige App.')
        published = []
        for path in files:
            relative = path.relative_to(export / 'dist')
            if path.is_symlink():
                raise RuntimeError('Die Auslieferung darf keine symbolischen Dateilinks enthalten.')
            target = checkout / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
            published.append(relative.as_posix())
        (checkout / '.nojekyll').write_text('')
        git('add', '--', '.nojekyll', *published, cwd=checkout)
        if git('diff', '--cached', '--name-only', cwd=checkout):
            git('commit', '-m', f'Publish complete application from {source_commit[:7]}', cwd=checkout)
        # A normal push preserves concurrent changes and all unrelated branch files.
        git('push', 'origin', f'HEAD:refs/heads/{args.branch}', cwd=checkout)
        print(f'{len(files)} Laufzeitdateien und .nojekyll auf {args.branch} veröffentlicht.')
        print(f'Quellcommit: {source_commit}; Pages-Commit: {git("rev-parse", "HEAD", cwd=checkout)}')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (RuntimeError, OSError, subprocess.TimeoutExpired) as error:
        print(f'Pages-Veröffentlichung abgebrochen: {error}', file=sys.stderr)
        sys.exit(2)
