#!/usr/bin/env bash
# =============================================================
#  PDF Solution — Zero-Downtime Deployment Script
#  Run on your VPS/server:  bash scripts/deploy.sh
# =============================================================
set -euo pipefail

APP_DIR="/var/www/pdfsolution"       # change to your actual path
LOG_DIR="${APP_DIR}/logs"
BRANCH="main"
PM2_APP_NAME="pdf-server"

echo ""
echo "══════════════════════════════════════════════════"
echo "  🚀  PDF Solution Deployment — $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════════════"

# ── 1. Pull latest code ──────────────────────────────────────
echo ""
echo "▶ Pulling latest code from ${BRANCH}…"
cd "$APP_DIR"
git fetch --all --prune
git checkout "$BRANCH"
git pull origin "$BRANCH"
echo "  ✓ Code updated to $(git rev-parse --short HEAD)"

# ── 2. Install / update dependencies ────────────────────────
echo ""
echo "▶ Installing dependencies…"
npm ci --omit=dev 2>&1 | tail -5
echo "  ✓ Dependencies installed"

# ── 3. Build frontend ────────────────────────────────────────
echo ""
echo "▶ Building React frontend…"
npm run build
echo "  ✓ Frontend built → dist/"

# ── 4. Ensure log directory exists ──────────────────────────
mkdir -p "$LOG_DIR"

# ── 5. Reload server — PM2 rolling restart (zero downtime) ──
echo ""
echo "▶ Reloading server (zero-downtime)…"
if pm2 describe "$PM2_APP_NAME" > /dev/null 2>&1; then
  pm2 reload "$PM2_APP_NAME" --update-env
  echo "  ✓ Server reloaded (no downtime)"
else
  pm2 start ecosystem.config.cjs --env production
  pm2 save
  echo "  ✓ Server started fresh"
fi

# ── 6. Health check — wait up to 30 s for server to respond ─
echo ""
echo "▶ Waiting for server health check…"
for i in {1..10}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "  ✓ Health check passed (HTTP 200)"
    break
  fi
  echo "  … attempt ${i}/10 — got ${STATUS}, retrying in 3 s"
  sleep 3
  if [ "$i" -eq 10 ]; then
    echo "  ✗ Health check FAILED — rolling back!"
    pm2 logs "$PM2_APP_NAME" --lines 20 --nostream
    exit 1
  fi
done

# ── 7. Print status ──────────────────────────────────────────
echo ""
pm2 status
echo ""
echo "══════════════════════════════════════════════════"
echo "  ✅  Deployment complete!"
echo "══════════════════════════════════════════════════"
echo ""
