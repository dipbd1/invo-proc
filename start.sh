#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

need_install() {
  local dir="$1"
  [[ ! -d "$dir/node_modules" ]]
}

if need_install packages/shared; then
  (cd packages/shared && npm install)
fi
if need_install apps/ingest; then
  (cd apps/ingest && npm install)
fi
if need_install apps/review; then
  (cd apps/review && npm install)
fi

export PYTHONUNBUFFERED=1

python3 "$ROOT/apps/accounting-api/accounting_api.py" &
API_PID=$!

(cd "$ROOT/apps/ingest" && npm start) &
INGEST_PID=$!

(cd "$ROOT/apps/review" && npm run dev) &
REVIEW_PID=$!

cleanup() {
  kill "$API_PID" "$INGEST_PID" "$REVIEW_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Accounting API  http://localhost:8080/health"
echo "Ingest API      http://localhost:3001/health"
echo "Review UI       http://localhost:3000"
echo "Stop with Ctrl+C"
echo
echo "Extract (needs GEMINI_API_KEY in .env):"
echo "  cd apps/ingest && npm run ingest -- ../../static/take-home/invoices"

wait
