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
