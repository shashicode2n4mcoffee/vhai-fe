#!/usr/bin/env bash
# Frontend deploy script — build React app and deploy to Firebase Hosting.
# Run this after any frontend changes to deploy in one shot.
# Usage (from repo root or frontend folder):
#   ./frontend/deploy.sh
# Requires: Node 20+, Firebase CLI (npm i -g firebase-tools), and firebase login.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Build frontend (Vite will load .env.production for production API base URL)
cd "$SCRIPT_DIR"
echo "Building frontend (env: VITE_API_BASE_URL from .env.production or current shell)..."
npm ci
npm run build

# Deploy to Firebase Hosting using firebase.json and .firebaserc in this folder
echo "Deploying frontend to Firebase Hosting..."
firebase deploy --only hosting --non-interactive

echo "Frontend deploy complete."

