#!/usr/bin/env bash
# То же, что deploy.ps1, для Git Bash / WSL / macOS / Linux.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_SCRIPT="${SCRIPT_DIR}/remote-deploy.sh"

SERVER="${TICKETTER_SERVER:-78.111.90.103}"
SSH_USER="${TICKETTER_SSH_USER:-root}"
REMOTE_PATH="${TICKETTER_REMOTE_PATH:-/opt/apps/ticketter}"
SSH_KEY="${TICKETTER_SSH_KEY:-${HOME}/.ssh/id_ed25519}"

if [[ ! -f "$SSH_KEY" ]]; then
  echo "Укажите ключ: export TICKETTER_SSH_KEY=/path/to/key" >&2
  exit 1
fi
if [[ ! -f "$REMOTE_SCRIPT" ]]; then
  echo "Нет файла: $REMOTE_SCRIPT" >&2
  exit 1
fi

TARGET="${SSH_USER}@${SERVER}"
SCP_SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)

echo "==> scp -> ${SERVER}:/tmp/ticketter-deploy.sh"
scp "${SCP_SSH_OPTS[@]}" "$REMOTE_SCRIPT" "${TARGET}:/tmp/ticketter-deploy.sh"

echo "==> ssh: remote-deploy.sh ${REMOTE_PATH}"
ssh "${SCP_SSH_OPTS[@]}" "$TARGET" "chmod +x /tmp/ticketter-deploy.sh && bash /tmp/ticketter-deploy.sh '${REMOTE_PATH}'"

echo "==> Успешно."
