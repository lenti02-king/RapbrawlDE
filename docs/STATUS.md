# Project status

_Last updated: 2026-10-03 (session 1)._ Legend: **VERIFIED** = observed working via automated test or screenshot; **BUILT** = compiles/builds, not exercised; **UNVERIFIED** = implemented, not checked; **BLOCKED** = needs something outside the agent's control.

## Playable vertical slice — state
| Area | Status | Evidence |
|---|---|---|
| Deterministic combat sim (movement, dash, jump, normals, chains, specials, throws/tech, block high/low, juggles, armor, counters, projectiles, KO/rounds/time-over) | VERIFIED | `tests/combat.test.ts` (25 tests incl. exact 5f startup, high/low/overhead, throw tech, chain combo, determinism, rollback snapshot, soak) |
| Two original fighters VOLT / BRICK, 6 cards each, 1 Signature each | VERIFIED (sim) / VERIFIED visually for normals + Headliner | tests + `scripts/moves.mjs` hitbox sheets + `scripts/play.mjs super` |
| Card loadout (equip 3 of 6, max 1 Signature) | VERIFIED | E2E: custom loadout reaches the match |
| Cinematic signature: VOLT "Headliner" | VERIFIED | screenshots (super flash → letterboxed flurry → launch → slam → knockdown), damage = sim |
| Cinematic signature: BRICK "Security!" (with security guards) | VERIFIED in sim; presentation UNVERIFIED by screenshot | unit test `Security! cinematic from BRICK` |
| Arena "Main Stage" (LED wall shader, truss/beams, crowd, speakers) | VERIFIED (screenshots) | |
| HUD (health+drain, hype bars, timer, round pips, combo counter, announcer, card banners, letterbox) | VERIFIED (screenshots) | |
| Hit feel (hitstop + shake, sparks, rings, flashes, camera shake/kick/FOV punch, KO slow-mo) | VERIFIED visually (static frames) | feel/timing on a real device UNVERIFIED |
| Procedural audio (SFX, crowd, generative beat) | BUILT, UNVERIFIED (no audio output in headless tests) | |
| Menus: title, menu, fighter select, loadout, pause, results, rematch, how-to-play | VERIFIED | `npm run e2e` |
| CPU bot (3 levels) + live demo fight behind menus | VERIFIED runs; quality UNVERIFIED by humans | |
| Training mode (dummy modes, hitboxes, startup/advantage readout, reset) | VERIFIED partially (screenshots) | |
| Keyboard (2 players), gamepad | Keyboard VERIFIED (E2E), gamepad UNVERIFIED | |
| Touch controls (floating stick, L/H/Grab/Block, 3 card buttons) | VERIFIED in emulated iPhone 13 landscape (Chromium) | real iOS Safari / Android WebView UNVERIFIED |
| Rollback netcode core | VERIFIED in simulation | `tests/netcode.test.ts`: two peers over simulated latency/jitter/loss, checksums match reference |
| Online play in the app (UI, transport, matchmaking) | NOT BUILT | menu shows "coming soon" |
| Capacitor Android/iOS projects (landscape, fullscreen) | GENERATED; Android APK build via CI UNVERIFIED until CI run; iOS BLOCKED (needs macOS/Xcode + Apple account) | `.github/workflows/android.yml` |
| Performance 60 FPS on phones | UNVERIFIED | Headless SwiftShader only; ~170 draw calls / ~100k tris per frame |

## Known issues / risks
- Draw calls (~170) are high-ish for low-end Android; merge static rig parts per joint if needed.
- Procedural characters read as stylized placeholders; final art pipeline (glTF rigs) not started.
- Bot is reactive but simple; can be exploited.
- Balance untuned beyond sanity (BRICK damage high, VOLT meter build).
- Audio never listened to by a human; levels may need mixing.
- Rollback at very high ping (>120 ms) stalls; adaptive input delay not implemented.
- Back throws reposition the victim behind the thrower but the victim animation assumes a forward throw.

## Next objectives (suggested order)
1. Human playtest on real phones (Pages URL / APK) → tune controls, hitstop, damage, meter gain.
2. Online: WebRTC DataChannel transport + simple signaling/matchmaking (needs a hosting decision), adaptive input delay.
3. Performance pass for mid/low-end Android (merge meshes, quality tiers, frame-time HUD).
4. Art pipeline: glTF skinned character import mapped onto the joint/pose system; first real character model.
5. More cards per fighter, third fighter, second arena; replays (input logs already recorded).
6. Accounts/progression/store/creator codes only after the combat is proven fun.
