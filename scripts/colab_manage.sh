#!/usr/bin/env bash
set -e

SESSION_NAME="${COLAB_SESSION:-next-egg}"
ACTION="${1:-status}"

case "$ACTION" in
    start)
        echo "==> Starting Colab session '${SESSION_NAME}'..."
        colab new -s "${SESSION_NAME}"
        ;;
    stop)
        echo "==> Stopping Colab session '${SESSION_NAME}'..."
        colab stop -s "${SESSION_NAME}"
        ;;
    status)
        echo "==> Checking Colab session '${SESSION_NAME}' status..."
        colab status -s "${SESSION_NAME}"
        ;;
    sessions)
        echo "==> Active Colab sessions:"
        colab sessions
        ;;
    url)
        echo "==> Web URL for session '${SESSION_NAME}':"
        colab url -s "${SESSION_NAME}"
        ;;
    usage)
        echo "==> Compute units usage and balance:"
        colab usage
        ;;
    sync)
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        "${SCRIPT_DIR}/colab_sync.sh"
        ;;
    *)
        echo "Usage: $0 {start|stop|status|sessions|url|usage|sync}"
        exit 1
        ;;
esac
