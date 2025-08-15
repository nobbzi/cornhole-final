# Jordy C BBQ Cup — Vite + React (iOS-ready)

This package includes:
- iOS viewport fixes (`100svh` + safe-area insets)
- Input sizes to prevent iOS zoom-on-focus
- WebKit backdrop blur for translucent cards
- Reduced-motion friendly confetti

## Run
npm install
npm run dev

## Build/Deploy (Vercel)
- Framework: Vite (auto)
- Build: npm run build
- Output: dist
- Install: npm install

## One-command push (optional)
Make sure you have the GitHub CLI (`gh`) and Vercel CLI (`vercel`) logged in, then run:

```bash
./scripts/push-to-github-and-vercel.sh <repo-name> <your-github-username>
```