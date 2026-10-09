# Project status

_Last updated: 2026-10-08 (session 17: Jazeek measured against the PO's real photos (face warp, eyes, hair), no eye bags, realistic PBR look for the Jazeek pair instead of the cel shader, new cartoon head for Jazeek Cartoon, Artifact v25 — the PO then put the other fighters on hold and asked for Jazeek as one finished AAA+ character first; session 16: the PO's modelle-4 Jazeek pair — close-up heads merged onto their bodies, face matched to the reference photos, Jazeek (stylized 3D) replaces the modelle-3 Jazeek and Jazeek Cartoon (anime / cel shaded) joins as a fighter of his own; session 15: both players pick their fighter, mirror matches with a blue P2 outline, KÄMPFER card overview + ANPASSEN menu item, home towns under the names, fighter embedded on the home pedestal, artwork slot sheets for the PO; session 14: design v4 — the PO's five street masters cut 1:1, layered Figma SVGs, the screens without a master from their pieces, design v3 discarded; session 13: animation smoothness system and the glitch probe; session 12: the PO's iPhone feedback round — menus never black, sound in the native app, fight stutter, feet on the floor, touch controls, FREUNDE screen, home towns, waiting poses, abilities round 2 and second stages for the signatures; session 11: the four fighters from the PO's modelle-3 models with cel look, new signatures and abilities for all four, Blunt rework, living v2 menus, v2 profile/settings/deck/results/pause/HUD; session 10: design v2 from the PO's second master set with a switch back to v1, half-speed specials, Diamanten-Regen / Blunt / croc reworked, Manuellsen + Lacazette as 2D cutouts; session 9d: iPhone crash + layout fixes; session 9c: the PO's prop models at real size, Jazeek's special 'Blunt für dich', arenas Festival-Bühne + Bahnhofsviertel with 3D crowds; session 9b: PO review — master design app-wide, fight intro, charge, fatality minigame, croc + car cinematics, blood; session 9: main menu cut 1:1 from the PO master screenshot; session 8: night-street menus + fight flow, Tekken-style select, arena select, 4 new mechanics incl. fatalities, new strings and abilities, special auras, new sound + beat, HUD redesign)._
Legend: **VERIFIED** = observed working via automated test or screenshot; **BUILT** = compiles/builds, not exercised; **UNVERIFIED** = implemented, not checked; **BLOCKED** = needs something outside the agent's control.

## How to play right now
- Private claude.ai Artifact (owner-only until shared, page + rapbrawl.js; see the latest session for the version): https://claude.ai/artifact/QxFGw7nin7xvWrdnmQZuiv
- Android debug APK: GitHub → Actions → "Android debug APK" → latest run → artifact `rapbrawl-debug-apk` (needs "install unknown apps").
- iPhone app (native, no browser): GitHub → Actions → "iOS app (unsigned IPA for sideloading)" → latest run → artifact `rapbrawl-ios-ipa` → install `RAPBRAWL.ipa` with Sideloadly (Windows/Mac) and a free Apple ID; valid 7 days, then re-install (D44). Build VERIFIED (Xcode 26.3, BUILD SUCCEEDED); running on a device UNVERIFIED until the PO's first install.
- Local: `npm install && npm run dev`.

## Session 17 — Jazeek against the real photos, PBR look for the Jazeek pair, new cartoon head (D50)
| Area | Status | Evidence |
|---|---|---|
| PO's question answered: in S16 the face SHAPE was not adapted from the photos (only colours) | DONE (reported) | D50 |
| Face measured on the photos (MediaPipe, 478 points) and warped toward them: residual 2.18 % → 1.56 % of the eye span (eyes, nose, lips, jaw all closer) | VERIFIED (numbers + sheet photos/Blender/game) | `tools/meshy/facemarks.py`, `facefit.py`, `artifacts/s17/sheet_jazeek.jpg` |
| No under-eye shadows; iris, sclera and hair colours measured on the photos (white-balanced by the sclera), wet eyes + painted catchlight, upper-lid band lifted, glossier dark-brown curls | VERIFIED (texture crops, in-game close-ups) | `tools/meshy/faceretouch.py`, `artifacts/s17/game/jaz6_*.png` |
| Jazeek + Jazeek Cartoon render with a realistic PBR material (colour/normal/metal-roughness, reflections, rim, soft skin, half-neutral light colour); Bonez, Manuellsen, Lacazette unchanged (cel), as the PO asked | VERIFIED (in-game captures) | `render/cel.ts` `lookFor()`, `scripts/charshot.mjs` |
| New cartoon head ("Neuer Cartoon Kopf Jazeek.glb") = Jazeek Cartoon; remesh leak fixed (welded + capped input) | VERIFIED (Blender renders, rig, `reach.mjs jazeektoon` all strikes ok) | `artifacts/meshy4/anime2_final.jpg` |
| Unit tests 92/92, typecheck, Artifact payload check (models + arenas under CSP) | VERIFIED | `npm test`, `node scripts/artifact-check.mjs` |
| Artifact | v26 published (v25: PBR + photo match; v26: motion capture, grade, blinks) | https://claude.ai/artifact/QxFGw7nin7xvWrdnmQZuiv |
| e2e suite after the S17 changes | VERIFIED 54/54 (the v2 deck slot click is forced: its wiggle never reads "stable" at 3 fps, same before S17) | `npm run e2e` |
| Phone DPR raised (medium 2, high 2.5) — performance on the iPhone | UNVERIFIED (PO test) | |
| PO audit answered (engine, reduction, textures, materials, light, causes) | DONE (reported) | D50 |
| Jazeek motion capture: idle (boxer bounce as a layer over the stance), walk upper body, jab (captured, time-warped onto the frame data, fist on the hitbox) | VERIFIED (film strips, GIF, `reach.mjs` ok, animprobe: no errors, pops in range, idle foot slide 4 vs 23 frames) | `tools/mocap/`, `node scripts/filmstrip.mjs jazeek idle 8 low 160` |
| Jazeek skin in-game measured against the photos and calibrated (cheek saturation 0.60 → 0.35, photos 0.31–0.36) | VERIFIED (numbers) | `node scripts/gradeprobe.mjs`, D50 |
| Jazeek blinks (morph target), eyes squeeze on hits, shut on KO | VERIFIED (face captures open / half / closed) | `tools/meshy/blink.py`, `?blink=1` |
| Elbow/wrist deformation (twist bones), kicks/acrobatics from capture, hair silhouette, facial expressions | OPEN | D50 |
| Idle legs calmer (30 % of the captured leg/hip motion; PO: "die Beine zappeln dauerhaft") | VERIFIED (film strip) | `idleLegs` in `anims/jazeek.ts` |
| Render pass (PO: "wie mit Paint gemalt"): the grey, lifted grade (sat 0.5 / gain 1.5) made Jazeek a pale cut-out - now a character key light fixed to the camera, less arena fill, sat 0.95 / gain 0.95, skin sheen (spec 1, roughness x0.8) | VERIFIED (in-game before/after sheets) | `scripts/lookprobe.mjs`, `CHAR_LIGHT` in `render/cel.ts`, `artifacts/look/` |
| iPhone on GRAFIKQUALITÄT HOCH loads the full Jazeek (120k triangles, all maps 2K: `<id>.h.glb` by `tools/meshy/texcap.py`) instead of the 40k copy; MITTEL unchanged | VERIFIED (iPhone 13 emulation: files fetched, triangle count, texture sizes) - performance on the device UNVERIFIED | `render/glbRig.ts` `fetchGltf(.., 'high')` |
| IPA download from this container | BLOCKED (proxy denies GitHub's artifact storage host) - the PO downloads it from the Actions run | |
| Baked ambient occlusion for Jazeek (creases, armpits, under the chain), auto-slip on block (PO idea, proposal sent), VFX restyle, Mixamo moves | OPEN | |

## Session 16 — modelle-4: Jazeek + Jazeek Cartoon, head merged onto body (D49)
| Area | Status | Evidence |
|---|---|---|
| Release `modelle-4` fetched (4 GLBs: stylized head 7.7M tris + body, anime head 4M tris + body; digests checked) | DONE | `.cache/meshy4/*_src.glb` |
| Head + body merged per style: aligned on chin / nose / nasion, tilted neck cut above the chains, neck bent onto the body's, one closed surface (no seam line, no crack for the ink outline), 160k tris with face + hands on their own budget, face-first UVs, colour + normal baked from the full-resolution sources | VERIFIED (Cycles renders front / 3⁄4 / side / back / neck close-up of both) | `python3 tools/meshy/merge4.py styl\|anime` → `artifacts/meshy4/<style>_final_*.png` |
| Face after the PO's three photos: skin tone of body and head matched (body lifted ×1.17), lips toned to brown, shadows under the eyes, fuller darker brows (stylized); hooded lids, moles, thin moustache separate from the goatee come from the PO's new heads | VERIFIED as renders next to the photos; likeness judgement = the PO's | `artifacts/s16/vergleich_fotos_modelle.jpg` |
| Game copies (120k / phones 40k) rigged; fists close (thumb side + wrist landmark fixed for the stylized hands); every strike within ±5 cm of its hitbox (Ninetynine's grab excepted as before) | VERIFIED (hand close-ups, `reach.mjs` both ids) | `node scripts/handshot.mjs jazeek move:jaz_5L:6 out.png`, `node scripts/reach.mjs jazeek\|jazeektoon` |
| Jazeek Cartoon = own fighter (`jazeektoon`, base `jazeek`): select, KÄMPFER (5th card), customise, intro ("JAZEEK CARTOON", AACHEN), fight, mirror vs Jazeek; plays frame-identically to Jazeek (unit test) | VERIFIED (screenshots, e2e, unit test) | `UI=v4 node scripts/v2shot.mjs "showFightersV4('jazeektoon')" ...`, `F=jazeektoon,jazeek node scripts/introshot.mjs 84` |
| Animation probe Jazeek vs Jazeek Cartoon (1200 frames): no errors; pops/feet in the range of earlier probes; flagged moves (backflip kick, low kick) checked as film strips — fast by design | VERIFIED | `node scripts/animprobe.mjs jazeek,jazeektoon 1200 11` |
| Checks: unit 92/92, typecheck, e2e 54/54 (new: Jazeek Cartoon card, Jazeek Cartoon vs Jazeek with both 3D models) | VERIFIED | `npm test`, `npm run e2e` |
| The stylized body's chains: Meshy's melted silver with brown flecks, read as chains at game distance but not a clean Cuban link + "99" pendant | KNOWN ISSUE (next: model the chain + pendant) | |
| Look of both on the iPhone (mobile copies 40k / 2K) | UNVERIFIED (PO test) | |

## Session 15 — both players pick, mirror matches, KÄMPFER cards, ANPASSEN, home towns, artwork slots (D48)
| Area | Status | Evidence |
|---|---|---|
| Character select: P1 picks, then the other side (2nd player / CPU opponent / training partner); pedestal or name plate hands the pick over; the same fighter is allowed | VERIFIED (e2e: P1 picks → P2 picking → P2 takes the same fighter → both `lacazette`) | `npm run e2e` |
| v4: pick line over the active name plate, active neon frame breathes, both frames + tags on a shared tile | VERIFIED (screenshots 1672x941 + 932x430) | `UI=v4 node scripts/v2shot.mjs "beginFlow('cpu', false), window.__rb.sel.fighters.splice(0,2,'bonez','bonez'), window.__rb.showCharSelect(1)" artifacts/s15/mirror "1672x941,932x430"` |
| Mirror match in the fight: P2 with a blue ink outline (P1 black), HUD accents differ | VERIFIED (in-game frame; e2e checks the two outline colours) | `F=bonez,bonez Q=medium node scripts/hudshot.mjs out.png` |
| Home: the favourite in the middle of the pedestal (not on its front edge) | VERIFIED (before/after crop) | `UI=v4 node scripts/v2shot.mjs "showHome()" ...` |
| KÄMPFER = card overview of all four fighters (portrait until the PO's card art), name + home town, ANPASSEN / FAVORIT / DECK; ANPASSEN as its own home tile (MISSIONEN tile, label replaced) | VERIFIED (screenshots 1672x941 + 932x430, e2e) | `UI=v4 node scripts/v2shot.mjs "showFightersV4()" ...` |
| Home towns under the names: select, KÄMPFER, customise, fight intro | VERIFIED (screenshots, intro frame, e2e text checks) | `node scripts/introshot.mjs 60` |
| Artwork slots marked for the PO (home tiles, avatar, banners, select boxes, fighter cards, skins, card art) + README table with sizes and card IDs | DONE | `design/v4/artwork/`, `python3 tools/ui-extract/artwork_sheets.py artifacts/s15` |
| Checks: unit 91/91, typecheck, e2e 51/51 (new: KÄMPFER cards + home towns, ANPASSEN tile, mirror pick + P2 outline colour), Artifact payload under CSP; Artifact **version 23** published | VERIFIED | `npm test`, `npm run e2e`, `node scripts/artifact-check.mjs` |
| Feel of the pick flow on the iPhone | UNVERIFIED (PO test) | |

## Session 14 — design v4: the PO's street masters 1:1 (D47)
| Area | Status | Evidence |
|---|---|---|
| Design v3 (Blender UI, S13) discarded at the PO's request: code, `tools/ui3`, `assets/ui3` removed (history keeps them); switch EINSTELLUNGEN → DESIGN = STREET (v4, default) / RING (v2) / KLASSISCH (v1), `?ui=v4\|v2\|v1` | VERIFIED (e2e: default is v4, v2 flow with `?ui=v2`) | `src/ui/design.ts` |
| Five masters cut into plate + sprites + text zones (home, modes, select, customise, lobby): live text removed, DB / S-Bahn marks retouched out, tiles masked inside their frames, state pieces (neon/gold frames, P1/P2 cursors, lit stat cells, ONLINE/OFFLINE, blank buttons/tiles) | VERIFIED (sprite sheets, recomposition vs. master) | `python3 tools/ui-extract/v4_screens.py all` |
| Figma: layered SVGs per master (scene, panels, every UI element, states hidden, live texts as text layers) + previews; recomposed previews match the masters (mean abs. diff 6–7.6 / 255) | VERIFIED (files + previews); the import into Figma itself UNVERIFIED (no Figma connector in this session) | `design/v4/*.svg`, `design/v4/README.md` |
| v4 home (amounts, name/level/XP, avatar, tiles, FIGHT, the favourite fighter on the pedestal), modes (ONLINE/OFFLINE, neon selection), select (5x3 grid with busts, moving P1/P2 cursors, names on the plates, 3D fighters), customise (skins row, stat cells per fighter, rotate, AUSRÜSTEN), lobby (friend rows, room code, slots, ANFRAGEN panel) — 1672x941 and 932x430 | VERIFIED (screenshots) | `UI=v4 node scripts/v2shot.mjs "showHome()" artifacts/v4/home "1672x941,932x430"` (also `showModes()`, `beginFlow('cpu', false)`, `showCustomV4('bonez')`, `showOnlineLobby()`) |
| Light on the cut pieces: light sweep per tile (staggered), breathing neon selection frames, pulsing gold chain buttons. The background painting is still (PO after the first review: no living plate / depth wobble, no light glows, haze or embers in v4) | VERIFIED (frame pairs + difference images: home, modes, select, lobby, profile — only the UI pieces and the 3D fighters change); the feel on the iPhone UNVERIFIED | `UI=v4 node scripts/livingshot.mjs "showHome()" artifacts/s14b/home 1672 941 2 1500`, `still()` in `ui/v2/stage.ts` |
| Screens without a master, only from master pieces: profile / settings / deck / friends in the home scene without its UI (`home_clean`) with gold-framed lobby panels and the v4 top bar; arena select on the modes master (blank tiles with the arena picture, ZUFALL / MEHR); loading screen with the profile XP bar; no VS screen in v4 | VERIFIED (screenshots desktop + phone for profile, settings, arena, loading) | `UI=v4 node scripts/v2shot.mjs "showProfile()" ...`, `showArenaSelect(()=>0)` |
| Artwork drop-ins for the PO (banners, select boxes, skins; cards as before) with a manifest so nothing is probed | BUILT (empty until the PO delivers; paths in `design/v4/README.md`) | `scripts/art-manifest.mjs` (runs in `npm run build`) |
| Fight HUD, pause and results keep the v2 skin; shop keeps the v1 master | as designed (no master for them) | |
| UI-free plates of modes/select/customise/lobby (LaMa leaves ghost panels in the big holes) | KNOWN LIMIT — only in the Figma files, not in the game | |
| Checks: unit 91/91, typecheck, e2e 43/43 (new v4 flow: default v4, AUSRÜSTEN → favourite, lobby room code, FIGHT → modes → select (P1 = favourite) → arena (two pages) → loading → match in the picked arena, no page errors; v1 desktop/phone and v2 flows with `?ui=v2`); Artifact payload under CSP (v4 home art, four fighters incl. the phones' copies, props, arenas); Artifact **version 21** published (page + rapbrawl.js + `assets/ui4/**` + the fighters' mobile copies); after the still-background change e2e 43/43 again and **version 22** published (page + rapbrawl.js) | VERIFIED | `npm test`, `npm run e2e`, `node scripts/artifact-check.mjs` |

## Session 13 — animation smoothness system (D46; the v3 design of that session is discarded, see S14)
| Area | Status | Evidence |
|---|---|---|
| Glitch probe: seeded bot matches or one signature through the real loop, every key joint every frame → pops, reversals, teleports, snaps, feet through/above/sliding the floor; frame strips around suspects | VERIFIED (reports in `artifacts/probe/`) | `node scripts/animprobe.mjs jazeek,bonez 1800 11`, `CINE=sofa node scripts/animprobe.mjs x 900` |
| Inertialized transitions, quaternion blending, pose spring; strikes keep their snap | VERIFIED (probe + film strips) | `render/animator.ts` |
| Clavicles, toes, fists with the arm's extension; foot locks with quick steps, re-anchor on teleports | VERIFIED (film strips) | `render/glbRig.ts` |
| Facing turns through the front view with a blend into the mirrored stance; downed bodies keep their facing; a new round is a cut; sim relocations glide once | VERIFIED (film strips around the probe's suspect frames) | `SHOTS=903,978 node scripts/animprobe.mjs ...` |
| Glitch loop over all moves and cinematics | IN PROGRESS — the probe still flags pops (mostly fast strikes and cinematic camera cuts, many intended); next pass per flagged move | `artifacts/probe/*/report.json` |

## Session 12 — iPhone feedback round (21 points): menus, sound, performance, abilities round 2 (D45)
| Area | Status | Evidence |
|---|---|---|
| Menus never black / never only sprites: mobile fighter models `<id>.m.glb`, tiles as textures + GPU cache, checked first draw with CSS fallback, lost-context handling | VERIFIED here (ok/fail/lost states, `?livingfail`, phone emulation); on the iPhone UNVERIFIED (PO re-test) | `node scripts/v2shot.mjs "showHome()"`, `data-living` |
| Loading screen on phones without the GL plate (the master painting itself) | VERIFIED (932x430) | `node scripts/loadshot.mjs` |
| Sound in the native app: AVAudioSession playback + unlock on touchend/click + resume | BUILT (iOS build succeeds); on the device UNVERIFIED | `ios/App/App/AppDelegate.swift`, `audio/audio.ts` |
| Fight stutter: fixed light slots, shader prewarm (0 shader links mid-fight in 200 s bot matches), projectile pool, adaptive render scale on phones | VERIFIED (compile probe); iPhone frame rate UNVERIFIED | `view.ts` `prewarm`, `perf` |
| Feet on the floor: two-bone leg IK in standing states + contact shadows | VERIFIED (screenshots, filmstrips) | `glbRig.plantFeet` |
| Touch controls: thumb-arc layout sized by screen height, chunky icon buttons, floating stick | VERIFIED (screenshots 932x430) | `Q=low node scripts/hudshot.mjs out.png 932 430 1` |
| Hit VFX lighter: see-through stars with a hot core, smaller; inverted frame only for KO/signatures | VERIFIED (VFX sheet before/after) | `node scripts/vfx.mjs` |
| FREUNDE: own code, add by name + code, search, challenge → lobby (list on the device) | VERIFIED (e2e-style flow + screenshots) | `node scripts/v2shot.mjs "showFriends()"` |
| Kämpferwahl + VS: home town under the names | VERIFIED (screenshots) | `node scripts/v2shot.mjs` (select, VS) |
| Waiting poses per fighter (no "candle"), KÄMPFER swipe/tap + deck, in-screen taps without fade | VERIFIED (screenshots) | `render/anims/showcase.ts` |
| Bonez Lila Becher (replaces Abriss), Manuellsen König im Schatten (replaces Beton; sim `warp` + `reverse`), Lacazette Drei Buchstaben + Chart-Einstieg (replace Kalter Blick / Daunenweste) | VERIFIED (unit tests, film strips) | `tests/abilities.test.ts`, `node scripts/filmstrip.mjs` |
| 5000 Kurden: waving flag of Kurdistan (Ala Rengîn) | VERIFIED (film strip) | `abilities11.ts` `kurdistanFlagTexture` |
| Sofa-Backpfeifen two stages (KO sleeping on the sofa, pssst, König im Schatten with crown + spot, sofa kicked over) | VERIFIED (cine sheets) | `Q=medium node scripts/cine.mjs sofa` |
| 70 Schüsse second stage (collar grab, KALTER BLICK two-shot, push kick) | VERIFIED (cine sheets) | `node scripts/cine.mjs gwagon` |
| Blunt: joint in his hand at the lips, face close-up on the second drag (smoke up, face visible) | VERIFIED (cine sheets) | `node scripts/cine.mjs blunt` |
| Ninetynine re-choreographed (lasso in sync, conductor hits with anticipation, run-up, kick, backflip home) | VERIFIED (pose sheets + cine sheet) | `node scripts/posesheet.mjs jazeek "cine:jaz_99:4-160:8"`, `node scripts/cine.mjs 99` |
| Menu art-style rebuild (PO item 15) | NOT DONE — waits for the PO's artworks (buttons, characters, banners, cards) | |
| Checks: unit 91/91, typecheck, build; e2e 35/35 (new: a deck saved before S12 with a removed card opens as the default deck instead of crashing); netplay 60 ms (13 rollbacks, 0 checksum mismatches). Artifact not republished this round (PO: next review after the animation + design work) | VERIFIED | `npm test`, `npm run e2e`, `node scripts/netplay.mjs 60` |

## Session 11 — modelle-3 roster, cel look, new abilities, living menus, v2 everywhere (D43)
| Area | Status | Evidence |
|---|---|---|
| All four fighters = the PO's modelle-3 models (reduced, rigged, GG print retouched on Jazeek); 2D cutouts removed | VERIFIED (lab, match, menus, close-ups) | `tools/meshy/reduce.py --dir meshy3`, `skin.py`, `?quick=manuellsen,lacazette` |
| Cel look: MeshToonMaterial (metal 0 / rough 1) + black ink outline, `?toon=0` fallback | VERIFIED (screenshots) | `render/cel.ts` |
| Strikes reach their hitboxes on the new proportions (lunge fit per move) | VERIFIED (`reach.mjs`; tall uppercuts/palm a little short) | `node scripts/reach.mjs jazeek` |
| Living v2 menus (depth parallax, crowd on the beat, lights, haze) | VERIFIED (frame diff) | `node scripts/livingshot.mjs` |
| KÄMPFEN button re-cut with chains, black brush lettering with drips | VERIFIED (screenshot) | `tools/ui-extract/v2_fight_btn.py` |
| Kämpfer screen: names centred on the cards, card colour behind the portraits | VERIFIED (932x430) | `node scripts/v2shot.mjs "showFighters()"` |
| Manuellsen: 5000 Kurden (mob, 3 hits), Beton (armour + heavy right), Sofa-Backpfeifen signature | VERIFIED (unit tests, film strips, cine sheet) | `tests/abilities.test.ts`, `Q=medium node scripts/cine.mjs sofa` |
| Lacazette: Kalter Blick, Daunenweste, 70 Schüsse signature (car drifts in, driver's side to the opponent, 70-shot counter, the line) | VERIFIED (tests + cine sheet); Blick/Weste strips not captured | `node scripts/cine.mjs gwagon` |
| Jazeek: Ninetynine signature (replaces Herzbrecher in the deck); Blunt für dich reworked (carry, cloud, joint, smoke, exhale launch) | VERIFIED (tests + cine sheets) | `node scripts/cine.mjs 99`, `MOVE=0 node scripts/cine.mjs blunt` |
| Bonez: Ohne mein Team signature (palms, HANDYVERBOT, crew pile-on, big right hand; replaces Palmen-Bassdrop in the deck) | VERIFIED (tests + cine sheet) | `node scripts/cine.mjs team` |
| Card art for the eight new cards | VERIFIED (deck and HUD screenshots) | `ui/portraits.ts` |
| v2 profile, settings, deck in the ring (living plate, live favourite fighter); results + pause over the arena; v2 HUD skin | VERIFIED (1672x941 + 932x430 screenshots, e2e checks) | `node scripts/v2shot.mjs "showProfile()"`, `node scripts/v2match.mjs` |
| Checks: unit 91/91, typecheck, Artifact payload under CSP (4 models, arenas, props, v2 art); Artifact **version 20** published | VERIFIED | `npm test`, `node scripts/artifact-check.mjs` |
| e2e 34/34 (v1 desktop + phone flows, v2 flow, new v2 profile/settings/deck checks) + perf probe; netplay 60 ms (16 rollbacks, 0 checksum mismatches) | VERIFIED | `npm run e2e`, `node scripts/netplay.mjs 60` |
| Feel of the new abilities, iPhone performance of the ink outline and the living plates | UNVERIFIED (PO test on the device) | |

## Session 10 — design v2, slower specials, reworked abilities, two cartoon fighters (D42)
| Area | Status | Evidence |
|---|---|---|
| Old design saved: commit c0e46a0 in the branch history (local tag `design-v1`; pushing tags is refused by the git proxy) + switch in the game (EINSTELLUNGEN → DESIGN, `?ui=v1\|v2`) | VERIFIED (switch in screenshots) | `src/ui/design.ts` |
| v2 home, character select, arenas/modes, VS, loading, Kämpfer, Kämpfer anpassen, Freunde-Lobby from the PO masters, German text, depth effects, live 3D fighters | VERIFIED (Chromium 1672x941 all eight; 932x430 / 844x390 home, select, arenas, VS, lobby; WebKitGTK 932x468 DPR 3 for home + select) | `node scripts/v2shot.mjs "showHome()" artifacts/v2/home` (also `showFightersV2()`, `showCustomV2('bonez')`, `showLobbyV2()`), `node scripts/webkit.mjs` |
| v2 flow home → select → arena → VS → match (e2e), v1 flows still pass with `?ui=v1` | VERIFIED (e2e 29/29) | `npm run e2e` |
| Menu fighters stand upright (showcase pose), POSE toggle | VERIFIED (screenshots) | `node scripts/posegrid.mjs` |
| Specials / Signature cinematics at half speed (sim + render) | VERIFIED (tests 81/81, captures) | `RULES.CINE_RATE` |
| Diamanten-Regen: chain flash, warning ring + light shaft at the opponent, then a shower of many small sparkling diamonds, 3 hits from above, dodge/block | VERIFIED (tests + capture sheet) | tests/fighters.test.ts, `node scripts/rainshot.mjs` |
| Blunt für dich as a grab + giant-joint cinematic (roll in, 3 drags, pop); victim measured onto the joint axis, arms/legs inside the paper | VERIFIED (tests + frame captures; geometry probe) | `node scripts/cine.mjs blunt`, `node scripts/blunt-measure.mjs 72,78` |
| Croc bigger, calmer camera (three wide shots: run, bite + drag, toss) | VERIFIED (capture) | `node scripts/cine.mjs croc` |
| Manuellsen + Lacazette as 2D cutouts from the PO's drawings, movement + normals, no cards | VERIFIED (lab + match screenshots); feel UNVERIFIED (PO test) | `python3 tools/characters/cutout.py`, `?quick=manuellsen,lacazette` |
| WebKit engine check (WebKitGTK MiniBrowser via WebDriver): home, select, Kämpfer anpassen, Lobby render fully at 932x392 DPR 3 | VERIFIED here; iOS Safari itself still UNVERIFIED | `node scripts/webkit.mjs` (AFTER=7000 lets the entrance animations finish) |
| Checks: unit 81/81, typecheck, e2e 29/29 (desktop + phone v1 flows, v2 flow) + perf probe, netplay 60 ms (22 rollbacks, 0 checksum mismatches), Artifact payload under CSP incl. v2 art + cutout fighters; Artifact published as **version 19** (page + rapbrawl.js + `assets/ui2/**` + the two cutout fighters) | VERIFIED | `npm test`, `npm run e2e`, `node scripts/netplay.mjs 60`, `node scripts/artifact-check.mjs` |
| Screens without a v2 master (fight HUD, deck/Karten, Profil, Einstellungen, Ergebnis, Shop, Bestenliste) keep their v1 look in both designs | as before (D37/D38) | masters needed from the PO |
| Arena screen big backgrounds: in-game renders at 1672x941 for all six arenas (an arena without one falls back to its thumbnail) | VERIFIED (screenshots) | `BIG=1 node scripts/arena-thumbs.mjs festival,bahnhof` |

## Session 9d — iPhone test by the PO: crashes, layout on short screens
| Area | Status | Evidence |
|---|---|---|
| Crashes on iPhone: GPU memory budget (2K/1K textures on phones, one shared menu GL context, game context released in menus, 1.5x render scale) | BUILT; texture memory measured in phone emulation ~400 → ~140 MB; on-device UNVERIFIED (PO re-test) | D41 |
| iOS landscape text inflation off (`text-size-adjust`) | BUILT; Safari-only, UNVERIFIED here | D41 |
| Character select + arena/mode windows fill short, wide screens (logo cropped, ~1/3 bigger) | VERIFIED (Chromium 750x300, 844x390; desktop unchanged) | `node scripts/flowshot.mjs out 750 300` |
| Mode tiles show their subject (zoom/focus), description text keeps word spaces | VERIFIED (screenshots) | same |
| Classic screens: no logo behind titles, Profil/Karten/Einstellungen fit or scroll, settings two columns | VERIFIED (screenshots 750x300) | `node scripts/screens.mjs out 750 300` |
| Fight camera leaves room for HUD bars and card hand on touch layouts | VERIFIED (screenshots 750x300, 844x390) | `Q=low node scripts/hudshot.mjs out.png 844 390 1` |
| Checks: unit 80/80, e2e 25/25 + perf probe, phone flow fight → menu (view released) → fight; Artifact payload under CSP (split page) | VERIFIED | `npm test`, `npm run e2e`, `node scripts/artifact-check.mjs` |

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
| Checks: unit tests 80/80; e2e 25/25 functional checks (desktop + phone; the scripts now skip the round-1 showcase and wait for the KO → fatality window → results flow); netplay 60 ms (FREUNDE room code, 24 rollbacks, 0 checksum mismatches); Artifact payload loads models, all 8 props and all arenas under an Artifact-like CSP | VERIFIED | `npm test`, `npm run e2e`, `node scripts/netplay.mjs 60`, `node scripts/artifact-check.mjs` |

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
- Fighters are the PO's modelle-3 models; the sculpted hands are open and are curled into fists at runtime, which stretches the finger geometry a little up close (guard hands still look slightly claw-like). Likeness/name rights for all four real persons are not cleared (see below).
- Crew extras in Ohne mein Team / 5000 Kurden are procedural low-detail figures (hoodies); they read at distance, not in close-ups.
- A projectile signature (70 Schüsse, croc) that hits an airborne opponent juggles instead of starting the cinematic (by design: jumping is the escape).
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
- **Manuellsen / Lacazette**: name and likeness rights (real persons) before any release. Their abilities reference real memes/scandals (the Animus slap video, "5000 Kurden", "70 Schüsse aus dem G-Wagon") — check with them and a lawyer; the meme line says 5000 (the PO wrote 3000 — one constant to change). The car is a generic off-roader without badges; gunfire is shown as toy-like flashes (USK).
- **Figma**: to work in Figma directly, connect Figma under claude.ai → Settings → Connectors and start a new session; until then `design/v4/*.svg` are dragged into Figma by hand (guide in `design/v4/README.md`).
- **Design v4 masters** show real places (Frankfurt Hbf, Pallasseum, Schöneberg): the station's DB / S-Bahn marks were retouched out of the game copies; the home master still shows real-looking business signs ("YOK YOK KIOSK", "Moseleck") as painted — kept 1:1 as the PO asked; check them (and the source/licence of the master images) before release, fictional names are a quick retouch.
- **Design v2 masters** contain generic AI art (the lobby's example friends, preset figures): the game shows its own fighters there; the masters' crown logo and RB belt are the PO's brand.
- **Lila Becher (Bonez)**: lean (codeine drink) from a generic purple double cup, no brand — like Blunt für dich a depicted
  drug use (USK, the artist's reputation); decide before release (option: a fictional "Lila Saft").
- **Flag in 5000 Kurden**: the flag of Kurdistan (Ala Rengîn) as the PO asked — a political symbol; deliberately no party or
  PKK symbols. Check with Manuellsen and for the release markets.
- **Lacazette's new cards** quote his three-character song titles and chart entries (taken from public sources) — confirm
  with him; the "NRW-Verbot" meme the PO mentioned could not be verified and is not used.
- **Blunt für dich**: a real person (Jazeek) rolling and smoking a joint — affects the USK rating (drug use depicted) and is a reputation question for the artist; decide before release (option: a neutral "Zigarre"/vape or a fictional herb).
- **Arena paintings**: the PO's two images contain real brands/businesses (festival logo, bar and kiosk names); the game uses retouched copies with fictional names (FESTIVAL-BÜHNE, PIK ASS, KIOSK 069, WEINECK). Check the image source/licence of the paintings themselves.
- **Crowd look**: built from primitives in the game-art style; for a richer look, a few rigged stylized crowd models (prompt on request) could replace them.
- Hosting decision for signaling/matchmaking + TURN.

## Next objectives (suggested order)
0. PO re-test on the iPhone (new IPA from the latest push): menus (never black / never only sprites), sound, fight smoothness, feet, touch buttons, the new abilities and the two-stage signatures; report any screen that still breaks with its name.
0b. PO artworks (announced) for cards, items, characters, select boxes and banners: drop-ins under `public/assets/ui4/art/` (banners, `select/<id>.webp`, `skins/<id>_<1-6>.webp`) and `public/assets/cards/<id>.webp`; paths and sizes in `design/v4/README.md`, then `npm run build` lists them.
0c. Animation polish on the new bodies: guard hands, tall uppercut reach, per-fighter idle for Manuellsen/Lacazette (they borrow Bonez's/Jazeek's sets).
1. Human playtest on a real phone (APK / Artifact) → tune touch layout, hitstop, damage, meter, charge rate, fatality minigame timing.
1b. Online "Gegen Freunde" (room code) flow polish (PO: later); outfits/accessories once the PO's assets exist.
2. Integrate delivered art (card art via `ui/icons.ts` replacement, portraits, GLB characters mapped onto the joint/pose system).
3. Online v2: signaling server + quick match, TURN, rematch.
4. More content: third fighter, second arena, more cards per fighter.
