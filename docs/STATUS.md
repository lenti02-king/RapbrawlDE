# Project status

_Last updated: 2026-10-04 (end of session 2)._
Legend: **VERIFIED** = observed working via automated test or screenshot; **BUILT** = compiles/builds, not exercised; **UNVERIFIED** = implemented, not checked; **BLOCKED** = needs something outside the agent's control.

## How to play right now
- Private claude.ai Artifact (single-file build, owner-only until shared): https://claude.ai/artifact/QxFGw7nin7xvWrdnmQZuiv
- Android debug APK: GitHub → Actions → "Android debug APK" → latest run → artifact `rapbrawl-debug-apk` (needs "install unknown apps").
- Local: `npm install && npm run dev`.

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
| Photoreal Jazeek / Bonez models | BLOCKED: need models from the product owner (spec in `docs/ASSETS.md`); placeholders are procedural | |
| Painted card art drop-in (`public/assets/cards/<id>.webp`) | BUILT, UNVERIFIED (no art yet) | |
| Headless tests run at `q=low` (SwiftShader is too slow for the full pipeline) | VERIFIED: 22/22 E2E | `npm run e2e` |

## Earlier (session 1) — still valid
Deterministic sim (VERIFIED, 49 unit tests incl. symmetry and rollback), rollback netcode core, WebRTC copy/paste friend match (one machine only), Android debug APK in CI, iOS BLOCKED (needs macOS/Xcode/Apple account), CI green on GitHub Actions.

## Known issues / risks
- Feel/timing (hitstop, damage, meter gain, touch layout) has never been tested by a human; the bot balance number is only a sanity check.
- In headless Chromium, CSS animations started while the sim runs stay frozen (load artifact of software rendering). HUD pop-ups were therefore moved to JS tweens; remaining CSS animations (combo bump, card glow) are cosmetic.
- Characters are procedural placeholders in the right style, not final art. Likeness/name rights for Jazeek and Bonez MC are not cleared (see below).
- Online: no matchmaking/TURN/rematch; the Artifact host blocks WebRTC.
- Bot is reactive but exploitable. Back-throw victim animation assumes a forward throw.

## Needs the product owner
- **3D models of Jazeek and Bonez MC** (see `docs/ASSETS.md`): photoreal look is impossible with procedural geometry.
- **Rights**: written permission from Jazeek and Bonez MC (name, likeness, voice/music references) before any public release. Third-party logos (e.g. monogram prints, scarf brand) were deliberately left out.
- **Assets** (optional upgrade, list in the session report): card art, portraits, logo, arena backdrop, optionally rigged GLB characters into `public/assets/incoming/`.
- Hosting decision for signaling/matchmaking + TURN.

## Next objectives (suggested order)
1. Human playtest on a real phone (APK / Artifact) → tune touch layout, hitstop, damage, meter.
2. Integrate delivered art (card art via `ui/icons.ts` replacement, portraits, GLB characters mapped onto the joint/pose system).
3. Online v2: signaling server + quick match, TURN, rematch.
4. More content: third fighter, second arena, more cards per fighter.
