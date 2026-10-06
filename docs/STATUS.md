# Project status

_Last updated: 2026-10-06 (session 9c: the PO's prop models at real size, Jazeek's special 'Blunt für dich', arenas Festival-Bühne + Bahnhofsviertel with 3D crowds; session 9b: PO review — master design app-wide, fight intro, charge, fatality minigame, croc + car cinematics, blood; session 9: main menu cut 1:1 from the PO master screenshot; session 8: night-street menus + fight flow, Tekken-style select, arena select, 4 new mechanics incl. fatalities, new strings and abilities, special auras, new sound + beat, HUD redesign)._
Legend: **VERIFIED** = observed working via automated test or screenshot; **BUILT** = compiles/builds, not exercised; **UNVERIFIED** = implemented, not checked; **BLOCKED** = needs something outside the agent's control.

## How to play right now
- Private claude.ai Artifact (owner-only until shared, version 11 = session 8): https://claude.ai/artifact/QxFGw7nin7xvWrdnmQZuiv
- Android debug APK: GitHub → Actions → "Android debug APK" → latest run → artifact `rapbrawl-debug-apk` (needs "install unknown apps").
- Local: `npm install && npm run dev`.

## Session 9c — PO props, "Blunt für dich", Festival + Bahnhofsviertel arenas (overnight)
| Area | Status | Evidence |
|---|---|---|
| PO props (release `modelle-2`) at real size: joint 17 cm, mic 30 cm, heart 55 cm, diamond 20 cm, ball+chain 1.5 m, croc 1.5 m, car 2.7 m, palm 5 m; reoriented, reduced, croc jaw + heart halves split | VERIFIED (props lab + in-game sheets) | `python3 tools/meshy/props.py`, `?lab=props` |
| Croc (bites with its own jaw), tuner car, broken heart, gold mic in Jazeek's hand | VERIFIED (cine sheets) | `node scripts/cine.mjs croc|car|jazeek` |
| Wrecking ball (Abrissbirne) swinging in from the background on its chain into the opponent's head (pivot lowered after the first strip) | VERIFIED (film strip) | `CROP=full node scripts/filmstrip.mjs bonez bon_abriss 3` |
| Diamanten-Regen with the PO diamond, Palmen-Bassdrop with the PO palms | BUILT; not captured this session (capture of `cine.mjs bonez` times out in SwiftShader) | |
| "Blunt für dich" (Jazeek): rolls, licks, lights (flame), drags, blows a smoke cloud; grounded hit = 150-frame cinematic (coughing, smoke ring, backfist, sweep, 3 beat hits, spin kick, last drag) | VERIFIED (unit tests + move/cine sheets, 151 damage incl. beat bonus) | `node scripts/cine.mjs blunt`, `tests/fighters.test.ts` |
| Arenas Festival-Bühne + Bahnhofsviertel: PO painting as backdrop (real names replaced), 3D floor (sand / wet cobbles with reflection), lights, beams/CO2/dust resp. neon flicker/drizzle/steam | VERIFIED (screenshots close/mid/wide) | `node scripts/arena-shot.mjs artifacts/arena/x high "&arena=festival"` |
| 3D crowds: festival hipsters (jump, cheer, film, fist pump, clap, sway, two circle pits), rocker gangs with bikes (arms crossed, nod, drink beer, point); react to hits and the beat | VERIFIED (lab close-ups + in-game shots); motion feel UNVERIFIED on a device | `node scripts/crowdshot.mjs`, `?lab=crowd` |
| Car cinematic end position = sim end distance (4.2 m; was 5.0 in the render → visible jump) | FIXED | |

## Session 9b — PO review: whole app in the master design, fight intro, charge, fatality minigame, staged specials, blood
| Area | Status | Evidence |
|---|---|---|
| Screens fill the phone (plates outpainted on all sides, safe-rect stage) | VERIFIED (emulated phones + 844x330 viewer) | `node scripts/menushot.mjs`, `selectshot.mjs`, `shopshot.mjs` |
| Live 3D fighters in the menus: favourite in the main-menu centre, P1/P2 on the pedestals, waiting idle (breathing, weight shift, look-around), contact shadow | VERIFIED (screenshots) | same scripts |
| Buttons: ARENEN = favourite arena (preselected), KÄMPFER = favourite + abilities + outfits/accessories (KOMMT BALD), Modi window with picture tiles incl. "Street of Rage GO Co-Op" (KOMMT BALD), per-player arena pick + random draw, Rangliste = BESTENLISTE (no char select), shop "KOMMT BALD · DESIGNER AM WERK", Event = KOMMT BALD | VERIFIED (e2e walks the flow) | `npm run e2e` |
| In-game HUD from the PO HUD master | VERIFIED (screenshots) | `node scripts/hudshot.mjs` |
| App-wide skin from the leaderboard master (Kämpfer, Karten, Profil, Einstellungen, Steuerung, Pause, Ergebnis) | VERIFIED (screenshots) | `node scripts/screens.mjs` |
| Fighters: shoes never sink into the floor (ground clamp), arms 10 % shorter, calmer idle bob | VERIFIED (strips) | `node scripts/filmstrip.mjs` |
| Aufladen (hold Hype bar / C / stick clicks) + comeback Hype from damage taken | VERIFIED (unit tests); feel UNVERIFIED | `tests/charge.test.ts` |
| Fatality = card in range + 3-button minigame; 400 frames in three stages with blood (USK 16) | VERIFIED (unit tests + in-game sheets) | `tests/mechanics.test.ts`, `node scripts/mechanics.mjs fatality|fatality-bonez` |
| Krokodil-Attacke: little croc runs along the floor (low), bite, drag, two death rolls, toss (cinematic) | VERIFIED (unit tests + cine sheet) | `node scripts/cine.mjs croc` |
| Tiefergelegt: car drives through; a grounded hit = roof ride, donuts, hard brake (cinematic) | VERIFIED (unit tests); cine sheet see below | `node scripts/cine.mjs car` |
| Fight intro: round 1 showcase per fighter (emote, face close-up, name + tagline), skippable | VERIFIED (unit test + sheet) | `node scripts/introshot.mjs` |
| Smoother cinematics: spline motion between un-eased keys (poses + camera) | BUILT; visual check on sheets only (motion feel needs a real device) | D39 |
| Blood droplets + floor splats, setting BLUT | VERIFIED (sheets) | |
| Croc / car / outfits / accessories are placeholders from primitives | PLACEHOLDER — prompts for the PO's 3D assets in `docs/ASSET_PROMPTS.md` | |
| Online "Gegen Freunde" polish | TODO (PO: later) | |

## Session 9 — PO master screenshots as the UI source (main menu first)
| Area | Status | Evidence |
|---|---|---|
| Extraction pipeline `tools/ui-extract/` (GrabCut + LaMa + matting, D38) | VERIFIED | 25 sprites, 1.4 MB WebP; contact sheet on magenta; background plate without UI and without the Mercedes star |
| Main menu = master art + native German text + real buttons | VERIFIED | `node scripts/menushot.mjs`: 2000x1125 capture next to the master (`compare.py`: art identical outside text zones), phones 844x390 (notch, `?safe=47`) and 800x360 |
| Phone landscape layout (groups stick to edges, +20 % on wide phones, safe area) | VERIFIED (emulated) | screenshots above; real devices UNVERIFIED |
| Buttons wired: Schnellkampf/Online/Gegen Freunde/Rangliste → flow; SPIELEN = last mode; Modus sheet + CPU-Stärke; Kämpfer, Arenen, Einstellungen, Profil, Event (Hilfe), Glocke (News) | VERIFIED | e2e 24/24 + netplay script use the new menu |
| Shop, Battle Pass, Bestenliste, Münzen/Diamanten | PLACEHOLDER | local values, "BALD VERFÜGBAR" toast, no real money (PO decision) |
| Modus sheet + News sheet | RECREATED (no master exists) | simple styled panels until the PO supplies a design |
| Loading / title / boot screen (PO master: plate + PO logo + extracted bar with blue fill and spark) | VERIFIED | `node scripts/loadshot.mjs`: 2000x1125 next to the master, phones |
| Character select (PO master: outpainted plate, fighters on the pedestals, busts in two roster tiles, ribbon names + hometowns native) | VERIFIED | `node scripts/selectshot.mjs` (also captures the arena select) |
| Arena select (PO master: preview frame over the arena picture, tile frames normal/selected, info panel native; car hood ornament removed) | VERIFIED | same script |
| Shop (PO master: tabs, item cards, bundle; Nike swooshes retouched out of shelves, card, bundle, tab icon; no real money: "BALD VERFÜGBAR") | VERIFIED (placeholder: nothing buyable, other tabs say "KATEGORIE KOMMT BALD") | `node scripts/shopshot.mjs` |
| Battle Pass, HUD, Bestenliste masters | TODO | PO references received (battle_pass, hud, leaderboard) |

## Session 8 — PO feedback: head/hands, strike variety, mechanics, fatality, abilities, VFX/sound/music, HUD, flow + menus after inspiration boards
| Area | Status | Evidence |
|---|---|---|
| Head looked "in weird directions" while striking (sky on uppercuts, away on spins) → head stabiliser after blending (D37) | VERIFIED (before/after strips) | `artifacts/film/jazeek_before_*`, `*_after_*` |
| Fists: tighter when the arm extends, thumb folded over the fingers (per-model axis) | VERIFIED (close-ups) | `node scripts/handshot.mjs` |
| New strings L·L·H and 2L·H per fighter (flying knee, back-flip kick launcher, headbutt, clinch knee) | VERIFIED (unit tests + in-game strips, all connect) | `tests/fighters.test.ts`, `artifacts/film/*_LLH.png`, `*_2LH.png` |
| Beat-Drop, Mic-Duell, Wand-Splat, Fatality in the sim (rollback-safe) | VERIFIED (unit tests: 7 new) + online checksum check | `tests/mechanics.test.ts`, `node scripts/netplay.mjs 60` |
| Mic-Duell presentation (close camera, mic prop, tap bars + countdown, tap-anywhere on phones), Wand-Splat (wall crack, impact), Beat-Drop (record clock with beat ring, BEAT! pop, gold rings), fatalities: Jazeek "Platin-Finale", Bonez "Krokodil-Finale", each ends in a taunt | VERIFIED (in-game frame sheets); feel UNVERIFIED (no human) | `node scripts/mechanics.mjs duel|splat|fatality|fatality-bonez`, `artifacts/mech/` |
| New abilities: Diamanten-Regen (overhead zone), Tiefergelegt (generic tuner car, Bonez hops over it) | VERIFIED (unit tests + strips) | `artifacts/film/jazeek_jaz_rain.png`, `bonez_bon_car.png` |
| Card art shows the ability (props/effects rendered with the fighter) | VERIFIED (deck screenshots) | `node scripts/cards.mjs`, `artifacts/ui/cards_*.png` |
| Special-move auras (rune circle, energy pillar, light in the card colour, limb trails) | VERIFIED (frame captures) | `artifacts/film/aura_frame.png` |
| Impact/whoosh sounds layered + saturation; new original 90 BPM beat (GEMA-free) | BUILT + rendered offline (levels OK, no clipping, peak −1.1 dB SFX); never heard by the agent | `node scripts/audio-render.mjs`, `artifacts/audio/*.mp3` |
| Music synced to the sim beat; `bgm.mp3` drop-in for the PO's tracks (git-ignored) | BUILT; drift correction UNVERIFIED on a real device | `public/assets/music/README.md` |
| Menus after the 4 boards: start/loading screen (concert stage), main menu with modes (no characters), Tekken-style fighter select (P1 left, P2 right, roster middle), arena select (4 arenas + 2 announced), loading screen with tips | VERIFIED (desktop + phone landscape screenshots, E2E walks the flow) | `node scripts/ui.mjs`, `artifacts/ui/`, `npm run e2e` |
| Ranked = offline CPU ladder with rank points (tiers set the CPU level) | VERIFIED by code path only (no long play session) | |
| HUD redesign (slanted ink-outlined bars, player-colour portraits, record clock, overlays) | VERIFIED (screenshots) | `node scripts/hudshot.mjs` |
| Arena/fighter blending: arena light probe (environment map rendered from the arena) + rug-coloured floor bounce | VERIFIED (before/after); judged subjective | `artifacts/blend_cmp.png` |
| Balance after new strings | VERIFIED by bot probe only: Jazeek ≈55 % (±5 % noise) | `npx tsx scripts/botmatch.ts 120 hard` |
| Unit tests 68/68, E2E 24/24, typecheck, build | VERIFIED locally | |

## Session 7 — PO feedback: crippled hands/arms, idle hop, better grabs/combos/block, cartoon main menu, songs
| Area | Status | Evidence |
|---|---|---|
| Hands looked crumpled: runtime fist curl too strong for the two-bone finger rig → light curl (40 %) | VERIFIED (close-ups with/without) | `/?lab=poses&frame=full&fist=0..1` |
| Arms looked broken: aim solver gave elbows a sideways bend → real hinge solve (elbows/knees bend in one plane, with roll); rubber stretch capped (arms 0.1, legs 0.15), reach restored by step-ins | VERIFIED (reach check, pose sheets of normals + specials) | `node scripts/reach.mjs`, `artifacts/poses/` |
| Idle "glitch hop": beat pulse dropped the body in one frame each beat → smooth cosine bob (max 2 mm/frame) | VERIFIED (measured root height over 90 frames) | |
| Bonez guard: elbows in, fists in front of chest/chin (was flared) | VERIFIED (screenshot) | |
| Slams: Jazeek Spinebuster / back+Grab German suplex, Bonez Powerbomb / back+Grab "Hafenkran"; slam VFX at the victim | VERIFIED (in-game strips + GIFs) | `artifacts/film/*throw*` |
| Perfect block (Block tap or back tap ≤6 frames before the hit, works as a quick tap; anti-mash; counter-hit punish window) + gold VFX, sound, "PERFEKT-BLOCK!" | VERIFIED (unit tests + in-game strip/GIF; the text callout is hidden in captures) | `tests/combat.test.ts`, `artifacts/film/jazeek_pblock.gif` |
| H·L launchers + Up jump-cancel + jL→jH air chain (4-hit air combo, both fighters) | VERIFIED (unit tests); animations VERIFIED by reach check only | `tests/fighters.test.ts` |
| Help screen lists the real combos (fixed: L·L was shown for H·L), air combo, back slam, perfect block | VERIFIED (screenshot) | `artifacts/ui/desk_4_help.png` |
| Cartoon main menu + title (sky, 3D candy buttons, rank road, arena card, deck, KAMPF!, 5-tab bar); other menus restyled | VERIFIED (desktop + phone landscape screenshots) | `node scripts/ui.mjs`, `artifacts/ui/` |
| Signature music: licensed drop-in `assets/music/<fighter>.mp3`, else original stinger + beat ducking | BUILT; never heard by a human; no licensed track present | `public/assets/music/README.md` |
| Balance after the changes | VERIFIED by bot probe only: Jazeek 52 % / Bonez 48 % both sides (unchanged) | `npx tsx scripts/botmatch.ts 60 hard` |
| E2E 22/22, unit tests 55/55 | VERIFIED locally | |

## Session 6 — movement + strike animations (PO: "unbedingt die bewegungs und schlag animationen verbessern und verfeinern")
| Area | Status | Evidence |
|---|---|---|
| Root cause found: strikes pointed toward the camera (local angles on a twisted torso), animator lag filter softened every snap | FIXED (D30) | `node scripts/reach.mjs` before/after |
| Aim solver (`PoseDef.aim`), cross-fade animator, stretch/squash channels (GLB + procedural rig) | VERIFIED (film strips, pose sheets) | `scripts/filmstrip.mjs`, `scripts/posesheet.mjs` |
| All normals of Jazeek + Bonez rebuilt (anticipation, contact with reach, follow-through, settle); fists/feet within ~0.15 m of the hitbox edge (uppercuts sit inside their tall boxes) | VERIFIED (reach check + pose sheets) | `artifacts/poses/`, `node scripts/reach.mjs` |
| Shared key poses (jab, cross, hooks, high kick, straight) aimed, so specials and Signature cinematics improve too | VERIFIED by reach check for the specials with hitboxes; cinematics UNVERIFIED by capture | |
| Walk cycles (4-key shuffle, distance-driven), dash burst/plant, jump squash & stretch, landing, impact-snap hit/block reactions | VERIFIED (in-game film strips) | `artifacts/film/` |
| Before/after GIFs of a combo per fighter | see `artifacts/film/*_alt_combo.gif` vs `*_neu_combo.gif` | |
| Feel on a real phone (60 fps) | UNVERIFIED (SwiftShader only) | |

## Session 5 — textured Meshy models 1:1 + podcast arena (PO: "1:1, keine Verschlechterung", whole game in this Clash-Royale style, arena = the podcast concept image; show it before changing more)
| Area | Status | Evidence |
|---|---|---|
| PO's textured models rigged without re-export (`tools/meshy/skin.py`: weights appended to the original GLB, joints from landmarks on the original mesh, runtime fists) | VERIFIED (lab + match screenshots) | `artifacts/compare/*_full_cmp.jpg` |
| Game copies (`tools/meshy/reduce.py`): 120k tris, base colour 4K, maps 2K, ~12 MB each instead of 73 MB | VERIFIED: in-engine side by side with the rigged originals (same skeleton) — identical at gameplay distance, slightly softer chain/diamond texture only in extreme close-ups | `artifacts/compare/*_bust_cmp.jpg` |
| Podcast arena "Block Beats Podcast" baked in Blender (neon sign, gold records, ON AIR, LED frame, desk with mics/mixer, armchairs, shelves, speakers, ring lights, rug with crown), animated emissives, arena-specific look (AgX, neon-only bloom) | VERIFIED (in-game screenshots at three fighter distances, high tier) | `node scripts/arena-shot.mjs`, `artifacts/arena/` |
| Floor reflection on the high tier, blurred like polished wood | VERIFIED (screenshot) | |
| Moves vs. hitboxes with the new proportions | PARTIAL: contact sheet looks plausible (fists reach the boxes on jab/heavy), not tuned per move | `node scripts/moves.mjs jazeek` |
| Artifact v8 (models as .gltf.json + separate JPEGs, arena files) | VERIFIED locally under an Artifact-like CSP that, like the host, does not serve .glb; live check by the PO pending | `node scripts/artifact-check.mjs` |
| E2E 22/22 with the new models and arena | VERIFIED locally (q=low); CI timeout raised to 40 min | `npm run e2e` |
| Cost | SwiftShader low tier: 835 ms/frame median (was 433 ms), 394k triangles, 23 draw calls. Phone FPS UNVERIFIED; if phones struggle, the next step is a lighter phone copy of the models (e.g. 40k triangles, 2K textures) chosen by quality tier | E2E PERF line |
| Medium/low tier look of the new arena | UNVERIFIED by screenshot (low tier seen in the Artifact check only) | `dist-single/artifact-check-arena.png` |
| Bonez's generated tracksuit shows a green crocodile emblem | RISK: PO should check it against registered marks before release | `public/assets/characters/bonez.credits.json` |

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
- Fighters are the PO's textured Meshy models; the sculpted hands are open and are curled into fists at runtime, which stretches the finger geometry a little up close. Likeness/name rights for Jazeek and Bonez MC are not cleared (see below).
- Meshy licence: free-plan generations are CC BY 4.0 (credit Meshy), paid plans grant ownership; the PO must confirm which applies.
- Online: no matchmaking/TURN/rematch; the Artifact host blocks WebRTC.
- Bot is reactive but exploitable. Back-throw victim animation assumes a forward throw.

## Needs the product owner
- **Meshy licence**: confirm the plan the models were generated on (free = CC BY 4.0 attribution; paid = ownership).
- **GitHub release with the original models**: the repository is public, so the release makes the 70 MB originals downloadable by anyone; delete it (the agent keeps local copies in `.cache/meshy2/`) or make the repository private.
- **Crocodile emblem** on Bonez's tracksuit (generated by Meshy): trademark check before release.
- **Songs for the Signature moves**: written licences (publisher/GEMA side incl. sync for a game + label for the master) before any real track goes in; until then original stingers play.
- **Music for the MVP**: drop your own tracks into `public/assets/music/` (`bgm.mp3`, `<fighter>.mp3`) on your machine — they are git-ignored so they never land in the public repo; written licences before any public release.
- **Pistol ability for Bonez**: PO said yes if the rating stays at 16; still not built — needs the PO's model/look and a final OK on depicting a real person with a gun (reputational risk).
- **Fatality tone**: PO: blood yes, but USK 16 at most → small droplets + floor splats, no gore (setting BLUT turns it off). A real USK rating needs an official classification before release.
- **Online ranked / leaderboard / shop / battle pass**: need a server and monetisation decisions; the menu shows only real features.
- **Source models**: keep the textured Meshy GLBs; the build expects them in `.cache/meshy2/` (not in git, see `public/assets/characters/README.md`).
- **Shop / Battle Pass / currencies**: monetisation is a business decision (not built).
- **Rights**: written permission from Jazeek and Bonez MC (name, likeness, voice/music references) before any public release. Third-party logos (e.g. monogram prints, scarf brand) were deliberately left out.
- **Assets**: accessories/outfits and mode tiles — prompts in `docs/ASSET_PROMPTS.md` (croc, car, props now delivered by the PO and in the game).
- **Assets** (optional upgrade, list in the session report): card art, portraits, logo, arena backdrop, optionally rigged GLB characters into `public/assets/incoming/`.
- **Blunt für dich**: a real person (Jazeek) rolling and smoking a joint — affects the USK rating (drug use depicted) and is a reputation question for the artist; decide before release (option: a neutral "Zigarre"/vape or a fictional herb).
- **Arena paintings**: the PO's two images contain real brands/businesses (festival logo, bar and kiosk names); the game uses retouched copies with fictional names (FESTIVAL-BÜHNE, PIK ASS, KIOSK 069, WEINECK). Check the image source/licence of the paintings themselves.
- **Crowd look**: built from primitives in the game-art style; for a richer look, a few rigged stylized crowd models (prompt on request) could replace them.
- Hosting decision for signaling/matchmaking + TURN.

## Next objectives (suggested order)
1. Human playtest on a real phone (APK / Artifact) → tune touch layout, hitstop, damage, meter, charge rate, fatality minigame timing.
1b. Online "Gegen Freunde" (room code) flow polish (PO: later); outfits/accessories once the PO's assets exist.
2. Integrate delivered art (card art via `ui/icons.ts` replacement, portraits, GLB characters mapped onto the joint/pose system).
3. Online v2: signaling server + quick match, TURN, rematch.
4. More content: third fighter, second arena, more cards per fighter.
