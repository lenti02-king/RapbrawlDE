# Project status

_Last updated: 2026-10-04 (end of session 1)._
Legend: **VERIFIED** = observed working via automated test or screenshot; **BUILT** = compiles/builds, not exercised; **UNVERIFIED** = implemented, not checked; **BLOCKED** = needs something outside the agent's control.

## How to play right now
- Private claude.ai Artifact (single-file build, owner-only until shared): https://claude.ai/artifact/QxFGw7nin7xvWrdnmQZuiv
- Android debug APK: GitHub → Actions → "Android debug APK" → latest run → artifact `rapbrawl-debug-apk` (needs "install unknown apps").
- Local: `npm install && npm run dev`.
- GitHub Pages: workflow exists but needs Pages enabled (Settings → Pages → Source: GitHub Actions) and a merge to `main`.

## Vertical slice — state
| Area | Status | Evidence |
|---|---|---|
| Deterministic combat sim (movement, dash, jump, normals, chains, specials, throws/tech, high/low/overhead block, juggles, armor, counters, projectiles, KO/rounds/time-over) | VERIFIED | `tests/combat.test.ts` (25 tests) |
| P1/P2 fairness (mirror inputs → mirror outcome) | VERIFIED | `tests/symmetry.test.ts` (found + fixed an input-order asymmetry) |
| Fighters VOLT / BRICK, 6 cards each incl. 1 Signature | VERIFIED (sim + pose/hitbox sheets) | `scripts/moves.mjs` |
| Card loadout (3 of 6, max 1 Signature, no power-by-rarity) | VERIFIED | E2E |
| Cinematic signatures: VOLT "Headliner", BRICK "Security!" (with security-guard actors) | VERIFIED frame-by-frame | `scripts/cine.mjs volt|brick` |
| KO → slow-mo → PERFECT/WINS → next round → match end → results → rematch | VERIFIED | `scripts/ko.mjs`, E2E |
| Arena "Main Stage", HUD, menus, loadout, pause, results, training readouts | VERIFIED (screenshots/E2E) | |
| Hit feel (hitstop + shake, sparks, rings, flashes, camera shake/kick/FOV punch) | VERIFIED as static frames | real-time feel needs human playtest |
| Procedural audio (SFX, crowd, generative beat) | BUILT, UNVERIFIED (never heard by a human) | |
| CPU bot (3 levels) + live attract-mode demo | VERIFIED runs | `scripts/botmatch.ts` balance probe |
| Keyboard (2 local players) | VERIFIED (E2E) | |
| Gamepad | UNVERIFIED | |
| Touch controls (floating stick, L/H/Grab/Block, 3 card buttons) | VERIFIED in emulated iPhone 13 landscape (Chromium) | real iOS Safari / Android WebView UNVERIFIED |
| Rollback netcode core | VERIFIED in simulation | `tests/netcode.test.ts` (latency, jitter, loss, late start) |
| Online in-app: same-device two-tab test | VERIFIED (2 pages, 60 ms lag, 11 checksums matched, rollbacks occurred) | `scripts/netplay.mjs` |
| Online in-app: WebRTC friend match (copy/paste codes) | VERIFIED on one machine (2 pages connected and fought); across real networks/NAT UNVERIFIED | no TURN server → some mobile networks will fail |
| Android build | VERIFIED builds in CI (debug APK artifact); install/run on a device UNVERIFIED | `.github/workflows/android.yml` |
| iOS build | BLOCKED (needs macOS + Xcode + Apple developer account) | project generated in `ios/` |
| CI (typecheck, tests, build, Playwright E2E) | VERIFIED green on GitHub Actions (run #2+) | `.github/workflows/ci.yml` |
| Performance | 32 draw calls, ~68k triangles per frame (measured). Real-device FPS UNVERIFIED | |

## Balance snapshot (bot vs bot, 120 matches, hard)
VOLT ≈ 38% vs BRICK. Mirror matches ≈ 50/50 within noise. Bot data is a sanity check only; tune from human playtests.

## Known issues / risks
- Feel/timing (hitstop lengths, damage, meter gain, touch layout) has never been tested by a human.
- Online: no rematch flow, no matchmaking, no TURN relay, no adaptive input delay (fixed 2 frames); same-device test uses BroadcastChannel only.
- Artifact host blocks WebRTC: friend match does not work in the claude.ai Artifact; the same-device test may.
- Procedural characters are placeholders; no authored art/animation pipeline yet.
- Bot is reactive but exploitable.
- Back-throw victim animation assumes a forward throw.
- Audio mix unknown.

## Next objectives (suggested order)
1. Human playtest on a real phone (APK / Artifact) → tune controls, hitstop, damage, meter, touch layout.
2. Product-owner decisions: final bundle id, hosting for a signaling/matchmaking server (and TURN), art direction for final characters.
3. Online v2: signaling server + quick match, TURN, adaptive input delay, rematch, spectator-safe replays (input logs exist).
4. Art pipeline: glTF skinned character import mapped onto the joint/pose system; first production character.
5. Content: more cards per fighter, third fighter, second arena; training mode recording/playback.
6. Accounts/progression/store/creator codes only after the combat is proven fun.
