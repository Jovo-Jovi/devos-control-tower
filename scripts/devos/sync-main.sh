#!/usr/bin/env bash
# Bring the latest main into the task branch right before the runner pushes (PR-14).
# If main changed during the run (for example a method patch to .github/workflows/), a task branch
# without those commits looks to GitHub like it edits workflow files, and GitHub refuses the push
# from the Actions token. Merging main first keeps the branch's workflow files identical to main's.
# Usage: bash scripts/devos/sync-main.sh <authenticated remote URL>
set -euo pipefail
remote="$1"
git fetch --quiet "$remote" "+refs/heads/main:refs/remotes/origin/main"
if git merge-base --is-ancestor origin/main HEAD; then
  exit 0
fi
echo "main moved during this run; merging it into $(git branch --show-current) before pushing"
if ! git merge --no-edit origin/main; then
  git merge --abort || true
  echo "::error title=Dev OS::main changed during this run and conflicts with this task's work. Re-run the task; nothing was lost on main."
  exit 1
fi
