#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="${1:-jordy-c-bbq-cup}"
GITHUB_USER="${2:-YOUR_GITHUB_USERNAME}"
VERCEL_PROJECT="${3:-$REPO_NAME}"

echo "==> Initializing git repo"
git init
git add .
git commit -m "Initial commit: Jordy C BBQ Cup (iOS-ready)"
git branch -M main

if command -v gh >/dev/null 2>&1; then
  echo "==> Creating GitHub repo via gh"
  gh repo create "$GITHUB_USER/$REPO_NAME" --public --source=. --remote=origin --push
else
  echo "==> gh CLI not found. Create a repo named $REPO_NAME on GitHub, then run:"
  echo "git remote add origin https://github.com/$GITHUB_USER/$REPO_NAME.git"
  echo "git push -u origin main"
fi

if command -v vercel >/dev/null 2>&1; then
  echo "==> Linking/creating Vercel project"
  vercel link --project "$VERCEL_PROJECT" --yes || true
  echo "==> Deploying to production"
  vercel deploy --prod --yes
else
  echo "==> vercel CLI not found. Install with: npm i -g vercel"
  echo "Then run: vercel && vercel --prod"
fi

echo "Done."