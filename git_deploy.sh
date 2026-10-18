#!/bin/bash
# Deploy Brick Breaker (staticka HTML hra).
# Spoustet v koreni projektu: ./git_deploy.sh
# Stahne jen zmeny a pripadne restartuje sluzbu, pokud existuje.
set -e
cd "$(dirname "$0")"

git fetch origin

if [ -n "$(git status --porcelain | grep -v '^??')" ]; then
  echo "CHYBA: zmenene verzovane soubory, deploy zastaven."
  git status --short
  exit 1
fi

git pull --ff-only

if systemctl list-unit-files 2>/dev/null | grep -q '^brick-breaker\.service'; then
  systemctl restart brick-breaker.service
  systemctl status brick-breaker.service --no-pager | head -n 5
else
  echo "Sluzba brick-breaker.service neexistuje - staticka hra je aktualizovana."
fi

echo "Deploy hotov."
