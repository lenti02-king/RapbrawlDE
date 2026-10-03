# RAPBRAWL

Competitive 2.5D fighting game built around German rap and creator culture. Mobile-first (iOS/Android), web technology (TypeScript + Three.js) with a deterministic, rollback-ready combat simulation.

**Status:** playable vertical slice (prototype art). See [`docs/STATUS.md`](docs/STATUS.md).

## Play locally
```bash
npm install
npm run dev          # open http://localhost:5173  (use `npm run dev` + your LAN IP to try on a phone)
```
Quick links: `/?quick=volt,brick` (straight into a CPU fight), `/?quick=volt,brick&mode=training`, `/?quick=volt,brick&mode=local`.

Controls (P1): **A/D** move, **W** jump, **S** crouch, **J** light, **K** heavy, **L** grab, **Space** block (or hold back), **U/I/O** special cards, **Esc** pause. Double-tap a direction to dash. Touch controls appear automatically on phones/tablets. See *How to play* in the menu.

## Develop
```bash
npm test             # simulation, determinism and rollback netcode tests
npm run build        # production build -> dist/
npm run e2e          # Playwright end-to-end (needs a running dev/preview server)
```
Docs: [`CLAUDE.md`](CLAUDE.md) (developer/agent guide), [`docs/DECISIONS.md`](docs/DECISIONS.md), [`docs/DESIGN.md`](docs/DESIGN.md).

## Mobile builds
Native shells via Capacitor (`android/`, `ios/`). `npm run build && npx cap sync` then open in Android Studio / Xcode. CI builds a debug APK (`.github/workflows/android.yml`).

All characters, music, sounds and art in this prototype are original placeholders.
