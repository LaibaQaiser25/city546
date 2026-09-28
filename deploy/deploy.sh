#!/usr/bin/env bash
# Updates the city546 API on the VPS: pull, install, build, migrate, restart.
#   cd /var/www/city546 && bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
npm ci
npm run build
npm run db:migrate

if pm2 describe city546 >/dev/null 2>&1; then
  pm2 reload city546
else
  pm2 start npm --name city546 -- start
  pm2 save
fi

sleep 2
curl -fsS http://127.0.0.1:5000/api/health && echo
