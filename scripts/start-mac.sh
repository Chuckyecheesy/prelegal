#!/usr/bin/env bash
# Build and start the prelegal container(s) on macOS.
set -euo pipefail

cd "$(dirname "$0")/.."
docker compose up -d --build
