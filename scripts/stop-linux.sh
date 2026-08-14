#!/usr/bin/env bash
# Stop and remove the prelegal container(s) on Linux.
set -euo pipefail

cd "$(dirname "$0")/.."
docker compose down
