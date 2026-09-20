#!/usr/bin/env bash
# Sletter de 162 branches der er arkiveret i docs/branch-archive/README.md.
#
# Indholdet er bevaret to steder foerst:
#   - 146 branches: GitHub gemmer PR-commits permanent (refs/pull/<nr>/head)
#   - 16 branches:  docs/branch-archive/patches/
#
# Koer den fra repoets rod:
#   bash scripts/delete-archived-branches.sh --dry-run   # vis hvad der sker
#   bash scripts/delete-archived-branches.sh             # slet
set -uo pipefail

LIST="docs/branch-archive/README.md"
[ -f "$LIST" ] || { echo "Kan ikke finde $LIST - koer fra repoets rod."; exit 1; }

mapfile -t BRANCHES < <(awk -F'|' '/^\| `/{gsub(/[` ]/,"",$2); print $2}' "$LIST")

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

echo "${#BRANCHES[@]} branches paa listen."
fejl=0; ok=0; mangler=0
for b in "${BRANCHES[@]}"; do
  [ -z "$b" ] && continue
  if [ "$b" = "main" ]; then echo "SPRINGER OVER: main"; continue; fi
  if ! git ls-remote --exit-code --heads origin "$b" >/dev/null 2>&1; then
    mangler=$((mangler+1)); continue
  fi
  if [ "$DRY" = 1 ]; then
    echo "ville slette: $b"; ok=$((ok+1)); continue
  fi
  if git push origin --delete "$b" >/dev/null 2>&1; then
    ok=$((ok+1)); printf '.'
  else
    fejl=$((fejl+1)); echo; echo "FEJLEDE: $b"
  fi
done
echo
echo "slettet/valgt: $ok   fandtes ikke: $mangler   fejlede: $fejl"
