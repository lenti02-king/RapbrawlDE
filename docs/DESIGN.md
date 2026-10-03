# Combat design (vertical slice)

## Core loop
Best of 3 rounds, 99 s timer, 60 Hz. Health: VOLT 1000, BRICK 1150. Time over: higher health % wins.

## Controls
| Action | Keyboard P1 | Keyboard P2 | Touch | Gamepad |
|---|---|---|---|---|
| Move / jump / crouch | A D W S | Arrows | left floating stick | D-pad / left stick |
| Dash | double-tap forward/back | same | flick stick twice | same |
| Light | J | `,` / Num1 | L | X/□ |
| Heavy | K | `.` / Num2 | H | Y/△ |
| Grab | L | `/` / Num3 | GRAB | A/✕ |
| Block | Space (or hold back) | Right Shift / Num0 | BLOCK | B/○, LT |
| Cards 1-3 | U I O | M N B / Num4-6 | card buttons | LB RB RT |
| Pause | Esc / P | | ‖ button | |

Modifiers: ↓ + Light/Heavy = low attacks (2L, 2H). → + Heavy = overhead (6H). In the air: j.L / j.H (overheads).

## Defense triangle
- **Block** beats strikes. Stand block stops mids + overheads; crouch block (↓ + block) stops mids + lows.
- **Grab** beats block (5f startup, short range, cannot grab airborne or stunned opponents). Tech by pressing Grab within 10 frames (buffered presses count).
- **Strikes** beat grabs (a strike landing on the same frame wins).
- Holding back auto-guards only when an attack/projectile threatens (proximity guard), otherwise you walk back.
- Backdash is strike-invulnerable for its first frames. Wakeup is invulnerable (no unblockable OTG loops).

## Offense
- Chains: Light normals chain into Light/Heavy normals on hit or block (max 3 chains). Example BnB (VOLT): `j.H, 5L, 5L, 5H > Freestyle Rush`.
- Special cancel: lights and heavies cancel into special cards on connect.
- Counter-hit: hitting an opponent during their move = +20% damage, +4 hitstun, red sparks.
- Damage scaling: hits 1-2 at 100%, then -12% per hit, floor 30%. Signature cinematics use the scale at the moment they connect.
- Juggles: launchers (BRICK 2H, rush finisher) launch; max 4 juggle hits, then the opponent becomes intangible until landing.

## Hype meter (special resource)
Max 3 bars (300). Gained by landing hits (lights 8, heavies 16), blocks, and taking damage (1/8 of damage). Carries over between rounds. Cards cost 0–3 bars.

## Special cards (3 of 6 equipped; max 1 Signature)
**VOLT** (rushdown): Mic Check (1, boomerang projectile), Stage Dive (1, overhead leap/crossup, knockdown), Freestyle Rush (2, dash jab → 5-hit auto combo on hit, unsafe on block), Punchline (1, counter stance vs strikes; lows/throws beat it), Ad-Lib (0, taunt that builds meter; very punishable), **Headliner** (3, Signature: invulnerable lunge → cinematic).
**BRICK** (grappler): Subwoofer (1, low ground wave), Bulldozer (1, armored charge, 1 hit of armor), Security Check (2, unblockable command grab, no tech), Bass Drop (1, fully invulnerable reversal stomp hitting both sides), Heavy Rotation (1, anti-air spin), **Security!** (3, Signature: unblockable lunge → cinematic with two security guards).

Same fighter, different plans: e.g. VOLT *zoner* (Mic Check, Punchline, Ad-Lib) vs *rushdown* (Stage Dive, Freestyle Rush, Headliner).

## Cinematic signatures
Flow: activation → 36-frame super flash (game frozen, card reveal UI, camera close-up) → startup (strike-invulnerable) → hit check. **Blocked/whiffed: no cinematic, big recovery.** Confirmed hit → sim enters cinematic state (both fighters locked, timer stopped, damage applied at scripted frames) → presentation plays camera cuts/poses/VFX → victim knocked down at a scripted distance → control returns. Lengths: Headliner 2.6 s, Security! 2.8 s (kept short for repeated competitive play).

## Frame data conventions
`startup` = first active frame (1-based). Hitstop freezes both fighters; stun counts start after hitstop. Advantage = hitstun/blockstun − (remaining active + recovery). Training mode shows startup and measured advantage.

## Not in the slice (by design)
Rounds-based character select stage choice, more fighters, cosmetics, store, accounts, ranked, creator codes. See STATUS for the roadmap.
