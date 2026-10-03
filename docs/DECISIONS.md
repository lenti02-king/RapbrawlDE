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

## D6 — Special cards: meter-cost, 3 equipped of 6, max 1 Signature, no power-by-rarity (2026-10-03)
Cards define tactical options, not stats. Rarity (future) is cosmetic only. Validation in `core/registry.ts`.

## D7 — Placeholder assets are procedural (2026-10-03)
Characters are procedural toon rigs (primitives + outlines), arena is procedural, all audio is synthesized at runtime. Zero licensing risk. Rig exposes named joints and pose arrays so authored glTF models can replace it while keeping move clips/frame data.

## D8 — Paid generative tools not used (2026-10-03)
A Higgsfield MCP (generative image/video/3D, credit-based) is connected in this environment. Not used: it incurs costs and outputs need licensing review. Ask the product owner before using.
