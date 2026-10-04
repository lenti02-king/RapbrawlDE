# RAPBRAWL — agent guide

Competitive 2.5D fighting game (German rap / creator culture), mobile-first (iOS/Android), web tech.
Product owner defines WHAT; the agent owns HOW. Read `docs/STATUS.md` first — it is the live state.

## Docs map
- `docs/STATUS.md` — what works / verified / unverified, known issues, next objectives. **Update at end of every session.**
- `docs/DECISIONS.md` — architecture decision log (engine, perspective, netcode, …). Append, don't rewrite history.
- `docs/DESIGN.md` — combat design: controls, mechanics, frame-data conventions, cards, fighters.

## Commands
```
npm install
npm run dev            # vite dev server :5173 (add --host for phones on LAN)
npm test               # vitest: sim, determinism, rollback netcode
npm run typecheck
npm run build          # tsc + vite build -> dist/
npm run e2e            # Playwright E2E against BASE_URL (default localhost:5173); start dev server first
node scripts/play.mjs basic|super   # scripted gameplay screenshots -> artifacts/
node scripts/shot.mjs "/?lab=poses&pose=crouch" out.png   # pose lab screenshot
node scripts/moves.mjs volt|brick   # every move at first active frame + hitbox overlay -> contact sheet
node scripts/cine.mjs volt|brick    # frame-accurate signature cinematic capture
node scripts/ko.mjs                 # KO -> round over -> next round capture
node scripts/netplay.mjs 60         # two pages play online (same-device transport, 60 ms lag), checksums compared
npx tsx scripts/botmatch.ts 120 hard   # headless bot-vs-bot balance probe
node scripts/single-file.mjs out.html  # one self-contained HTML page (used for the claude.ai Artifact)
```
Published preview (private Artifact): https://claude.ai/artifact/QxFGw7nin7xvWrdnmQZuiv — republish by publishing the single-file output again.
Headless Chromium uses SwiftShader (software GL): visuals are verifiable, FPS numbers are NOT representative.
Useful URLs: `/?quick=volt,brick&mode=cpu|local|training|demo`, `/?touch=1` (force touch UI), `/?lab=poses&pose=<name>&zoom=2`.
Debug API in browser console: `window.__rb` (App: `.runner.state`, `.debugHoldP1(bits, frames)`, `.view.debug = true` for hitboxes).

## Architecture (src/)
- `core/` — **deterministic simulation**. Integer math only (`math.ts` units: 10000 = 1 m, 60 Hz frames).
  NO floats-from-trig, NO `Math.random`, NO `Date`, NO DOM/three imports. State is plain JSON data (`state.ts`).
  `sim.ts` `step(state, [p1Bits, p2Bits]) -> events`. `registry.ts` looks up content by id.
- `content/` — fighters as data (frame data, hitboxes in meters via `build.ts` helpers, cards, cinematic hit timings).
- `net/rollback.ts` — GGPO-style rollback session + simulated link + BroadcastChannel transport.
- `net/online.ts` — NetMatchRunner (rollback inside the real loop), lobby handshake, WebRTC copy/paste transport.
- `render/` — presentation only (reads state, never writes): `view.ts` (GameView), `rig.ts` (procedural toon humanoid),
  `characters.ts` (looks), `anims/*` (pose clips keyed to move frames), `animator.ts` (state -> pose),
  `cinematics.ts` (signature super timelines keyed to sim cine frame), `camera.ts`, `vfx.ts`, `arena.ts`.
- `audio/audio.ts` — procedural Web Audio SFX + generative music (no external assets).
- `input/` — keyboard/gamepad/touch sources -> input bitmask (`core/input.ts`).
- `ai/bot.ts` — CPU opponent (InputSource; seeded RNG; reads state with reaction delay).
- `app/` — `app.ts` screens/flow, `match.ts` fixed-step runner, `training.ts` readouts. `ui/` HUD + CSS.

## Conventions
- New fighter = `src/content/<id>.ts` (sim data) + `src/render/anims/<id>.ts` + visual in `render/characters.ts`; register in `content/index.ts` and `render/animator.ts` ANIM_SETS.
- Move frame data: `startup` = first active frame (1-based); `total = startup - 1 + active + recovery`.
- Sim changes MUST keep `npm test` green (determinism + rollback tests). Add a test for new mechanics.
- Presentation may lag/blend; gameplay truth is the sim. Hitboxes are authored in sim content, poses must visually match (check with hitbox overlay: F1 / training H).
- Card rarity must never change power (competitive integrity). Max 1 Signature per loadout (`registry.ts`).
- Placeholder art/audio is procedural and original. Never add copyrighted likenesses, music or logos.
- Verify visually with Playwright screenshots before claiming a visual feature works. Report honestly (VERIFIED vs UNVERIFIED).
- Commit at working checkpoints on the session's designated branch; push with `git push -u origin <branch>`.
