#!/usr/bin/env bash
set -euo pipefail
cp -n .env.example .env || true
docker compose up -d postgres redis
pnpm install
pnpm db:migrate
pnpm db:seed
echo "✅ Ready — run: pnpm dev"
