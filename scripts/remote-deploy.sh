#!/usr/bin/env bash
# Выполняется на сервере (копируется через deploy.ps1 / deploy.sh).
set -euo pipefail

REPO="${1:-/opt/apps/ticketter}"

if [[ ! -d "$REPO" ]]; then
  echo "Папка не найдена: $REPO" >&2
  exit 1
fi

cd "$REPO"
echo "==> $(pwd)"

if [[ ! -f .env ]]; then
  echo "Нет файла .env в $REPO — создайте его на сервере с ключами Supabase и т.д." >&2
  exit 1
fi

git pull
docker compose --env-file .env build
docker compose --env-file .env up -d

echo "==> Готово."
