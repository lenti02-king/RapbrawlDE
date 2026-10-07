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
node scripts/cine.mjs jazeek|bonez|croc|car|blunt [f1,f2,..]  # frame-accurate cinematic capture (croc/car = Bonez' grabbing specials, blunt = Jazeek's)
node scripts/introshot.mjs [f1,f2,..]   # round-1 fighter showcase (emote, face close-up, name) at intro frames -> artifacts/intro
node scripts/specials.mjs           # special-move VFX/props sheet (voice wave, spotlight, croc, smoke, grin)
node scripts/ui.mjs                 # menu flow + HUD screenshots, desktop and phone landscape -> artifacts/ui
EXTRA="&glb=jazeek:test-models/Xbot.glb" node scripts/moves.mjs jazeek   # test a GLB model (public/test-models is gitignored)
node scripts/ko.mjs                 # KO -> round over -> next round capture
node scripts/netplay.mjs 60         # two pages play online (same-device transport, 60 ms lag), checksums compared
npx tsx scripts/botmatch.ts 120 hard   # headless bot-vs-bot balance probe
node scripts/single-file.mjs out.html  # one self-contained HTML page (used for the claude.ai Artifact)
node scripts/vfx.mjs [low|medium|high]  # frame-accurate hit-VFX capture sheet -> artifacts/vfx
node scripts/mechanics.mjs duel|splat|fatality|fatality-bonez [every] [q]  # session 8 mechanics in-game (F=jazeek,jazeek for a duel)
node scripts/hudshot.mjs out.png [w] [h] [touch]   # one in-game frame with the HUD
node scripts/handshot.mjs jazeek move:jaz_5L:6 out.png [haL|haR]   # hand close-up (fist/thumb checks; EXTRA="&thz=..&thx=..")
node scripts/cards.mjs              # deck screens of both fighters (card art)
node scripts/arena-thumbs.mjs       # arena select thumbnails -> src/ui/img/arena-<id>.jpg
node scripts/audio-render.mjs [secs]   # offline render of the beat + SFX -> artifacts/audio (levels printed)
python3 tools/ui-extract/main_menu.py   # cut the PO master screenshot into menu sprites + src/ui/menu/mainMenuArt.ts (setup: tools/ui-extract/README.md)
node scripts/menushot.mjs [out]      # main menu at 2000x1125 + phones in landscape; compare: python3 tools/ui-extract/compare.py
python3 tools/ui-extract/loading.py|char_select.py|arena_select.py|shop.py   # the other master screens (same pipeline)
node scripts/loadshot.mjs | selectshot.mjs | shopshot.mjs [out]   # captures of those screens (2000x1125 + phones)
node scripts/flowshot.mjs out 750 300 && node scripts/screens.mjs out 750 300   # iPhone in a browser/viewer (~750x300): menu flow + classic screens (D41)
python3 tools/ui-extract/skin_backdrop.py   # stadium backdrop without the baked logo for the classic screens
python3 tools/meshy/reduce.py jazeek|bonez  # game copy of the PO's textured model (.cache/meshy2/<id>_src.glb): 120k tris, 4K/2K textures
python3 tools/meshy/skin.py jazeek --src .cache/meshy2/jazeek_std_src.glb --out public/assets/characters/jazeek.glb  # rig without re-export
python3 tools/arena/podcast.py preview|bake # podcast arena: Cycles preview / bake -> public/assets/arena/podcast (~10 min on CPU)
node scripts/arena-shot.mjs artifacts/arena/x high ["&arena=festival|bahnhof"]   # in-game arena shots at close/mid/wide fighter distance
python3 tools/arena/plates.py festival|bahnhof   # PO painting (tools/arena/ref/, git-ignored) -> backdrop plate + floor tile + meta, real names replaced
node scripts/crowdshot.mjs "style=hipster|rocker&t=1.1&n=1&zoom=1.6" out.png   # crowd close-up from ?lab=crowd
python3 tools/meshy/props.py [id ..]   # PO prop models (.cache/props, release modelle-2) -> public/assets/props/<id>.glb at real size; check in ?lab=props&ids=..
node scripts/filmstrip.mjs jazeek walkF,jaz_5L,hit,"seq:F*12.l*2._*20" [every] [q]   # in-game frame strips (GIF=1 CROP=full for an animated GIF)
node scripts/posesheet.mjs bonez "move:bon_5H:1-35:2"   # authored clip frames straight from the lab (no sim/blending)
node scripts/posesheet.mjs jazeek "cine:jaz_99:4-160:8"  # cinematic attacker clip frames (cinedef:<id>:<f> = victim clip; root x/y zeroed, &cineroot=1 keeps them)
node scripts/reach.mjs jazeek|bonez   # fist/foot position at the first active frame vs. the sim hitbox (run after editing strikes)
node scripts/glb-to-json.mjs in.glb out.gltf.json [--external-images]   # Artifact host does not serve .glb (images as separate files keep each file < 15 MB)
node scripts/artifact-check.mjs     # build the Artifact payload into dist-single/ (page + assets/**) and assert models AND arena load under an Artifact-like CSP (run before every publish)
tools/characters/fetch-data.sh && python3 tools/characters/build.py bonez|jazeek   # rebuild the fighter models (Blender bpy)
python3 tools/ui-extract/v2_home.py|v2_select.py|v2_arena.py|v2_vs.py|v2_loading.py|v2_fighters.py|v2_custom.py|v2_lobby.py   # design v2 art from the PO masters (tools/ui-extract/ref/v2/, git-ignored) -> public/assets/ui2 + src/ui/v2/art (D42)
node scripts/v2shot.mjs "showHome()" artifacts/v2/home "1672x941,932x430"   # v2 screen captures (any window.__rb call)
node scripts/webkit.mjs "/?ui=v2" out.png 932 430 30000 "window.__rb.showHome()"   # WebKit engine (WebKitGTK via WebDriver; DPR=3 XSCREEN=3000x1600x24 for retina)
python3 tools/characters/cutout.py manuellsen|lacazette   # 2D cutout fighters from the PO's cartoon references (D42)
node scripts/rainshot.mjs           # Diamanten-Regen capture sheet -> artifacts/rain
node scripts/posegrid.mjs jazeek out.png '<PoseDef json>' ...   # menu pose iteration (POSE=stance|showcase, YAW=deg)
node scripts/blunt-measure.mjs 72,78   # Blunt cinematic geometry probe: victim joints vs. the joint axis (no screenshots)
BIG=1 node scripts/arena-thumbs.mjs festival,bahnhof,podcast   # full-screen arena renders for the v2 arena screen
python3 tools/meshy/reduce.py jazeek --dir meshy3 && python3 tools/meshy/skin.py jazeek --dir meshy3   # modelle-3 fighters (D43; landmarks tools/meshy/<id>_cr.py)
python3 tools/meshy/grid.py model.glb artifacts/meshy3/jazeek_std   # ortho front/side renders with a grid (landmark placement)
python3 tools/meshy/jointshot.py jazeek artifacts/meshy3/jazeek_std   # the skin.py skeleton drawn over those renders
python3 tools/ui-extract/depth.py [screen ..]   # MiDaS depth per v2 plate -> public/assets/ui2/<screen>/depth.webp (living plates, D43)
python3 tools/ui-extract/v2_fight_btn.py   # KÄMPFEN button re-cut with chains, FIGHT lettering removed by LaMa
python3 tools/ui-extract/v2_ring.py && python3 tools/ui-extract/depth.py ring   # ring backdrop (loading master without logo) for the v2 profile/settings/deck
node scripts/livingshot.mjs "showHome()" artifacts/s11/living   # living plate frames a moment apart + diff (motion check)
Q=medium node scripts/cine.mjs sofa|gwagon|99|team|blunt [f1,f2,..]   # D43 signatures (Q = quality; long runs: BASE_URL=:5174 NO_HMR server)
node scripts/v2match.mjs artifacts/v2b/match 932x430   # v2 fight HUD, pause and results over the arena
node scripts/v2shot.mjs "showProfile()" artifacts/v2b/profile "1672x941,932x430"   # v2 ring screens (also showSettings(), showDeck(0, ()=>0))
```
Long capture queues: a second dev server without HMR (`NO_HMR=1 npx vite --port 5174`, restart it after edits) keeps
source edits from reloading a running capture; the HMR server on 5173 reloads open pages on every edit.
Published preview (private Artifact): https://claude.ai/artifact/QxFGw7nin7xvWrdnmQZuiv — run `node scripts/artifact-check.mjs`, then publish `dist-single/rapbrawl.html` with `rapbrawl.js` (+ changed files under `dist-single/assets/`) as supporting files (D41: the inline single page is refused by the host's check).
Headless Chromium uses SwiftShader (software GL): visuals are verifiable, FPS numbers are NOT representative.
Quality tiers: `?q=low|medium|high` (phones default medium, desktop high). Phones also get a texture budget and one shared menu GL context (D41, `render/textureBudget.ts`; `?tex=1024` test hook). Functional tests use `q=low` (full pipeline is too slow in SwiftShader).
Fighter models (D43): `public/assets/characters/<id>.glb` = the PO's modelle-3 models for all four fighters (Jazeek, Bonez, Manuellsen, Lacazette), cel look
(`render/cel.ts`: MeshToonMaterial + ink outline; `?toon=0` = flat PBR), reach fit per move (`render/anims/reach.ts`). Older notes: the PO's textured Meshy models used 1:1 (reduced copy + skin, D28;
sources not in git, see `public/assets/characters/README.md`; landmarks in `tools/meshy/<id>_cr.py`). Older pipelines: `tools/meshy/build.py`, `tools/cartoon`, `tools/characters`.
Default arena: podcast studio (`src/render/arenas/podcast.ts`, baked by `tools/arena/podcast.py`, D29); `?arena=festival|bahnhof` = the PO's paintings as backdrop + 3D floor + instanced crowd (`arenas/painted.ts`, `crowd.ts`, D40); `?arena=courtyard|club|toon` for the old ones.
Props (D40): the PO's Meshy props in `public/assets/props/` (`render/propModels.ts`, procedural fallback); hand-held ones via `render/handProps.ts` (grips per prop).
Any Mixamo-named humanoid GLB can replace them — see `docs/ASSETS.md`. Debug stepping for captures: `__rb.debugHold = true; __rb.debugAdvance(n)`.
Lab portrait framing: `/?lab=poses&a=bonez&frame=face|bust|body|hand&hide=other` (window.__lab for debugging).
Design (D42): two designs in the code — v2 (default, `src/ui/v2/`, PO's second master set) and v1 (D38 screens); `?ui=v1|v2` or EINSTELLUNGEN → DESIGN; v1 snapshot = commit c0e46a0 (local tag `design-v1`). Cinematics run at half speed (`RULES.CINE_RATE`).
D45 (iPhone round): phones load `<id>.m.glb` (mobile LOD); the living plate checks its first draw (`data-living=ok|fail|lost`, `?livingfail` test hook);
fight lights are fixed slots (cinematic lights virtual, layer 31) and `GameView.prewarm()` compiles before the round; leg IK `glbRig.plantFeet`;
sim mechanics `VelocityKey.warp` / `HitDef.reverse`; touch controls in `input/touch.css`; FREUNDE screen `ui/v2/friends.ts`.
D43: v2 menus are living plates (`ui/v2/living.ts`, `?still` = static); profile/settings/deck/results/pause in v2 = `ui/v2/ring.ts` (+ `ring.css`), v2 HUD skin `ui/v2/hud2.css`; new abilities in `render/abilities11.ts`, cinematics `render/cines11.ts`, clips `render/anims/roster11.ts`.
UI (D38): the PO's master screenshots are the source — art is cut from their pixels (`tools/ui-extract/`), text is native German; screens in `src/ui/menu/` (mainMenu, loading, charSelect, arenaSelect, shop; shared `kit.ts/.css`; generated `*Art.ts`; sprites in `src/ui/img/<screen>/`). Older screens: `src/ui/street.css` + `src/ui/street.ts` (night-street menus, logo, stage/city art, D34) and `src/ui/hud.css` (HUD, D37) load last, over `src/ui/cr.css`, `src/ui/theme.css`, `src/ui/toon-icons.ts` (filled menu icons), `src/ui/lines.ts` (line icons), `src/ui/portraits.ts` (hero/card/bust/card-art renders).
Music: `public/assets/music/<fighter>.mp3` / `bgm.mp3` drop-ins (git-ignored, README there, D33/D37); default = original stingers + the procedural 90 BPM beat in `audio.ts` (the sim's beat clock is the truth, RULES.BEAT_FRAMES).
Fight intro, charge, fatality minigame, grabbing projectiles, blood, smooth cinematic clips: D39 (`src/render/emotes.ts`, `smoothClip` in `render/pose.ts`, `ToonFX.blood`).
Flow (D34): home (modes) → `showCharSelect` → `showArenaSelect` → `launch()` (loading screen) → `startMatch`. Mechanics (D35): `s.duel`, `wallSplat`, `beatDistance`, phase `finish` + `s.fatal`; fatalities in `render/fatalities.ts`.
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
