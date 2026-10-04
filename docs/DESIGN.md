# Combat design (vertical slice)

## Core loop
Best of 3 rounds, 99 s timer, 60 Hz. Health: Jazeek 1000, Bonez MC 1050. Time over: higher health % wins.

## Controls
| Action | Keyboard P1 | Keyboard P2 | Touch | Gamepad |
|---|---|---|---|---|
| Move / jump / crouch | A D W S (arrows too when not in 2-player mode) | Arrows | left floating stick (8 sectors) | D-pad / left stick |
| Dash | double-tap forward/back | same | flick stick twice | same |
| Light | J | `,` / Num1 | L | X/□ |
| Heavy | K | `.` / Num2 | H | Y/△ |
| Grab | L | `/` / Num3 | GRIFF | A/✕ |
| Block | Space (or hold back) | Right Shift / Num0 | BLOCK | B/○, LT |
| Special 1 / 2 | U / I | M / N | blue/orange hand cards | LB / RB |
| **Signature** | **O** | B | **golden hand card** | RT |
| Pause | Esc / P | | ‖ button | |

Modifiers: ↓ + Light/Heavy = low attacks (2L, 2H). Forward + Heavy is a normal 5H (no overhead, for precision). Overheads: jump-ins (j.L / j.H).
Touch stick: horizontal sectors are ±26°, vertical ±21°, diagonals the rest; engage at 32 % of the radius, release below 22 %, 7° hysteresis between sectors.

## Defense triangle
- **Block** beats strikes. Stand block stops mids + overheads; crouch block (↓ + block) stops mids + lows.
- **Grab** beats block (short range, cannot grab airborne or stunned opponents). Tech by pressing Grab within 10 frames.
- **Strikes** beat grabs. Trades are symmetric (no P1/P2 advantage; follow-ups are cancelled for anyone hit that frame).
- Holding back auto-guards only when an attack/projectile threatens. Backdash is strike-invulnerable early; wakeup is invulnerable.

## Offense
- Chains: Light → Light → Heavy (max 3 chains). Lights and heavies cancel into special cards on connect.
- Counter-hit: +20 % damage, +4 hitstun. Damage scaling: hits 1–2 at 100 %, then −12 % per hit, floor 30 %.
- Juggles: max 4 juggle hits, then the opponent becomes intangible until landing.

## Hype meter
Max 3 bars (300), carries over between rounds. Gain: landing hits 12/18/24 (light/medium/heavy), blocked hits 6/9/12, defender gains 1/5 of damage taken and +6 per block. Jazeek gains 10 % more (tempo character). Specials cost 0–2 bars, the Signature 3.

## Deck
2 Specials (slots 1–2) + 1 Signature (fixed golden slot 3). Rarity never changes power.

## Fighters
**JAZEEK — Tempo & Konter** (fast, rhythmic, precise). Normals: Schneller Jab (5f), Tiefer Kick (6f, low), Rückhand (9f), Breakdance-Sweep (10f, low), Sprungknie, Sprung-Drehkick. Throw: Spin-Wurf.
Cards: Stimmwelle (1, short sound-wave projectile with big pushback), Spotlight-Dash (1, passes through the opponent, strike-invulnerable early), Rhythmus-Konter (1, counter stance that also catches lows → 3 hits; loses to throws/projectiles), MVP-Kombo (2, dash jab → 5-hit series with launcher, unsafe on block), **Herzbrecher** (3, Signature).
**BONEZ MC — Reichweite & Druck** (1.98 m, long reach, heavy single hits, readable wind-ups). Normals: Langer Jab (7f), Stiefeltritt (8f, low), Rechte Gerade (13f), Aufwärtshaken (11f, anti-air), Sprung-Ellbogen, Hammerfaust. Throw: Schulterwurf.
Cards: Krokodil-Schnapper (1, 2.2 m reach, first active frame 20, knockdown), Rauchwand (1, stationary barrier that absorbs projectiles; a gold glint keeps Bonez readable behind it), Abriss (1, one hit of armor; throws beat it), Goldzahn-Grinsen (0, +70 Hype if not interrupted), **Palmen-Bassdrop** (3, Signature; hits low on both sides → crouch-block or jump).

## Cinematic signatures
Flow: activation → 36-frame super flash (game frozen, card reveal UI, camera close-up) → startup (strike-invulnerable) → hit check. **Blocked/whiffed: no cinematic, big recovery.** Confirmed hit → sim enters cinematic state (both fighters locked, timer stopped, damage applied at scripted frames) → presentation plays camera cuts/poses/VFX → victim knocked down at a scripted distance → control returns. Lengths: Herzbrecher 2.5 s (hits at frames 70/78/86/96/120, 325 base damage incl. the 40 on contact), Palmen-Bassdrop 2.7 s (hits at 30/74/118, 300 incl. contact). Kept short for repeated competitive play.

Herzbrecher: sung note → spotlight + notes + hearts → dazed victim, heart forms → five-hit combo, heart cracks per hit → spin palm strike breaks the heart. Palmen-Bassdrop: ground slam → sunset and palms rise → bass lifts the victim → gold-teeth close-up → uppercut → leaping hammer slam while a crocodile snaps shut.

## Frame data conventions
`startup` = first active frame (1-based). Hitstop freezes both fighters; stun counts start after hitstop. Advantage = hitstun/blockstun − (remaining active + recovery). Training mode shows startup and measured advantage.

## Not in the slice (by design)
Rounds-based character select stage choice, more fighters, cosmetics, store, accounts, ranked, creator codes. See STATUS for the roadmap.
