# Project status

_Last updated: 2026-10-04 (session 4: fighters from the product owner's Meshy sculpts, cartoon VFX, target combos, plain start menu)._
Legend: **VERIFIED** = observed working via automated test or screenshot; **BUILT** = compiles/builds, not exercised; **UNVERIFIED** = implemented, not checked; **BLOCKED** = needs something outside the agent's control.

## How to play right now
- Private claude.ai Artifact (single-file build, owner-only until shared, version 7 = session 4 + model-loading fix): https://claude.ai/artifact/QxFGw7nin7xvWrdnmQZuiv
- Android debug APK: GitHub → Actions → "Android debug APK" → latest run → artifact `rapbrawl-debug-apk` (needs "install unknown apps").
- Local: `npm install && npm run dev`.

## Session 4 — Meshy fighters, VFX, combos, plain menu (product owner: "Klötze/Stickmans", more combos, better VFX, menu outside the arena)
| Area | Status | Evidence |
|---|---|---|
| Interim cartoon fighters (`tools/cartoon`, metaball "clay" in Blender) after the PO chose "Cartoon wie Clash Royale" | SUPERSEDED the same session by the PO's own Meshy sculpts (kept as a pipeline) | `python3 tools/cartoon/build.py jazeek` |
| **Jazeek + Bonez MC from the PO's Meshy sculpts** (`tools/meshy`): painted skin/face/eyes/brows/beard/hair/clothes/chains/tattoos, AO, 50k tris, 2048 albedo + normal + ORM, rig, fists, ~3.4 MB GLB each | VERIFIED (Blender previews, in-engine close-ups, match screenshots) | `python3 tools/meshy/build.py jazeek|bonez`, `artifacts/meshy/` |
| Moves + hitbox overlap with the new models (height-fitted to 1.8 m / 2.0 m) | VERIFIED (contact sheets: jab, heavy, Drehkick, low kick, Bonez punches reach their boxes) | `node scripts/moves.mjs jazeek|bonez` |
| Likeness | PARTIAL: as good as the PO's sculpts; colours/hair/beard/eyes painted by rules, faces not hand-painted | |
| Menus outside the arena: start screen/lobby/select are plain UI, the 3D scene is created on the first match | VERIFIED (E2E checks "home screen is a plain menu") | `npm run e2e` |
| Target combos L·L·L / H·H per fighter (Drehkick, Encore-Haken, Ellbogen-Crash, Abrissbirne), listed in STEUERUNG | VERIFIED (unit tests + help screenshot desktop/phone) | `tests/fighters.test.ts` |
| Cards only for abilities + Signature; punches/kicks are buttons | VERIFIED (unchanged design, stated in help) | |
| Cartoon VFX: impact stars, speed lines, smears, toon dust, cracks, rubble, impact frames (setting BLITZEFFEKTE) | VERIFIED (frame-accurate capture sheet) | `node scripts/vfx.mjs` |
| **Bug: the Artifact never showed the GLB models** (CSP blocks fetch of data:/blob: URLs; loading failed silently -> placeholders). Fix: `.gltf.json` rebuilt as GLB bytes in memory, textures decoded via `<img>`, 60 s load wait with "LADE KÄMPFER …", visible note if models fail, menus re-render if models arrive late | VERIFIED under an Artifact-like CSP (fighter select + match show the new models); Artifact v7 published, live check by the PO pending | `node scripts/artifact-check.mjs` |
| Arena in cartoon style (task from the cartoon direction) | NOT DONE: the realistic courtyard stays; with realistic fighters it fits again | |
| Cost of the new fighters | VERIFIED in SwiftShader only: 2×50k skinned tris + 2048 textures, 62 draw calls; low-tier probe 433 ms/frame (was ~240 ms with the cartoon fighters, software GL). Phone FPS UNVERIFIED | E2E PERF line |

## Session 2 summary (product-owner request: precise controls, findable Signature, real start menu, Clash-Royale-inspired look, real roster)
| Area | Status | Evidence |
|---|---|---|
| Roster: **Jazeek** and **Bonez MC** replace the VOLT/BRICK placeholders (kept hidden for tests/dev) | VERIFIED (sim + tests + screenshots) | `tests/fighters.test.ts`, `scripts/specials.mjs`, `scripts/cine.mjs jazeek|bonez` |
| Jazeek kit: Stimmwelle, Spotlight-Dash (pass-through), Rhythmus-Konter (catches lows), MVP-Kombo, **Herzbrecher** (Signature cinematic) | VERIFIED | unit tests + capture sheets |
| Bonez kit: Krokodil-Schnapper (2.2 m reach, readable 20f wind-up), Rauchwand (projectile-absorbing barrier, gold glint keeps him readable), Abriss (armor), Goldzahn-Grinsen (meter), **Palmen-Bassdrop** (low Signature cinematic) | VERIFIED | unit tests + capture sheets |
| Equal strength | VERIFIED by bot probe only: 240 bot matches (hard), Jazeek ≈ 49.5 % / Bonez ≈ 50.5 % across both sides | `npx tsx scripts/botmatch.ts 60 hard` |
| Deck rule 2 Specials + 1 Signature (fixed gold slot 3, key O / golden card) | VERIFIED | unit test + E2E |
| Precise controls: forward+Heavy no longer becomes an overhead; SOCD cleaning; touch stick = 8 sectors with wide horizontals, deadzone + hysteresis, direction dots; buttons keep holds when the finger drifts | VERIFIED (unit test + E2E: stick 18° above horizontal walks without jumping) | `tests/touch.test.ts`, E2E |
| Signature discoverability: gold card in the HUD hand (tappable on touch, key hint O on desktop), charge fill, pulsing when ready, "★ SIGNATURE BEREIT!" banner + chime, help screen | VERIFIED (screenshots + E2E fires it by key O and by tapping the card) | `artifacts/e2e`, `artifacts/ui` |
| Bug found + fixed: on touch devices a full-screen overlay swallowed taps on the HUD cards and pause button | VERIFIED fixed (E2E) | |
| Stylized "chunky" characters (faces, curls, outfits, tattoos, chains, Bonez gold teeth prop) | VERIFIED (screenshots) | `/?lab=poses&a=jazeek&b=bonez&zoom=2` |
| Arena "Hinterhof – Block Beats" (courtyard, balconies with fans, string lights, graffiti, stage, crates, scooter) | VERIFIED (screenshots) | old "Main Stage" still available as `GameView(canvas,'club')` |
| Signature cinematics with props: Herzbrecher (spotlight, notes, hearts, heart breaks on finisher), Palmen-Bassdrop (sunset + palms rise, bass lifts, slam, crocodile snaps) | VERIFIED frame-by-frame | `node scripts/cine.mjs jazeek|bonez` |
| New UI (German): title, home with 3D fighter showcase, fighter select with rendered portraits + stats, deck builder, controls help, VS intro, HUD with avatars/crowns/card hand/Hype bar, pause, results, online lobby | VERIFIED (screenshots desktop + phone landscape, E2E) | `node scripts/ui.mjs`, `npm run e2e` |
| Online (same-device test) after the UI rework | VERIFIED: 60 ms lag, 8 confirmed checksums equal, rollbacks occurred | `node scripts/netplay.mjs 60` |
| Audio: new procedural cues (sung notes, chime, bass drop, croc snap, smoke) | BUILT, UNVERIFIED (never heard by a human) | |
| Real-device feel / FPS | UNVERIFIED (headless SwiftShader only; 42 draw calls, ~72k triangles per frame) | |

## Session 2b — realism pass (product owner: "Unreal-Engine-realistisch wie die Referenzen")
| Area | Status | Evidence |
|---|---|---|
| Rendering: MSAA HDR + bloom + colour grade + vignette, real-time shadows, dusk-sky image-based lighting, quality tiers (`?q=low|medium|high`, phones default to medium) | VERIFIED (screenshots) | `src/render/post.ts`, `view.ts` |
| Procedural PBR materials (asphalt, plaster with peeling, brick, shutters, wood, concrete, window atlas) | VERIFIED (screenshots) | `src/render/textures.ts` |
| Courtyard arena rebuilt after the reference image (default arena) incl. planar reflections on wet asphalt (high tier) | VERIFIED (screenshots); real-device FPS UNVERIFIED (high ≈150 draw calls/≈225k tris, medium ≈100/≈150k per frame) | `src/render/arenas/courtyard.ts` |
| Real character models: `public/assets/characters/<id>.glb` (Mixamo skeleton) drive all poses via retargeting | VERIFIED with two Mixamo test models (not in repo): stance, every move, hitbox overlap | `src/render/glbRig.ts`, `EXTRA=... node scripts/moves.mjs` |
| Photoreal Jazeek / Bonez models | BLOCKED: need models from the product owner (spec in `docs/ASSETS.md`); placeholders are procedural. The Higgsfield connector available to the agent in session 2 had no image→3D or image-generation tool (only scene builder / ads), so the models cannot be made from here | |
| Painted card art drop-in (`public/assets/cards/<id>.webp`) | BUILT, UNVERIFIED (no art yet) | |
| Headless tests run at `q=low` (SwiftShader is too slow for the full pipeline). `low` = Lambert arena, no IBL, light-pool decals instead of local lights (≈2× cheaper per frame, D20) | VERIFIED: 22/22 E2E locally and on GitHub Actions (CI run 17 green) | `npm run e2e` |

## Session 3 — realistic fighters with Blender, AAA menus (product owner: "SF6-realistisch, nur nicht so ultra detailliert"; menu reference image)
| Area | Status | Evidence |
|---|---|---|
| Character build pipeline `tools/characters` (Blender as Python module): MakeHuman 1.1 data (npm `makehuman-data`, CC0) -> body shape, fitted clothes/hair/eyes, fists baked in, Mixamo-named 22-bone game skeleton -> GLB | VERIFIED (builds both fighters in ~25 s each) | `python3 tools/characters/build.py bonez|jazeek` |
| Bonez: tall, light eyes, beard, black tee + puffer vest (open), black jeans, knit scarf, gold cuban chain + cross, gold watch, hand/forearm tattoos | VERIFIED (screenshots) | `/?lab=poses&a=bonez&frame=bust&hide=other` |
| Jazeek: tan skin, curls, moustache + chin beard, white ribbed tank top, beige trousers with an original monogram, white sneakers, two silver chains + medallion, silver watch, arm tattoos | VERIFIED (screenshots) | `/?lab=poses&a=jazeek&frame=bust&hide=other` |
| All moves with the new models + hitbox overlap | VERIFIED (contact sheets) | `EXTRA="&q=low" node scripts/moves.mjs jazeek|bonez` |
| Licences: only CC0 (MakeHuman bundled) and CC-BY assets accepted by the build; per-asset list next to each GLB | VERIFIED | `public/assets/characters/*.credits.json` (Tank_Top_01: CC BY 4.0 Mindfront → credit in game credits) |
| Likeness to the real Jazeek / Bonez MC | PARTIAL: hair, beard, outfit, body type and colouring follow the photos; faces are generic MakeHuman faces, not portraits | |
| AAA menus ("Block Beats Night"): lobby with live 3D hero, modes, versus fighter select, card loadout with 3 presets, profile (local XP/rank/history), settings (quality, touch, sound, vibration), restyled HUD/results | VERIFIED (screenshots + 22/22 E2E) | `node scratch/menus.mjs` style captures, `npm run e2e` |
| Card art and key art rendered in-engine from the models (pose = first active frame of each card's move) | VERIFIED (screenshots) | `src/ui/portraits.ts` |
| Shop / Battle Pass from the reference | NOT BUILT: needs monetisation decisions by the product owner | |
| Artifact: models shipped as `.gltf.json` (host does not serve .glb) | WRONG until v7: the Artifact sandbox CSP blocks fetch() of the data: buffer, so v5/v6 silently showed the procedural placeholders (the PO saw "Klötze"). Fixed in session 4, see below | `scripts/glb-to-json.mjs` |

## Earlier (session 1) — still valid
Deterministic sim (VERIFIED, 49 unit tests incl. symmetry and rollback), rollback netcode core, WebRTC copy/paste friend match (one machine only), Android debug APK in CI, iOS BLOCKED (needs macOS/Xcode/Apple account), CI green on GitHub Actions.

## Known issues / risks
- Feel/timing (hitstop, damage, meter gain, touch layout) has never been tested by a human; the bot balance number is only a sanity check.
- In headless Chromium, CSS animations started while the sim runs stay frozen (load artifact of software rendering). HUD pop-ups were therefore moved to JS tweens; remaining CSS animations (combo bump, card glow) are cosmetic.
- Fighters come from the PO's Meshy sculpts; up close the fists are 'mitten' fists (fingers curled as one block) and tattoos are simple line art. Likeness/name rights for Jazeek and Bonez MC are not cleared (see below).
- Meshy licence: free-plan generations are CC BY 4.0 (credit Meshy), paid plans grant ownership; the PO must confirm which applies.
- Online: no matchmaking/TURN/rematch; the Artifact host blocks WebRTC.
- Bot is reactive but exploitable. Back-throw victim animation assumes a forward throw.

## Needs the product owner
- **Meshy licence**: confirm the plan the two sculpts were generated on (free = CC BY 4.0 attribution; paid = ownership).
- **Source sculpts**: keep the two Meshy GLBs; the build expects them in `.cache/meshy/` (not in git, see `public/assets/characters/README.md`).
- **Shop / Battle Pass / currencies**: monetisation is a business decision (not built).
- **Rights**: written permission from Jazeek and Bonez MC (name, likeness, voice/music references) before any public release. Third-party logos (e.g. monogram prints, scarf brand) were deliberately left out.
- **Assets** (optional upgrade, list in the session report): card art, portraits, logo, arena backdrop, optionally rigged GLB characters into `public/assets/incoming/`.
- Hosting decision for signaling/matchmaking + TURN.

## Next objectives (suggested order)
1. Human playtest on a real phone (APK / Artifact) → tune touch layout, hitstop, damage, meter.
2. Integrate delivered art (card art via `ui/icons.ts` replacement, portraits, GLB characters mapped onto the joint/pose system).
3. Online v2: signaling server + quick match, TURN, rematch.
4. More content: third fighter, second arena, more cards per fighter.
