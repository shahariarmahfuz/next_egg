#!/usr/bin/env bash
set -e

SESSION_NAME="${COLAB_SESSION:-next-egg}"
TIMEOUT="${COLAB_TIMEOUT:-300}"

if [ -z "$1" ]; then
    echo "Usage: $0 [--sync] <command to run on Colab>"
    echo "Example: $0 pytest backend/tests"
    echo "Example: $0 \"cd backend && alembic upgrade head\""
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if --sync flag is passed
if [ "$1" = "--sync" ]; then
    shift
    "${SCRIPT_DIR}/colab_sync.sh"
fi

if [ "$#" -eq 1 ]; then
    CMD="$1"
else
    CMD=$(printf "%q " "$@")
fi

echo "==> Running on Colab (${SESSION_NAME}): ${CMD}"

B64_CMD=$(printf "%s" "${CMD}" | base64 -w 0)

printf "!cd /content/egg && export PYTHONPATH=/content/egg/backend:\$PYTHONPATH && echo '%s' | base64 -d | bash\n" "${B64_CMD}" | colab exec -s "${SESSION_NAME}" --timeout "${TIMEOUT}"
