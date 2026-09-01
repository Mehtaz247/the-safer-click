#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm run verify
git diff --check

if git status --porcelain | grep -E '(^| )(.env|.env.local)$' >/dev/null; then
  echo "Refusing to publish: an env file is visible to git."
  exit 1
fi

if rg -l --hidden -g '!.git/**' -g '!.env*' 'sk-[A-Za-z0-9_-]{20,}' . >/dev/null; then
  echo "Refusing to publish: possible API key detected outside ignored env files."
  exit 1
fi

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  if git status --short | grep -E '(^.. (engine|ops|prompts|assets)/|^.. (package.json|site.config.json|.github/))' >/dev/null; then
    backup_tag="safety-backup/$(date -u +%Y%m%dT%H%M%SZ)"
    git tag "$backup_tag" HEAD
    git push origin "$backup_tag"
    echo "Created recoverable pre-modification tag: $backup_tag"
  fi
fi

git add .
if git diff --cached --quiet; then
  echo "Nothing to publish."
  exit 0
fi

git commit -m "Publish editorial cycle $(date -u +%Y-%m-%d)"
git push
