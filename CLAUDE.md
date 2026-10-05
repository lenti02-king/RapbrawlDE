# RAPBRAWL — agent guide

Competitive 2.5D fighting game (German rap / creator culture), mobile-first (iOS/Android), web tech.
Product owner defines WHAT; the agent owns HOW. Read `docs/STATUS.md` first — it is the live state.

## Docs map
- `docs/STATUS.md` — what works / verified / unverified, known issues, next objectives. **Update at end of every session.**
- `docs/DECISIONS.md` — architecture decision log (engine, perspective, netcode, …). Append, don't rewrite history.
- `docs/DESIGN.md` — combat design: controls, mechanics, frame-data conventions, cards, fighters.
- `docs/ASSETS.md` — asset specs for the product owner (character models, card art, rights).

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
node scripts/moves.mjs jazeek|bonez # every move at first active frame + hitbox overlay -> contact sheet
node scripts/cine.mjs jazeek|bonez [f1,f2,..]  # frame-accurate signature cinematic capture
node scripts/specials.mjs           # special-move VFX/props sheet (voice wave, spotlight, croc, smoke, grin)
node scripts/ui.mjs                 # menu flow + HUD screenshots, desktop and phone landscape -> artifacts/ui
EXTRA="&glb=jazeek:test-models/Xbot.glb" node scripts/moves.mjs jazeek   # test a GLB model (public/test-models is gitignored)
node scripts/ko.mjs                 # KO -> round over -> next round capture
node scripts/netplay.mjs 60         # two pages play online (same-device transport, 60 ms lag), checksums compared
npx tsx scripts/botmatch.ts 120 hard   # headless bot-vs-bot balance probe
node scripts/single-file.mjs out.html  # one self-contained HTML page (used for the claude.ai Artifact)
node scripts/vfx.mjs [low|medium|high]  # frame-accurate hit-VFX capture sheet -> artifacts/vfx
python3 tools/meshy/reduce.py jazeek|bonez  # game copy of the PO's textured model (.cache/meshy2/<id>_src.glb): 120k tris, 4K/2K textures
python3 tools/meshy/skin.py jazeek --src .cache/meshy2/jazeek_std_src.glb --out public/assets/characters/jazeek.glb  # rig without re-export
python3 tools/arena/podcast.py preview|bake # podcast arena: Cycles preview / bake -> public/assets/arena/podcast (~10 min on CPU)
node scripts/arena-shot.mjs artifacts/arena/x high   # in-game arena shots at close/mid/wide fighter distance
node scripts/filmstrip.mjs jazeek walkF,jaz_5L,hit,"seq:F*12.l*2._*20" [every] [q]   # in-game frame strips (GIF=1 CROP=full for an animated GIF)
node scripts/posesheet.mjs bonez "move:bon_5H:1-35:2"   # authored clip frames straight from the lab (no sim/blending)
node scripts/reach.mjs jazeek|bonez   # fist/foot position at the first active frame vs. the sim hitbox (run after editing strikes)
node scripts/glb-to-json.mjs in.glb out.gltf.json [--external-images]   # Artifact host does not serve .glb (images as separate files keep each file < 15 MB)
node scripts/artifact-check.mjs     # build the Artifact payload into dist-single/ (page + assets/**) and assert models AND arena load under an Artifact-like CSP (run before every publish)
tools/characters/fetch-data.sh && python3 tools/characters/build.py bonez|jazeek   # rebuild the fighter models (Blender bpy)
```
Published preview (private Artifact): https://claude.ai/artifact/QxFGw7nin7xvWrdnmQZuiv — republish by publishing the single-file output again.
Headless Chromium uses SwiftShader (software GL): visuals are verifiable, FPS numbers are NOT representative.
Quality tiers: `?q=low|medium|high` (phones default medium, desktop high). Functional tests use `q=low` (full pipeline is too slow in SwiftShader).
Fighter models: `public/assets/characters/<id>.glb` = the product owner's textured Meshy models used 1:1 (reduced copy + skin, D28;
sources not in git, see `public/assets/characters/README.md`; landmarks in `tools/meshy/<id>_cr.py`). Older pipelines: `tools/meshy/build.py`, `tools/cartoon`, `tools/characters`.
Default arena: podcast studio (`src/render/arenas/podcast.ts`, baked by `tools/arena/podcast.py`, D29); `?arena=courtyard|club|toon` for the old ones.
Any Mixamo-named humanoid GLB can replace them — see `docs/ASSETS.md`. Debug stepping for captures: `__rb.debugHold = true; __rb.debugAdvance(n)`.
Lab portrait framing: `/?lab=poses&a=bonez&frame=face|bust|body|hand&hide=other` (window.__lab for debugging).
UI: `src/ui/cr.css` (cartoon menu look + home/title, loaded last, D32) over `src/ui/theme.css`, `src/ui/toon-icons.ts` (filled menu icons), `src/ui/lines.ts` (line icons), `src/ui/portraits.ts` (hero/card/bust/card-art renders).
Signature music: `public/assets/music/<fighter>.mp3` only when licensed (README there, D33); default = original stingers in `audio.ts`.
Useful URLs: `/?quick=jazeek,bonez&mode=cpu|local|training|demo` (any registered id, incl. hidden volt/brick), `/?touch=1` (force touch UI), `/?lab=poses&a=jazeek&b=bonez&pose=<name>&zoom=2&teeth=1`.
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
  `stylized.ts` (Jazeek/Bonez faces, hair, outfits), `cinematics.ts` (runtime + VOLT/BRICK) and `cines.ts`
  (Herzbrecher, Palmen-Bassdrop) keyed to the sim cine frame, `props.ts` (hearts, croc, palms, spotlight, sprites),
  `specials.ts` (in-match special VFX, gold teeth, win flourishes), `camera.ts`, `vfx.ts`,
  `arenas/podcast.ts` (default, baked podcast studio), `arenas/courtyard.ts` (realistic courtyard), `arenas/hinterhof.ts` (old toon version),
  `arena.ts` (club stage), `post.ts` (post-processing + quality tiers), `textures.ts` (procedural PBR sets),
  `glbRig.ts` (GLB character import + pose retargeting).
- `audio/audio.ts` — procedural Web Audio SFX + generative music (no external assets).
- `input/` — keyboard/gamepad/touch sources -> input bitmask (`core/input.ts`).
- `ai/bot.ts` — CPU opponent (InputSource; seeded RNG; reads state with reaction delay).
- `app/` — `app.ts` screens/flow (home showcase, fighters, deck, help, pause, results, online), `match.ts` fixed-step runner,
  `training.ts` readouts. `ui/` — `hud.ts` (HUD + card hand, JS tweens), `icons.ts` (original SVG card/UI icons),
  `portraits.ts` (menu portraits rendered from the rigs), `style.css` (design tokens, chunky buttons). All UI text is German.

## Conventions
- New fighter = `src/content/<id>.ts` (sim data) + `src/render/anims/<id>.ts` + visual in `render/characters.ts`/`stylized.ts`; register in `content/index.ts` (+ `ROSTER`) and `render/animator.ts` ANIM_SETS; card icons in `ui/icons.ts`; signature presentation in `render/cines.ts`.
- Move frame data: `startup` = first active frame (1-based); `total = startup - 1 + active + recovery`.
- Animation (D30): author strikes with `strike()` (anims/motion.ts) and aim striking limbs with `PoseDef.aim` (directions in
  character space: x toward the opponent, y up, z toward the camera) instead of raw shoulder/hip angles; use `s` for
  stretch/squash. Keep fists/feet on the hitbox (`node scripts/reach.mjs`).
- Sim changes MUST keep `npm test` green (determinism + rollback tests). Add a test for new mechanics.
- Presentation may lag/blend; gameplay truth is the sim. Hitboxes are authored in sim content, poses must visually match (check with hitbox overlay: F1 / training H).
- Card rarity must never change power (competitive integrity). Deck = 2 specials + 1 Signature in slot 3 (`registry.ts`).
- Placeholder art/audio is procedural and original. Never add third-party logos/music. Real people (Jazeek, Bonez MC) are in the
  roster at the product owner's request; their likeness/name rights must be cleared by the product owner before release.
- Paid generative tools (Higgsfield MCP): do not spend credits without explicit product-owner approval.
- Verify visually with Playwright screenshots before claiming a visual feature works. Report honestly (VERIFIED vs UNVERIFIED).
- Commit at working checkpoints on the session's designated branch; push with `git push -u origin <branch>`.
