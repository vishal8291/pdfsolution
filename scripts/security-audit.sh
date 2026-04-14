#!/usr/bin/env bash
# =============================================================
#  PDF Solution — Weekly Security Audit Script
#  Run manually or add to cron:
#    0 9 * * 1  /var/www/pdfsolution/scripts/security-audit.sh
#    (runs every Monday at 9am)
# =============================================================
set -euo pipefail

APP_DIR="/var/www/pdfsolution"
cd "$APP_DIR"

echo ""
echo "══════════════════════════════════════════════════"
echo "  🔍  Security Audit — $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════════════"

# ── 1. npm audit — check for known CVEs ─────────────────────
echo ""
echo "▶ Checking npm packages for known vulnerabilities…"
npm audit --audit-level=high 2>&1 || {
  echo ""
  echo "⚠️  High/Critical vulnerabilities found. Run:"
  echo "   npm audit fix"
  echo "   # or for breaking changes:"
  echo "   npm audit fix --force"
}

# ── 2. Check for outdated packages ──────────────────────────
echo ""
echo "▶ Checking for outdated packages…"
npm outdated 2>&1 || true   # outdated returns exit 1 if anything is behind

# ── 3. Check .env is not committed ──────────────────────────
echo ""
echo "▶ Verifying .env is gitignored…"
if git ls-files --error-unmatch .env 2>/dev/null; then
  echo "🚨  CRITICAL: .env is tracked by git! Remove it immediately:"
  echo "   git rm --cached .env"
  echo "   git commit -m 'Remove .env from tracking'"
else
  echo "  ✓ .env is not tracked by git"
fi

# ── 4. Check for hardcoded secrets in source ────────────────
echo ""
echo "▶ Scanning source for accidental secret patterns…"
SECRETS_FOUND=0
# Look for common patterns that should never be in source code
grep -rn --include="*.ts" --include="*.tsx" --include="*.js" \
  -E "(RAZORPAY_KEY_SECRET|MONGODB_URI|SMTP_PASS|sk_live_|rk_live_)" \
  src/ server/ 2>/dev/null | grep -v "process\.env\." | grep -v "\.env" && SECRETS_FOUND=1

if [ "$SECRETS_FOUND" -eq 1 ]; then
  echo "🚨  Possible hardcoded secrets found in source — review above output!"
else
  echo "  ✓ No hardcoded secret patterns found in source"
fi

# ── 5. Check PM2 is running ─────────────────────────────────
echo ""
echo "▶ Checking PM2 process status…"
pm2 status 2>/dev/null || echo "  ⚠ PM2 not running or not installed"

# ── 6. Check server health ──────────────────────────────────
echo ""
echo "▶ Pinging /api/health…"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")
if [ "$STATUS" = "200" ]; then
  RESPONSE=$(curl -s http://localhost:3001/api/health)
  echo "  ✓ Server healthy: $RESPONSE"
else
  echo "  ✗ Server returned HTTP $STATUS"
fi

echo ""
echo "══════════════════════════════════════════════════"
echo "  Audit complete."
echo "══════════════════════════════════════════════════"
echo ""
