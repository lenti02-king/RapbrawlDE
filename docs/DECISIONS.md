# Architecture decisions

Append new decisions; mark superseded ones instead of deleting them.

## D1 — Technology: TypeScript + Three.js + custom deterministic sim + Capacitor (2026-10-03)
**Context.** Mobile-first premium fighter, online 1v1 with rollback later, cinematic supers, built and maintained by an AI agent in a Linux container (no GPU, no macOS, Android SDK download blocked, no engine editors available).

**Options considered.**
- *Unity / Unreal*: strong tooling, but editor-centric (scene/asset files hard to author/verify headlessly), licensing/account activation, heavy; Unreal is overkill for mobile 2.5D. Not installable here.
- *Godot 4*: good open-source fit, native mobile export. But binary downloads are blocked in this environment, its physics/float math is not deterministic across platforms (we'd write our own integer sim anyway), and headless visual verification is weaker.
- *Rust (Bevy + GGRS)*: excellent rollback story, but immature mobile/asset pipeline and slow iteration; hard to visually verify here.
- *Web stack (TS + Three.js) wrapped with Capacitor*: everything can be built, run, unit-tested and **visually verified** in headless Chromium right here; instant playable builds via URL for the product owner; Capacitor ships the same build to App Store / Google Play; WebRTC DataChannels give UDP-like transport for rollback.

**Decision.** Web stack. Simulation is engine-independent TypeScript with integer fixed-point math, so it could be ported (or run server-side) without touching game rules. Rendering via Three.js (lightweight, full control). Vite build, Vitest + Playwright verification, Capacitor for native shells.

**Risks.** WebView performance on low-end Android; GC hitches; thermal. Mitigations: small draw-call budget, pooled particles, capped DPR, no per-frame allocations in hot paths (ongoing), quality settings. Real-device FPS is UNVERIFIED until tested on phones.

## D2 — Perspective: 2.5D (3D characters on a 2D gameplay plane) (2026-10-03)
Free 3D arena combat needs 360° movement (bad on a virtual stick), lock-on cameras, much more animation and much harder netcode/hit detection. 2.5D keeps spacing readable, touch controls simple (left/right/jump/crouch), hitboxes 2D and deterministic, while the 3D renderer allows camera swings for cinematic specials and social-media moments. Chosen: 2.5D.

## D3 — Deterministic integer simulation, presentation strictly separated (2026-10-03)
`src/core` owns all gameplay truth: 60 Hz fixed step, integer units (10000/m), plain-data state, seeded RNG in state, events out. Rendering/audio read state + events only. This makes rollback, replays, spectating, server validation and bots straightforward. Cinematics are a sim state with a frame counter; presentation timelines are keyed to it.

## D4 — Rollback netcode (GGPO-style), transport-agnostic (2026-10-03)
`net/rollback.ts`: input delay (default 2) + prediction (repeat last input) + snapshot restore and silent re-simulation (max 8 frames) + redundant input packets + smoothed frame-advantage time sync + confirmed-frame checksums. Transport interface so we can plug WebRTC DataChannels (unreliable/unordered) for P2P, or a relay server. Matchmaking/signaling server not built yet (needs hosting = product-owner decision).

## D5 — Controls: dedicated buttons, mobile-first (2026-10-03)
Light, Heavy, Grab, Block (+ hold-back also blocks), 3 special-card buttons, left floating stick. Direction + button modifies normals (down = low, forward+Heavy = overhead). No motion inputs (quarter circles) — specials are card buttons with meter costs, which suits touch and makes the card loadout tangible. Double-tap for dashes.

## D6 — Special cards: meter-cost, 3 equipped of 6, max 1 Signature, no power-by-rarity (2026-10-03) — slot layout superseded by D14
Cards define tactical options, not stats. Rarity (future) is cosmetic only. Validation in `core/registry.ts`.

## D7 — Placeholder assets are procedural (2026-10-03)
Characters are procedural toon rigs (primitives + outlines), arena is procedural, all audio is synthesized at runtime. Zero licensing risk. Rig exposes named joints and pose arrays so authored glTF models can replace it while keeping move clips/frame data.

## D8 — Paid generative tools not used (2026-10-03) — still in force: the product owner offered to create assets in Higgsfield themselves (session 2)
A Higgsfield MCP (generative image/video/3D, credit-based) is connected in this environment. Not used: it incurs costs and outputs need licensing review. Ask the product owner before using.

## D9 — Online v1: serverless P2P with copy/paste codes (2026-10-04)
To prove netplay without any hosted service or cost: WebRTC DataChannel (unordered, no retransmits) with manual signaling (deflate+base64 invite/reply codes, ~600 chars) and Google's public STUN. Same-device BroadcastChannel transport for testing with simulated lag. Known limits: no TURN relay (symmetric NATs fail), no matchmaking. A real signaling/matchmaking server + TURN needs a hosting decision from the product owner (cost).

## D10 — Single-file web build for instant sharing (2026-10-04)
`scripts/single-file.mjs` inlines JS, CSS and fonts into one HTML page (~1.2 MB) so the build can be hosted anywhere that serves a single page (used for the claude.ai Artifact preview). The normal build (`dist/`) stays multi-file for Capacitor/Pages.

## D11 — Characters baked to one skinned mesh (2026-10-04)
Procedural rig parts are baked into one vertex-coloured SkinnedMesh + one skinned outline pass (2 draw calls per fighter, was ~80). Poses still drive the same joint bones, so authored glTF characters can drop in later.

## D12 — Real roster replaces the placeholder fighters (2026-10-04)
The product owner chose the first two fighters: **Jazeek** (tempo/counter) and **Bonez MC** (reach/pressure), designed from their profiles to be equal in strength. VOLT/BRICK stay registered as `hidden` fighters (tests, dev URLs) but are not in the UI roster (`content/index.ts` `ROSTER`). Rights to names/likenesses are still to be cleared by the product owner before release; no third-party logos are used.

## D13 — Clash-Royale-inspired presentation, original assets (2026-10-04)
Look: chunky stylized characters with big heads and soft shading (MeshStandardMaterial, no outline), warm saturated arena, chunky 3D buttons, blue (you) vs red (opponent) sides, gold primary actions, cards with cost badges, crowns for rounds, bottom navigation. Inspired by the genre, nothing copied: own fonts (Lilita One + Nunito, OFL), own SVG icons, own layouts and colours. Portraits are rendered once at startup from the real rigs in a short-lived second WebGL context (`ui/portraits.ts`) so menus always match the in-game models.

## D14 — Deck = 2 Specials + 1 Signature in a fixed slot (2026-10-04) — supersedes the "3 of 6" part of D6
The Signature was hard to find with three generic slots. Slot 3 is now always the Signature (key O, golden card), specials sit in slots 1–2 (U, I). Rarity still never changes power.

## D15 — Precision over input density (2026-10-04) — refines D5
Forward+Heavy no longer maps to an overhead (accidental overheads while walking on a touch stick); overheads come from jump-ins. The touch stick is sector-based (wide horizontal sectors, deadzone and hysteresis) and buttons capture their pointer. Special moves stay on card buttons (no motion inputs).

## D16 — HUD pop-ups driven by the game loop (2026-10-04)
Announcer, card banners, signature card reveal and the "SIGNATURE BEREIT!" banner are tweened in `Hud.update` instead of CSS keyframes: deterministic, testable, and immune to the browser deferring animation starts under load (observed in headless Chromium).

## D17 — Cinematic props and prop lights are created up front (2026-10-04)
Signature props (hearts, palms, crocodile, spotlights) are built when cinematics are installed; their real lights stay in the scene at intensity 0, so the first signature in a match never triggers shader recompilation or allocation hitches.

## D18 — Realistic rendering on WebGL with quality tiers (2026-10-04) — supersedes the cartoon look of D13 for 3D
The product owner asked for an "Unreal Engine realistic" look like their reference renders. Approach within WebGL/mobile limits: PBR materials from procedurally generated texture sets, real-time shadows, image-based lighting from a dusk sky, HDR post-processing (bloom, grading, vignette, MSAA), planar reflections on wet ground on the high tier. Tiers: `high` (desktop), `medium` (phones: smaller shadow maps, cheaper bloom, no reflections), `low` (no post/shadows; used by headless tests). The menu UI stays in the chunky mobile-game style.

## D19 — Real character models via retargeting, procedural rig as reference (2026-10-04)
Photoreal characters need authored/generated meshes. `GlbRig` loads `assets/characters/<id>.glb` (humanoid, Mixamo bone names), aligns its rest pose to the procedural reference rig (bone directions), and applies each joint's world-space rotation delta every frame, plus scaled hip translation. All existing clips (moves, throws, cinematics, intros, wins) work unchanged; the procedural rig remains the fallback. Verified with Mixamo test models (not shipped).

## D20 — Low tier is a genuinely cheap renderer (2026-10-04)
CI ran red twice after the realistic courtyard landed: even at `q=low` a frame cost ~650-800 ms in SwiftShader, so wall-clock-bound E2E steps timed out. Measured cost split: image-based light ~40 %, arena PBR shading most of the rest. `low` now converts the arena to Lambert materials (same geometry, colours and albedo maps), skips the PMREM environment, and replaces the three local lights (LED point light, two stage spots) with additive light-pool decals: ~340 ms per frame in SwiftShader, about half. The same tier is meant for weak phones. E2E steps now wait for events (VS splash recorded by a MutationObserver, stick sampled by the sim) instead of fixed sleeps.

## D21 — Fighters are generated with Blender from MakeHuman data (2026-10-04)
The product owner asked for SF6-like realism without ultra detail, made by the agent. No image-to-3D tool is available to the agent, so the models are built by `tools/characters` with Blender as a Python module (pip `bpy`): MakeHuman 1.1 base mesh, targets, skins, hair, clothes and default skeleton (npm package `makehuman-data`; bundled assets CC0), shaped per fighter (heroic proportions), dressed with recoloured clothes and procedural accessories, fists baked into the rest pose, skeleton reduced to 22 Mixamo-named bones so `GlbRig` retargets the existing pose system unchanged. Only CC0/CC-BY assets are accepted (the build fails otherwise). Faces stay generic (likeness needs scans/sculpting). ~30k triangles per fighter, ~5 MB GLB.

## D22 — "Block Beats Night" UI (2026-10-04) — supersedes the CR-inspired look of D13 for menus
Product owner's reference: dark AAA mobile-fighter menus. Own design: near-black glass panels, one gold accent, violet only from the arena LEDs, Anton/Barlow Condensed/Barlow (OFL, bundled), angled cuts, line icons, in-engine renders as key art and card art. Only features that exist are shown (no shop/battle pass/currency); profile progression is local and labelled as such.

## D23 — Menus without the 3D scene (2026-10-04)
Product owner: the start screen should be a plain menu; arena and fighters load only when a fight starts. `App.view` is created lazily on the first match; menus use in-engine renders (portraits, key art) instead of a live scene, so the title/lobby cost no GPU time on phones.

## D24 — Button-only target combos (2026-10-04)
Normal punches and kicks never use cards; cards are only abilities and the Signature (tap on phones). More combos come from target combos in the move data (`MoveDef.targets`, light/heavy with a minimum chain depth): L·L·L and H·H end in a dedicated finisher per fighter, standing only and only on contact, so they cannot be used to whiff-cancel. Jab push on hit was lowered so jab strings stay in range.

## D25 — Cartoon hit language on top of the particles (2026-10-04)
Hit VFX use one readable vocabulary instead of more particles: ink-outlined impact stars sized by strength, screen-space speed lines on heavy hits, smears behind the striking limb (limb chosen from the hitbox and recent travel), cel-shaded dust, ground cracks and rubble on slams, and an impact frame (manga tri-tone in the grade pass, inversion on the low tier) on counters, KOs and Signature finishers. Bursts follow the impact frame so silhouettes read. A setting ("Blitzeffekte") turns impact frames off for photosensitive players.

## D26 — Fighters from the product owner's Meshy sculpts (2026-10-04) — supersedes D21 and the cartoon fighters
After the cartoon pass the product owner supplied two Meshy AI sculpts (untextured, unrigged, 300k/500k vertices) to be turned into Jazeek and Bonez MC. `tools/meshy` paints them per region (rules on position + a surface-detail measure that separates curls, stubble and quilting from skin), bakes AO, decimates to 50k triangles with face/hands protected, unwraps a smoothed proxy with seams per body part (face on its own island at ~3× density), bakes albedo/normal/ORM, rigs with bone heat and bakes fists into the rest mesh. The game fits these models to the fighter's gameplay height (glTF extras) instead of the cartoon rig's hip height, so reach matches the hitboxes. Sources stay outside git; licence depends on the product owner's Meshy plan.

## D27 — Models must load under the Artifact sandbox CSP (2026-10-04)
The Artifact page may only fetch its own files (no `data:`/`blob:` in connect-src). GLTFLoader fetched the base64 buffer of the `.gltf.json` and decoded textures via `fetch(blob:)`, so every Artifact version since the GLB pipeline silently fell back to the procedural placeholders. The loader now rebuilds the GLB in memory from the JSON and decodes textures through `<img>` (allowed for blob:). Load failures are no longer silent (on-screen note), and `scripts/artifact-check.mjs` reproduces the CSP locally and must pass before publishing.

## D28 — The product owner's textured Meshy models are used 1:1 (2026-10-04) — supersedes D26
The product owner supplied textured Clash-Royale-style Meshy models (≈900k triangles, 8K base colour, 4K normal and metal/roughness, 69–72 MB each) with the instruction "1:1, keine Verschlechterung"; the whole game moves to that style. `tools/meshy/skin.py` adds a skeleton without re-exporting the model: bone heat runs on a watertight voxel helper in Blender, numpy transfers the weights to every original vertex, and the original GLB is rewritten with the same JSON objects and binary chunk, only appended (JOINTS_0/WEIGHTS_0, inverse bind matrices, joints, skin, extras). Joints come from per-fighter landmarks (`tools/meshy/<id>_cr.py`) measured on the original mesh, also when a reduced copy is rigged, so both get the identical skeleton. The open sculpted hands get finger/thumb bones that the game curls into fists at runtime (`rb_fist`).
Shipping the originals is not viable (download size, the Artifact's 15 MB per-file limit, and ≈1 GB of GPU memory for two 8K materials on a phone), so the game ships a reduced copy (`tools/meshy/reduce.py`): 120k triangles by collapse decimation (UV islands are separate geometry, seams survive), base colour 8K→4K (Lanczos from the original JPEG bytes), normal and metal/roughness 4K→2K; no repainting or re-baking. Side-by-side renders in the engine (original vs. game version, same rig) show no visible difference at gameplay distance and only slightly softer texture detail in extreme close-ups. The originals stay outside git and can be dropped in for comparison (`?glb=id:test-models/<id>_cr.glb`).

## D29 — Podcast arena baked in Blender, presented with an arena-specific look (2026-10-04)
The product owner's concept ("BLOCK BEATS PODCAST" studio) replaces the courtyard as the default arena. `tools/arena/podcast.py` builds the set from primitives and procedural materials in Blender (neon lettering from OFL fonts, Kaushan Script and Anton) and bakes it with Cycles: one 4K colour atlas multiplied by a 2K diffuse-light pass for the static set, a tileable plank texture with a baked lightmap for the floor, the rug baked separately. Bounce light and soft shadows are therefore free at runtime; only emissive parts (neon, LEDs, ON AIR, ring lights, mixer buttons) are dynamic and animate with beat, hype and hits. Fighters get real-time lights matching the bake (warm key, purple and gold rims), a shadow catcher, a soft studio environment for metals and, on the high tier, a blurred planar floor reflection. An arena can carry a `look` (AgX tone mapping, neon-only bloom threshold, exposure, saturation, contrast) applied by `PostFX.applyLook`, so the white clothes stay unbloomed. Old arenas stay available with `?arena=courtyard|club|toon`.

## D30 — Animation: aimed limbs, cross-fades instead of a lag filter, cartoon deformation (2026-10-05)
The product owner asked to improve and refine movement and strike animations. Film strips showed three causes of weak
motion: (1) poses were authored as local Euler angles on a torso that is already twisted ~40-80° toward the camera, so
"arm forward" pointed AT the camera and most strikes were foreshortened to nothing in the side view (it also misled the
earlier hitbox checks, which looked at projected overlap); (2) the animator blended every frame toward the target with an
exponential filter, which softened every snap and delayed contact poses; (3) the CR-proportioned models have short limbs.
Changes: poses can aim a limb segment at a direction in character space (`PoseDef.aim`, solved after composition in
`toArr`), so strikes travel along the screen plane whatever the torso twist; the animator samples each clip on the sim's
frame clock and only cross-fades between animations (1-8 frames by kind), restarting on a new hit/block of the same kind;
five deformation channels (arm/leg stretch along the bone, body squash) give anticipation, impact and landing weight
without touching the sim; normals are built by `strike()` (anticipation, contact, follow-through, settle) and movement by
`motionClips()` (4-key shuffle walk driven by distance, dash burst and plant, jump squash/stretch, impact-snap reactions).
Every normal's fist/foot is checked against its sim hitbox (`scripts/reach.mjs`), so what players see matches what hits.

## D31 — Perfect block, launcher air combos and wrestling slams (2026-10-05)
The product owner asked for better blocking, more combos, better grabs ("wrestling or MMA slams") and fresh variety, all
easy on a phone. Chosen: a timing-based perfect block on the existing Block button and on a back tap (one input, high
skill ceiling, readable reward: gold flash, "PERFEKT-BLOCK!", counter-hit punish), anti-mash lock; one launcher string per
fighter (H·L) with jump-cancel on hit and an air chain (jL→jH), so air combos need only taps and an upward swipe; grabs
became slams with a forward and a back variant (back + Grab) using the existing throw-direction support. All in the
deterministic sim with tests (perfect block, mashing, air combo for both fighters); bot balance unchanged (52/48).

## D32 — Cartoon main menu (2026-10-05) — supersedes the "Block Beats Night" look of D22 for the menus
The product owner wants a main menu at app start laid out like popular mobile arena games, in their playful, childish
style. `src/ui/cr.css` (loaded last) gives every menu a sky-blue background, thick navy outlines, 3D candy buttons and
Lilita One/Nunito (OFL); the home screen is rebuilt: player bar (level star, XP, rank, wins), the arena card with the
selected fighter, rank road, fighter, deck and a big KAMPF! button, and a five-tab bar (Kämpfer, Karten, Kampf,
Training, Profil). Only real features are shown (no shop, chests or currencies — monetisation is the PO's call). Icons
(`ui/toon-icons.ts`) and layout are original; no third-party game assets, fonts or logos.

## D33 — Signature music: licensed drop-in, original stingers by default (2026-10-05)
The product owner wants the fighters' songs during special moves. In Germany short excerpts are not automatically free
(sampling and synchronisation need the rights holders' consent; GEMA administers performance rights, the game sync
licence comes from the publisher and the master from the label). The game therefore plays `assets/music/<fighter>.mp3`
(optional excerpt window in `<fighter>.json`) only if the PO adds licensed files; otherwise an original procedural
stinger per fighter plays over the Signature cinematic and the in-game beat ducks. No third-party music is committed.

## D34 — Night-street menus and the fight flow Mode → Fighter → Arena → Loading (2026-10-05) — supersedes D32's look
The product owner sent four inspiration boards (main menu, loading screen, arena select, character select) and asked
for game modes instead of characters on the main menu, fighters picked only when a fight is entered (Tekken-style: P1
big on the left, P2 big on the right, roster in the middle), then the arena. `src/ui/street.css` + `src/ui/street.ts`
(original procedural SVG art: graffiti logo with crown and mic, night city, concert stage with truss and crowd, brush
banners; fonts Permanent Marker (Apache 2.0), Lilita One, Nunito (OFL)). Modes: Schneller Kampf, Online (friend code),
2 Spieler, Rangliste, Training. "Rangliste" is an offline CPU ladder with local rank points (tiers decide the CPU level)
— real online ranking needs a server (PO decision). The boards' shop, coins/gems and battle pass were not built
(monetisation is the PO's call); their slots show real features (Straßen-Rang progress, a news banner). Arena select
offers the four existing arenas (thumbnails rendered in-game by `scripts/arena-thumbs.mjs`) plus two announced ones.

## D35 — Mic-Duell, Wand-Splat, Beat-Drop, Fatality (2026-10-05)
Chosen by the PO from the session 7 brainstorm, all in the deterministic sim (rollback-safe) with tests:
- **Beat-Drop**: the music runs at 90 BPM = 40 sim frames per beat; hits within ±4 frames of a beat deal +15 % damage
  and double Hype. The sim's beat clock is the truth; the audio engine nudges the music onto it (`syncBeat`).
- **Mic-Duell**: a trade involving a heavy-class hit (both grounded, 15 s cooldown) becomes a 2.5 s tap duel; the
  faster tapper sends the other flying (90 damage). Phones: the whole screen is the tap button.
- **Wand-Splat**: strong knockdowns (strength 3 knockback) or a duel loss into the stage wall stick the opponent to it
  for 42 frames (still hittable, two extra juggle hits); KO flights into the wall bounce with a "Wand-Finisher".
- **Fatality**: at match point the beaten fighter staggers up (phase `finish`, 3.5 s); the winner presses SIGNATURE (or
  any card button) for a 5 s finisher, which ends with the winner mocking the loser. Cartoon brutality only (squash,
  stars, a crocodile death roll, a falling platinum record) — no blood or gore, given real people are depicted.

## D36 — Strike variations, new abilities, card art that shows the ability (2026-10-05)
Each fighter got two new button strings (no new buttons, phone-friendly): L·L·H and 2L·H (stick released) — Jazeek's
flying knee and back-flip kick (launcher), Bonez's headbutt and clinch knee. New cards: Jazeek "Diamanten-Regen" (an
overhead zone of falling diamonds 1.4–2.6 m ahead) and Bonez "Tiefergelegt" (a lowered tuner car drifts in from behind
him; generic design, no brand or badge — the PO's "Honda Civic" idea without the trademark). A pistol ability was not
built: guns on a real person are a reputational/age-rating risk the PO should decide on explicitly. Card art now renders
the ability's props (waves, notes, hearts, diamonds, croc, smoke, wrecking ball, palms, car) around the fighter.

## D37 — Head stabiliser, dynamic fists, arena light probe, special auras, sound and music (2026-10-05)
The head kept looking at the sky or away during strikes: after blending, `stabilizeHead` turns neck+head toward the
opponent (moves 0.85, movement 0.7, reactions 0.2; per-move override `AnimSet.headFree` for headbutts/flips; nod clamped,
max 75° relative to the chest). Fists close further when the arm extends, thumbs fold over the fingers (per-model axis).
Fighters get an environment map rendered from the arena itself (`GameView.buildProbe`) so they pick up its colours.
Card specials get a coloured aura (rune circle, energy pillar, light, limb trails) instead of only impact stars. Hits are
layered (transient, body, thump, sub boom + crunch on heavies, saturation bus). The background music is an original,
procedurally performed 90 BPM rap beat ("Block Beats", 32-bar form) — GEMA-free; a `bgm.mp3` drop-in (git-ignored, so
unlicensed songs never reach the public repo) replaces it for the MVP if the PO adds one.


## D38 — PO screenshots are the visual master; menus are cut from their pixels (2026-10-05)
The PO supplied final UI screenshots (2000x1125) and asked for maximum fidelity: no redrawing, art cut from the images,
text and logic native. `tools/ui-extract/` does this per screen: GrabCut masks per panel (frame interior seeded as
foreground), LaMa inpainting (Apache-2.0 TorchScript model, CPU, `.cache/lama/`) for the background behind the panels,
for baked English text and for the Mercedes star on the car (third-party logo, removed at the PO's request), rebuilt
empty progress tracks, gradient fill for small badge interiors, background-aware matting so glows composite cleanly.
Output: WebP sprites in `src/ui/img/<screen>/` + a generated TS table of reference-pixel boxes. Runtime: a stage in
reference pixels scaled by one CSS variable; groups (top bar, columns, bottom row, logo) stick to their screen edges and
grow up to 20 % on wide phones, inside the safe area — 16:9 matches the master 1:1, 19.5:9 phones keep every element.
Text is German (PO decision), set in Barlow Condensed italic with gradient fill + outline to match the master lettering
(SPIELEN as native text, chosen by the agent over baked art so it stays editable). The PO's reference files are not in
git (they contain third-party marks); see `tools/ui-extract/README.md`.
Follow-up (same session): loading/title/boot, character select, arena select and shop use the same pipeline. Screens
with a fixed composition (select screens, shop) are laid out in the master's 2000x1125 space ("contain") on a plate
outpainted 220 px per side, so 19.5:9 phones see a continuation of the scene instead of black bars; the main menu keeps
its edge-anchored groups. Third-party marks found in the masters are retouched out (Mercedes star, a luxury-car hood
ornament, Nike swooshes on sneakers). The shop's tabs stay as drawn (SKINS selected); per-tab selected art comes with
the real shop. Shared helpers: `src/ui/menu/kit.ts` + `kit.css`.


## D39 — PO review 9b: whole-app master skin, fight intro, charge, fatality minigame, staged specials, blood (2026-10-05)
- **App-wide skin**: every screen without its own master (Kämpfer, Karten, Profil, Einstellungen, Steuerung, Pause,
  Ergebnis, Online) uses kit sprites cut from the leaderboard master (stadium backdrop, glass panel and blue/gold
  buttons as CSS 9-slices, `src/ui/menu/skin.ts`). Live GLB fighters idle on the menu pedestals (`figures.ts`).
- **Meter balance** (PO: you must not lose without ever having a full bar, or get a charge button; agent's choice):
  both. *Aufladen*: hold the Hype bar / C / stick clicks to charge (`IN.CHARGE`, state `charge`, can't block, 4 meter
  per 3 frames). *Comeback*: damage taken builds meter (a full health bar = 300 = a Signature).
- **Fatality** (PO: card or minigame, in range): after the match-deciding KO the winner can walk, plays the Fatality card
  within `FATAL_RANGE` (1.8 m), then presses three shown buttons in time (`s.fatalQte`, sequence from the sim RNG); a miss
  ends the round without a finisher. Fatalities are 400 frames in three stages (beat-down, a brutal middle stage —
  Jazeek: axe kick into the floor + four-hit beat-down, Bonez: headbutts + Kiez-Powerbomb — then the big prop).
- **Blood** (PO: allowed, rating must stay at USK 16): short dark droplets + small floor splats that fade within ~2 s
  (`ToonFX.blood`), only on hard hits, specials and fatalities; no gore, no dismemberment; setting "BLUT" turns it off.
- **Projectiles that grab**: a projectile hit may start a cinematic (`HitDef.cinematic`) when the victim is grounded.
  Bonez' *Krokodil-Attacke* (a little croc runs along the floor, low; bite, drag, two death rolls, toss) and
  *Tiefergelegt* (car: roof ride, donuts, hard brake). Projectile hits are collected first and applied after, so two
  grabbing projectiles on the same frame trade without a cinematic (P1/P2 symmetry).
- **Fight intro** (PO: emote, face zoom, name): round 1 starts with a showcase per fighter (`RULES.SHOWCASE_EACH` = 96
  frames, in the sim's intro phase, either player's button press skips it; training has none). Presentation:
  `src/render/emotes.ts` (emote clip + push-in camera) and the HUD name slam.
- **Smoother cinematics** (PO): cinematic, fatality and emote clips use `smoothClip` — keys without an explicit ease
  follow a cubic Hermite spline through their neighbours instead of stopping at every key; camera keys inside a shot do
  the same (continuous dolly speed). Explicit eases (snap, hold, ...) keep their exact timing.

## D40 — The PO's prop models, "Blunt für dich", painted arenas with 3D crowds (2026-10-06)
- **PO props** (GitHub release `modelle-2`: joint, broken heart, wrecking ball, diamond, gold mic, croc, speaker palm,
  tuner car; Meshy exports, all normalised to ~1.9 m with 8K textures): `tools/meshy/props.py` makes the game copy —
  real-world size per prop (PO: "die Grösse der Props anpassen"; joint 17 cm, mic 30 cm, croc 1.5 m, car 2.7 m, palm
  5 m, …), game orientation (+X forward), origin where it stands or swings, decimated (600–40k tris) and textures
  resampled from the original JPEG bytes (no repainting). Parts that must move are split off in the same pass: the
  croc's lower jaw (node `jaw`, hinge at the mouth corner) and the two heart halves (`left`/`right`). Runtime:
  `render/propModels.ts` loads them at boot next to the fighters; every user falls back to the procedural prop when a
  file is missing. Props held in a hand (`render/handProps.ts`) are placed from the hand bone's world matrix each frame
  (not parented: bone/model scales would shrink them), with per-prop grips found in the lab (`?lab=props`, `?hp=`).
- **Blunt für dich** (PO: Jazeek rolls and lights a joint after his song, blows the smoke at the opponent, then a cool
  combo): a 62-frame special (roll, lick, light with a lighter flame, drag, blow) firing a slow smoke cloud; a grounded
  hit starts a 150-frame cinematic (victim coughs and staggers in the cloud, smoke ring, backfist, sweep, three beat
  hits, spinning kick out of the cloud, last drag). Long wind-up, punishable, damage like the other specials.
  Rating/reputation note for the PO: a real person shown smoking a joint is a USK and image question (decision open).
- **Painted arenas** (PO paintings "Splash Festival" and "Bahnhofsviertel"): instead of rebuilding the scenes in 3D, the
  painting is the backdrop on a large plane far behind the fight (real perspective parallax against the 3D floor;
  mirrored texture edges for wide phones), cut at its ground line and alpha-faded into a 3D floor built from a tile of
  its own ground (sand / wet cobbles + a blurred, fresnel-faded reflector on medium/high). Real names in the paintings
  are replaced (third-party marks rule, `tools/arena/plates.py`): the festival's logo → RAPBRAWL badge, the arena is
  called "Festival-Bühne"; PIK DAME / YOK YOK / MOSELECK → PIK ASS / KIOSK 069 / WEINECK (native neon lettering). The
  reference paintings stay out of git (`tools/arena/ref/`, ignored).
- **3D crowds** (PO: festival hipsters partying + moshpit, rocker gangs in the Bahnhofsviertel, stylized like the props):
  `render/crowd.ts` builds chunky game-art people from primitives (faces, two-segment arms/legs, hats, beards, glasses,
  open vests, phones/cups/beer) with baked shading, one InstancedMesh per part (~25 draw calls per crowd). Behaviours
  run on the music beat and react to hits/hype; the festival has two circle pits. Chosen over Meshy-generated crowd
  members (cost, no rig, draw calls) — a later upgrade path if the PO wants a richer look.

## D41 — iPhone: memory budget and short-screen layouts (2026-10-06)
PO test on an iPhone (claude.ai Artifact in Safari): the game aborted repeatedly; menus did not fill the screen,
elements looked shifted / too big or small, tile pictures were cut wrongly.
- **Memory** (iOS Safari kills a tab that holds too much): phones get a texture budget (`render/textureBudget.ts`):
  character colour maps 4K → 2K, detail maps → 1K, props → 1K/512, applied once at load (estimated texture memory in a
  fight ~400 → ~140 MB). The menu's live 3D figures share ONE WebGL context across all screens (was a new context
  per screen, re-uploading both fighters) with 1K texture copies; that context is released when a match starts. The
  game view's context is freed explicitly (`forceContextLoss`) and, on phones, dropped while the menus are open
  (rebuilt behind the loading screen). Phone render scale 1.5x (1.25x on low).
- **Text inflation**: `-webkit-text-size-adjust: 100%` — iOS Safari enlarges text in landscape otherwise, which breaks
  the reference-pixel layouts (text overflowing its boxes = "verschoben / zu groß").
- **Short, wide screens** (a phone in landscape inside a browser or the Artifact viewer is ~750x300): master screens
  may use a second safe rect without the decorative logo (`layoutStage(..., short)`, only below 520 px height or
  wider than 2.05:1), so character select and the arena/mode windows are ~1/3 bigger and fill the screen. Classic
  screens: backdrop without the baked logo (`tools/ui-extract/skin_backdrop.py`), smaller rem below 360 px height,
  scrollable content, two-column settings. Mode tiles zoom toward their subject (`ShowcaseItem.focus/zoom`).
- **Fight camera** on touch layouts (`CameraDirector.hudSafe`): a minimum visible height and a lower aim, so the
  fighters stand between the HUD bars and the card hand instead of under them.
- Verified in Chromium at iPhone sizes (750x300, 844x390, DPR 3). WebKit itself cannot be installed here (download
  host blocked), so Safari-only behaviour is UNVERIFIED until the PO re-tests.
- **Artifact publishing**: the host's publish check started to misclassify the 10 MB single page (inline bundle) as a
  "PR review" page and refused it; bisecting showed no real marker (a fuzzy false positive). The Artifact is now the
  page (markup + CSS, ~1.6 MB) plus `rapbrawl.js` (the bundle) as a supporting file: `single-file.mjs --split`, used by
  `artifact-check.mjs`. The planned 1K texture copies for the menu figures were dropped in the process (not needed:
  on phones the game view is released while the menus are open).

## D42 — Design v2, slower specials, reworked abilities, cartoon cutout fighters (2026-10-06)
PO (session 10): new master set for the whole app (home, character select, arenas, VS, loading, fighters, customize,
friends lobby; 1672x941 each), "save the current design and switch back easily if the new one is bad", the design
must sit IN the scene with depth (not pasted on), German text; specials felt 2-4x too fast; Diamanten-Regen, Blunt
and the croc were hard to read; two new fighters (Manuellsen, Lacazette) exactly as drawn in cartoon references.
- **Design switch**: v1 stays in the code and is tagged `design-v1` (commit c0e46a0). `src/ui/design.ts`: `?ui=v1|v2`
  (remembered per device) and EINSTELLUNGEN → DESIGN (NEU / KLASSISCH). Screens dispatch at their entry functions
  (`showHome`, `showFighters`, `showOnlineLobby`, `charSelectHtml`, `showcaseHtml`, `loadingHtml`); screens without a
  v2 master (deck, profile, settings, results, shop, leaderboard) keep their v1 look in both designs.
- **v2 screens** (`src/ui/v2/`, art from `tools/ui-extract/v2x.py` + `v2_<screen>.py`): unlike D38 the plate is the
  master itself with only what changes removed — baked English text (smooth fills on dark plates, row-colour fills on
  the yellow buttons), badges, bar fills, the illustrated placeholder figures (GrabCut silhouettes, filled by a banded
  row-continuation that keeps ropes/stands straight, or LaMa on banners) — so every panel sprite lies on its own
  pixels and nothing looks pasted on. Wings for wide phones: LaMa outpainting of a UI-free copy, darkened outward.
  Depth at runtime: flickering glows on the plate's own light sources (detected at extraction), sweeping beams, floor
  haze, embers, and the live 3D fighters between plate and UI with stage-coloured rim lights. Layout: the 1672x941
  stage height-fits and centres (tall screens width-fit) — nothing interactive is ever cropped; bottom UI lifts above
  the home indicator. Masters' placeholders that would mislead are replaced honestly: no fake friends in the lobby,
  2V2 / outfits / colours say KOMMT BALD, currencies are the local placeholder economy.
- **Menu fighters stand tall** (`render/anims/showcase.ts`): upright showcase poses instead of the side-view fight
  stance that looked "crippled" in the 3/4 menu view; POSE in Kämpfer anpassen switches back to the fight stance.
- **Cinematics at half speed**: `RULES.CINE_RATE = 2` sim frames per cinematic frame (`s.cine.sub`); the render
  samples fractional cinematic frames, so the authored clips play twice as long and stay smooth. Deterministic.
- **Diamanten-Regen**: the chain flashes (move frames 2-24), then the shower is placed over the OPPONENT (new
  projectile options: `target` = spawn over the opponent within reach, `armAt` = harmless warning phase (30 frames,
  sparkling ring + light shaft: walk/dash out), `hits`/`every` = three hits 12 frames apart, `noClash`). Overhead: only a
  standing block holds.
- **Blunt für dich**: a command grab now (`grabLike`, unblockable, jump/keep away; a whiff is punishable; grabLike
  counts as a throw in throw-vs-throw / strike-vs-throw resolution). Cinematic (160 frames x2): the victim is laid flat
  and rolled into a giant translucent joint (still visible inside), lick, the flame runs along it, three drags — each
  burns (hits), ember flares — then it swells and pops, the victim tumbles out coughing.
- **Croc**: bigger croc (1.45-1.6x) in the run and the cinematic, three calm shots instead of six cuts.
- **Manuellsen + Lacazette as 2D cutouts** (`render/cutout.ts`, `tools/characters/cutout.py`): the PO's references are
  cut into 12 puppet pieces (GrabCut-matted; parts hidden behind other pieces inpainted so nothing tears). A hidden
  procedural skeleton with the art's proportions runs the existing animation sets (Manuellsen = Bonez's boxing set,
  Lacazette = Jazeek's street set, front-view guard stances); each piece takes its bone's on-screen angle while its
  position follows the drawing. The art is never mirrored (facing left mirrors only the motion and swaps which arm
  leads), so the design is exactly the PO's. No cards/abilities yet (empty deck allowed for fighters without cards).
  Chosen over a 3D rebuild: any 3D model changes the drawn style, which the PO ruled out.
- **v2 flow**: home → character select → arena pick (each player, random draw) → VS screen (both fighters live in 3D,
  their decks, the drawn arena, which can still be changed there) → loading → match. Kämpfer → ANPASSEN opens the
  customize screen (fighter presets = roster, POSE toggle, LOOK SPEICHERN = favourite). Gegen Freunde opens the v2
  lobby (room code, join code, invitation copy/paste = the existing WebRTC/BroadcastChannel transport, lag test).
- **Tests**: `npm run e2e` keeps walking the v1 flows (`?ui=v1`, regression for the classic design) and adds the v2
  flow (home → select → arena → VS → match); `scripts/netplay.mjs` runs the online handshake through the v1 screens
  (the transport underneath is shared).

## D43 — modelle-3 roster, cel look, living menus, new abilities, v2 everywhere (2026-10-07)
- **Fighters = the PO's modelle-3 models** (Jazeek, Bonez, Manuellsen, Lacazette; `.cache/meshy3/<id>_src.glb`, not in
  git): reduced copies (`tools/meshy/reduce.py --dir meshy3`: 120k tris, metal/roughness map dropped = metal 0 /
  roughness 1, JPEG q88, retouch boxes per model, e.g. Jazeek's GG print) + bone-heat skin (`tools/meshy/skin.py`,
  landmarks in `tools/meshy/<id>_cr.py`, checked with `grid.py` / `jointshot.py`). The 2D cutouts of D42 are gone
  (a real 3D model of each now exists, so the "drawn style" argument no longer holds). Jazeek's and Bonez's moves stay;
  Manuellsen borrows Bonez's boxing normals, Lacazette Jazeek's street normals.
- **Cel look** (`render/cel.ts`): MeshToonMaterial with a 4-band nearest ramp (dark first bands, so rim lights do not
  wash the skin pale) + an ink outline = inverted hull sharing the skeleton, pushed along smoothed normals in view
  space x depth (constant on-screen width, ~1 draw call per mesh more). `?toon=0` = PBR with roughness 1 / metal 0.
- **Reach fit** (`render/anims/reach.ts`): the new proportions made some strikes fall short of their hitboxes; a
  per-move root lunge around the active frames (`REACH_FIX`) keeps fists/feet on the boxes without touching the sim.
- **Living menus**: MiDaS depth per v2 plate (`tools/ui-extract/depth.py`) drives a WebGL plate in the menus' shared
  context (`ui/v2/living.ts`): slow depth parallax, crowd hopping on the 90 BPM beat, flickering lights, haze, camera
  flashes; logos/UI regions stay rigid; the 3D figures share the parallax. `?still` = the old static plate.
- **KÄMPFEN button**: re-cut from the master with its chains, the baked FIGHT lettering removed by LaMa
  (`tools/ui-extract/v2_fight_btn.py`), German lettering in Rubik Wet Paint (black brush with drips).
- **New abilities** (all deterministic sim content + tests in `tests/abilities.test.ts`; presentation in
  `render/abilities11.ts`, `render/cines11.ts`, clips in `render/anims/roster11.ts`):
  - Manuellsen: *5000 Kurden* (phone call, a crew mob runs across: projectile, 3 hits, blockable), *Beton*
    (armour 3 hits, heavy right hand), signature *Sofa-Backpfeifen* (grab; a black sofa pops up, he seats the
    opponent and slaps three times with straight arms, BATSCH BATSCH BATSCH, the last tips the sofa over).
  - Lacazette: *Kalter Blick* (sunglasses down, a fast glint at head height: crouching dodges it), *Daunenweste*
    (armoured shoulder charge), signature *70 Schüsse* (a generic black off-roader without badges crosses the
    stage; on hit it drifts in diagonally, driver's window toward the opponent, cartoon shots and a counter to 70,
    then the line "…DAS WAREN 70 SCHÜSSE AUS DEM G-WAGON"). Shooting is shown as toy-like flashes/pops (USK).
  - Jazeek: signature *Ninetynine* (chain whip; the 99 pendant grows into a giant iced 99, slams, splits into two
    orbiting nines, rejoins, flying kick through it, NINETYNINE banner) replaces Herzbrecher as his deck signature.
  - Bonez: signature *Ohne mein Team* (palms rise as before, the opponent starts filming: HANDYVERBOT slap, four
    crew members storm in and pile on, line up behind him, one big right hand) replaces Palmen-Bassdrop in the deck.
    Herzbrecher and Palmen-Bassdrop stay in the code (cinematics, cards hidden from the default decks).
  - Blunt für dich reworked: grab, he carries the opponent on his hands into a cartoon cloud with whirling hands,
    the opponent vanishes and the PO's joint comes out, he smokes it (each drag hurts), on the last exhale the
    opponent flies out of the cloud. Cinematics can hide the victim (`CineDef.hide`) and add extra actors.
- **Design v2 for the screens without a master** (`ui/v2/ring.ts`): profile, settings and deck stand in the ring
  of the loading master with its logo removed (`tools/ui-extract/v2_ring.py`, living plate, live favourite fighter
  between the panels); results and pause lie over the running arena (the winner celebrates in the match itself;
  a second GL context during a match would cost iPhone memory, D41). The fight HUD keeps the PO's HUD master art and
  takes the v2 type and effects (`ui/v2/hud2.css`).

## D44 — iPhone as a native app without an Apple developer account (2026-10-07)
- The PO wants to test natively on the iPhone, not in a browser, and chose the free route. `.github/workflows/ios.yml`
  builds the existing Capacitor iOS project (SPM, landscape only, status bar hidden) on a GitHub macOS runner without
  code signing and uploads `RAPBRAWL.ipa`. The PO installs it with Sideloadly, which signs it with their own Apple ID
  (free: 7-day validity, max. 3 sideloaded apps, Developer Mode on the iPhone). No certificates or secrets live in the
  repository; the public repo makes the macOS minutes free.
- Upgrade path when needed: Apple Developer Program (paid, PO decision) → signed builds + TestFlight upload from the same
  workflow with App Store Connect API key secrets.

## D45 — iPhone feedback round: memory-safe menus, sound, fight performance, abilities round 2 (2026-10-07)
The PO tested the sideloaded app (D44) and sent 21 points. Decisions behind the fixes:
- **Black / partial menu screens** were image decodes failing under memory pressure (the 4K fighter textures decoded
  at start). Phones now load `<id>.m.glb` (40k tris, 2K colour, 1K normal; `tools/meshy/reduce.py` + `skin.py`
  output) whenever the texture budget is below 4K. The living plate (D43) no longer builds a composite canvas per
  screen: the master's tiles are uploaded as they are, the UI mask is a small data texture, depth is read back at 1/3,
  and the GPU textures are cached per screen (LRU 3 on phones). Every first draw is checked by reading pixels back; a
  black upload retries once and then falls back to the CSS painting (`root.dataset.living = ok|fail|lost`). The CSS
  painting is only hidden after a checked draw, so a screen can no longer show only its sprites.
- **No sound in the native app**: iOS' default audio session (ambient) is muted by the silent switch and WebKit does
  not count `pointerdown` as an audio gesture. The app sets AVAudioSession `.playback` + `.mixWithOthers` at launch and
  on every activation; the web side unlocks on `touchend`/`click` and resumes after interruptions.
- **Stutter in fights** came from shader recompiles (every cinematic/aura lamp changed the light count of all lit
  materials) and first-use compiles. Lights are now fixed slots (3 point + 1 spot); cinematic lights are virtual and
  copied onto the slots each frame. `GameView.prewarm()` compiles every projectile/prop of the two fighters against
  the post-processing target before the round (tone mapping is part of the program key). Projectiles are pooled.
  Phones adapt the render scale (0.25 steps) to the frame time.
- **Floating feet**: two-bone leg IK (`glbRig.plantFeet`) pulls a hovering foot onto the floor in standing states;
  mirrored rigs need the world→local rotation un-mirrored. Contact shadows under each foot.
- **Abilities round 2**, chosen from the fighters' own image, songs and memes (sim content + tests, presentation in
  `render/abilities11.ts`, `cines11.ts`): Bonez *Lila Becher* (replaces Abriss; generic purple double cup, no brand),
  Manuellsen *König im Schatten* (replaces Beton; new sim mechanics `VelocityKey.warp` = reappear behind the opponent,
  `HitDef.reverse` = knockback toward the attacker's back), Lacazette *Drei Buchstaben* (his three-character song
  titles as thrown chrome letters) and *Chart-Einstieg* (anti-air launcher). Signatures got second stages: Sofa (the
  opponent sleeps KO on the sofa, then "König im Schatten" with crown and spot, sofa kicked over), 70 Schüsse (collar
  grab, KALTER BLICK, push kick). The mob in 5000 Kurden carries the flag of Kurdistan (Ala Rengîn, the flag of the
  Kurdistan Region) — deliberately not any party or PKK symbol. Ninetynine re-choreographed (lasso in time with the
  pendant, a cocked arm and a step into each nine, run-up, kick, backflip home so the cinematic ends on his own spot).
- **Menus**: waiting poses per fighter instead of the upright showcase; home town under the names (select + VS);
  KÄMPFER swipes/taps between fighters and opens the deck; in-screen taps redraw without the fade (the "delay"); a
  real FREUNDE screen (own code, add/search, challenge → lobby; the list lives on the device until a server exists).
- Not done in this round: a full art-style rebuild of the menus (PO item 15) — the PO is producing new artworks
  (buttons, characters, banners, cards); the screens take them as drop-ins when they arrive.

## D46 — Session 13: animation smoothness system and design v3 (stylized 3D, rendered in Blender) (2026-10-07)
The PO asked for two things only: animations that are fluid, clean and human ("keine Glitches"), and a complete
redesign of backgrounds and screens in the same layout. The first redesign (a flat cartoon kit over a real-time 3D
arena) was rejected as "billige Produktion"; the PO clarified: *stylized 3D mobile fighting game UI with chunky
beveled panels, layered cards, bold iconography, metallic frames, soft toon shading and high visual depth (Clash
Royale, Brawl Stars)*, the Kämpferwahl layout (banners, pedestals) unchanged, and the arenas as the same places in
that style.

**Animation** — glitches are found by measurement, not by eye alone:
- `scripts/animprobe.mjs` runs seeded bot matches (or, with `CINE=sofa|gwagon|99|team|blunt`, one signature) through
  the real loop without drawing and records every key joint every frame; it reports pops (acceleration spikes),
  direction reversals at speed, teleports (> 0.3 m/frame relative to the hips), transition snaps and feet through /
  above / sliding on the floor; `SHOTS=` renders frame strips around suspect frames. Facing swaps are skipped (the
  mirrored rig renames left and right).
- Transitions are inertialized (quintic decay of the offset and its velocity) instead of cross-fades from a frozen
  snapshot; joints blend as quaternions everywhere; a critically damped spring follows the final pose. Strikes keep
  their snap (delivery eases into the contact).
- More human joints: clavicles follow the arms (lift past the horizontal, slide forward on a reach), toes roll at the
  ball of the foot, fists close with the arm's extension.
- Feet: two-bone leg IK plants hovering feet (S12); standing still, planted feet are locked where they touched down
  and take a quick step when the animation moves them > 11 cm; a lock re-anchors on a teleport (> 0.5 m).
- Turning around (crossed up) goes through the front view, and the stance switches on the way: before the facing
  swap the body blends into its mirrored pose, so the lead and rear arm trade places smoothly instead of in one frame.
  Downed bodies keep their facing until they are up.
- Cuts are cuts: a new round resets the animator (no blend out of the KO pose, no slide to the start mark); when the
  sim relocates a fighter on the frame its animation changes (end of a cinematic or throw), the jump is carried in
  the blend's root offset so the body glides once from where it was drawn (it used to shoot 1 m past its spot and
  come back).

**Design v3** (`?ui=v3`, the new default; v2 and v1 stay selectable in EINSTELLUNGEN → DESIGN as the backup):
- Same screen code and layouts as v2 (the PO's masters), art from `assets/ui3/<screen>/` with the v2 sprite names and
  boxes (`v3Art()` in `ui/v2/stage.ts`). Nothing in a layout moved.
- All art is real geometry rendered in Blender Cycles (`tools/ui3`, plain `python3` with the bpy module): beveled
  enamel panels, gold frames with rivets, candy buttons with a clear coat, 3D icons, chains; ortho at 2× with a
  shared studio HDRI, ink outline added in PIL. The menu backgrounds are one stylized 3D stadium/ring (truss, beams in
  haze, crowd, banners, LED walls) whose camera is solved per screen so the floor lies under the live fighter's feet
  (pedestals in the Kämpferwahl); the pieces the v2 masters had painted in are composed into the plates
  (`compose.py`), sliced l/c/r with a depth map for the living plate.
- CSS-drawn screens (profile, settings, deck, friends, results, pause, HUD lettering) get a 9-slice skin from the
  same renders (`tools/ui3/nine.py`, `ui/v3/v3.css`).
- Arenas: Festival-Bühne and Bahnhofsviertel rebuilt as stylized 3D scenes of the same places (fictional names as in
  D40) and rendered into the painted-arena format (`assets/arena/<id>3`, loaded in v3 with real side margins); their
  menu images come from the same renders (`UI=v3 node scripts/arena-thumbs.mjs`). The podcast studio already was a
  baked stylized 3D scene and stays.
- Rendering cost: ~20 min per stadium plate and ~15–30 min per arena at full size on the container's CPU; pieces
  render in seconds. Renders are cached in `.cache/ui3`; outputs are committed.

## D47 — Design v4: the PO's street masters, 1:1 (2026-10-08)
The PO rejected design v3 (D46's Blender-rendered UI) as "komplett an dem vorbei, was ich meinte" and sent five
finished master screens (home – Frankfurt Taunusstraße/Moselstraße, modes – Frankfurt Hauptbahnhof, character select –
Berlin Pallasseum, customise – Berlin Schöneberg, friends lobby – Berlin Pallasstraße) with the instruction: put them
into Figma as editable UI, implement exactly this design, make the buttons sit in the scene (light them where it
fits), create **nothing** new (no buttons, images or backgrounds); artwork for cards, items, characters, select boxes
and banners comes from the PO later.
- **v3 removed** (code, tools/ui3, assets; history keeps it). The animation work of D46 stays. Design switch:
  v4 (default) / v2 / v1; a stored 'v3' falls back to the default.
- **Same pipeline as D42** (`tools/ui-extract/v4_screens.py` on `v2x.py`): the master is the art; the plate is the
  master with only live text removed (row-wise interpolation `scan` on banded capsules/plates, LaMa elsewhere) and the
  third-party marks (Deutsche Bahn, S-Bahn logos) retouched out; every button/tile/panel is a sprite on its own
  pixels. New: tiles inside gold/neon frames are masked by flood-filling the frame interior (`v4x.frame_mask`, gaps
  in a bevel closed morphologically), state pieces are cut separately (blue selection frame, gold frame, P1/P2
  cursors with their tags, lit stat cell, ONLINE/OFFLINE labels, blank buttons, blank mode tiles).
- **Figma**: no Figma connector in the session, so the masters are delivered as layered SVGs (`design/v4/*.svg`,
  `tools/ui-extract/v4_figma.py`): reference master (hidden), the scene without UI, panels/banners, every UI element,
  states (hidden) and the live texts as text layers (Barlow Condensed). Dragged into Figma they become editable layers.
- **Runtime** (`src/ui/v4/`): v2's stage (layout, living plate with MiDaS depth, lights, embers, 3D fighters between
  the layers). Live data in the masters' places: amounts, name/level/XP, room code, friend rows, stat cells per
  fighter, roster busts in the grid (with the moving P1/P2 neon cursors), names on the P1/P2 plates. Life: every
  tile gets a staggered light sweep over its own shape, selection frames breathe like neon, gold chain buttons pulse
  and shine, haze and embers in the scene.
- **Screens without a master** use only master pieces: profile/settings/deck/friends stand in the home scene with
  its UI removed (`home_clean`, the fighter on the pedestal), the customise screen's name plate as title plate, the
  lobby's blank gold button, panels restyled to the lobby panels (navy, gold frame, upright white headings); the arena
  select is the modes master with blank tiles (arena picture in the art window, name on the label strip, ZUFALL /
  MEHR on the ONLINE/OFFLINE capsule); the loading screen is the home scene with the profile's XP bar as progress
  bar. v4 has no VS screen (select → arena → loading). The fight HUD stays v2's.
- **Artwork drop-ins**: `public/assets/ui4/art/` (banners, select boxes per fighter, skins per fighter), listed in
  `manifest.json` by `scripts/art-manifest.mjs` (also run by `npm run build`) so nothing is probed; cards keep
  `assets/cards/<id>.webp`.
- **Still background (PO, S14b)**: after the first review the PO asked to remove "dieses Ruckeln und die Lichter im
  Hintergrundbild" and keep the scene as it was: in v4 the stage runtime draws no living plate (depth parallax, crowd
  on the beat), no light glows, beams, haze or embers (`still()` in `ui/v2/stage.ts`); the painting is the plain
  image. The UI pieces keep their light (tile sheen, neon frames, gold buttons) and the 3D fighters stay. v2 keeps its
  living plates.
- Known limits: the UI-free plates of modes/select/customise/lobby are not good enough for the game (LaMa leaves
  ghost panels in big holes) and are only used in the Figma files; 2 VS 2 / walk-ins / effects / chat / events /
  battle pass / missions are shown as in the masters and announce "kommt bald".
