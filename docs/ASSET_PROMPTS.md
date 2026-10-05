# Asset-Prompts für den PO (Bild → 3D-Modell)

Ablauf: Bild mit dem Prompt erzeugen → daraus ein 3D-Modell machen (z. B. Meshy, wie bei Jazeek/Bonez) → GLB
schicken. Ich binde es dann ein (Skalierung, Rig/Animation, Licht).

**Regeln für alle 3D-Assets (schon in jedem Prompt enthalten):**
- ein einzelnes Objekt, ganz im Bild, mittig, Ansicht schräg von vorne (3/4)
- neutraler hellgrauer Hintergrund, weiches gleichmäßiges Licht, kein Schlagschatten
- keine Schrift, keine Logos, keine Markenzeichen, kein Nummernschild-Text
- gleicher Look wie die Kämpfer: stylized 3D, chunky Proportionen, satte Farben, saubere Materialien

Wenn das 3D-Tool eine Option „A-Pose / T-Pose“ oder „Quad-Topologie“ hat: einschalten. Ziel-Größe: ≤ 50k Dreiecke,
Texturen 2K.

---

## 1. Bonez: Krokodil (Krokodil-Schnapper, Krokodil-Finale)

Wird von mir geriggt: Wirbelsäule + Schwanz + Kiefer + vier Beine. Darum: Maul **halb offen**, Körper **gerade**,
Beine seitlich abgespreizt (nicht unter dem Körper).

```
Stylized 3D game asset of a small but mean crocodile, chunky cartoon proportions like a mobile fighting game
(Clash Royale / Brawl Stars style), dark olive-green scaly skin with lighter belly, a few gold teeth, a thin gold
chain around its neck, mischievous angry eyes. Body perfectly straight from snout to tail, mouth half open showing
teeth, all four legs spread out to the sides, tail straight back. Full body visible, three-quarter front view,
centered, neutral light grey background, soft even studio lighting, no cast shadow, no text, no logo, high quality
PBR textures, game-ready model.
```

## 2. Bonez: Tuner-Auto (Tiefergelegt)

Kein Honda-Logo, keine Marke, und die Form bewusst eigenständig (nur „im Stil von“ Kompakt-Tunern der 2000er), weil
auch die Karosserieform eines echten Modells geschützt sein kann.

```
Stylized 3D game asset of a lowered 2000s-style Japanese compact hatchback tuner car, original design (not a real
car model), chunky cartoon proportions for a mobile fighting game, glossy deep black paint with purple and gold
racing stripes, wide body kit, big rear spoiler, gold multi-spoke rims, purple neon underglow, tinted windows, no
badges, no logos, no brand names, blank license plates. Full car visible, three-quarter front view, centered,
neutral light grey background, soft even studio lighting, no cast shadow, no text, high quality PBR textures,
game-ready model.
```

## 3. Bonez: Abrissbirne (Abriss)

```
Stylized 3D game asset of a heavy wrecking ball on a short thick chain, dented dark steel ball with gold rivets and
a gold crown emblem engraved, chunky cartoon proportions for a mobile fighting game. Full object visible,
three-quarter view, centered, neutral light grey background, soft even studio lighting, no cast shadow, no text,
no logo, high quality PBR textures, game-ready model.
```

## 4. Bonez: Palme (Palmen-Bassdrop)

```
Stylized 3D game asset of a single tropical palm tree, slightly bent trunk, lush stylized leaves, small coconuts,
chunky cartoon proportions for a mobile fighting game, a tiny subwoofer speaker built into the base of the trunk.
Full object visible, front view, centered, neutral light grey background, soft even studio lighting, no cast
shadow, no text, no logo, game-ready model.
```

## 5. Jazeek: Diamant (Diamanten-Regen)

```
Stylized 3D game asset of a large brilliant-cut diamond gem, icy blue-white, very glossy with strong facets and
a subtle inner glow, chunky cartoon style for a mobile fighting game. Single gem, three-quarter view, centered,
neutral light grey background, soft even studio lighting, no cast shadow, no text, game-ready model.
```

## 6. Jazeek: Platin-Schallplatte (Platin-Finale)

```
Stylized 3D game asset of a giant platinum vinyl record award plaque: shiny platinum record in a thick black and
gold frame with a crown ornament on top, chunky cartoon proportions for a mobile fighting game. No text, no label
writing, no logo. Full object visible, front three-quarter view, centered, neutral light grey background, soft even
studio lighting, no cast shadow, game-ready model.
```

## 7. Jazeek: Goldmikrofon (Stimmwelle, Intro-Emote)

```
Stylized 3D game asset of a handheld stage microphone, gold mesh head, black grip covered with small diamonds, a
short gold cable stub, chunky cartoon proportions for a mobile fighting game. Single object, three-quarter view,
centered, neutral light grey background, soft even studio lighting, no cast shadow, no text, no logo, game-ready
model.
```

## 8. Jazeek: Herz (Herzbrecher)

```
Stylized 3D game asset of a big glossy red cartoon heart with a jagged crack through the middle and two halves
slightly apart, small gold sparkles at the crack, chunky style for a mobile fighting game. Single object, front
view, centered, neutral light grey background, soft even studio lighting, no cast shadow, no text, game-ready model.
```

---

## 9. Customizing: Accessoires (werden an Kopf/Hals/Hand angehängt)

Je ein eigenes Bild/Modell, **ohne Person**, frontal schräg:

```
Stylized 3D game asset of a [ACCESSORY], chunky cartoon proportions for a mobile fighting game, premium materials,
no logos, no brand names, no text. Single object, three-quarter view, centered, neutral light grey background,
soft even studio lighting, no cast shadow, game-ready model.
```

[ACCESSORY] nacheinander ersetzen durch:
- `black snapback cap with a gold crown embroidered on the front, flat brim`
- `pair of gold aviator sunglasses with dark lenses`
- `thick gold Cuban link chain necklace with a crown pendant set with diamonds`
- `black bandana folded as a headband with a gold paisley pattern`
- `knitted beanie in purple with a small gold crown patch`
- `pair of chunky gold rings with black stones`

## 10. Customizing: Outfits (ganzer Kämpfer neu, gleiche Person)

Hier **das bisherige Charakterbild als Referenz anhängen** (Identität bleibt gleich), dann:

```
Use the attached character as identity reference: same face, same hairstyle, same body proportions, same stylized
3D chunky mobile-fighting-game look. Change ONLY the outfit to: [OUTFIT]. Full body, A-pose (arms angled down 45°
away from the body, legs slightly apart), front view, centered, neutral light grey background, soft even studio
lighting, no cast shadow, no text, no logos, no brand marks on clothing or shoes.
```

[OUTFIT]-Ideen (je Kämpfer 2–3 aussuchen):
- `black and gold tracksuit with a crown pattern, white high-top sneakers without logos`
- `oversized white hoodie with gold embroidery, cargo pants, chunky boots`
- `red bomber jacket with a crocodile patch on the back, black jeans, gold chain` (Bonez)
- `purple velvet stage suit with diamonds on the lapels, open shirt` (Jazeek)

---

## 11. Menü: Bild-Kacheln für das Modus-Fenster (2D, kein 3D-Modell)

Gleicher Stil wie deine Menü-Vorlagen. Seitenverhältnis 4:3, **ohne Schrift** (die setze ich im Spiel).

```
Stylized 3D game art illustration for a mobile fighting game mode tile, premium glossy look matching a rap battle
street brawler UI (dark night city, neon purple and blue lights, gold accents, crown motif), dramatic lighting,
depth of field. Scene: [SZENE]. No text, no letters, no logos, no UI frame, 4:3 aspect ratio, centered composition
with space at the bottom for a title.
```

[SZENE] je Kachel:
- Schnellkampf: `a red boxing glove smashing through a gold burst explosion, sparks flying`
- Ranked: `a gold championship belt with a crown on a dark pedestal under a spotlight`
- Online: `a glowing globe made of neon network lines above a night city skyline`
- Gegen Freunde: `two fist-bump gloves, one red and one blue, colliding with energy sparks`
- Training: `a worn punching bag with gold tape hanging in a graffiti gym, dust in the light`
- Koop (kommt bald): `two silhouetted fighters back to back in a neon-lit alley surrounded by shadowy thugs`
- Shop „Designer-Kollektion“ (kommt bald): `a designer's workbench with sketches of streetwear, a mannequin with a half-finished hoodie, sewing tools, gold crown patches`

## 12. Optional später: Arena-Vorschaubilder

Für die gesperrten Arenen (Dach, U-Bahn, …) jeweils ein 16:9-Bild im gleichen Stil, ohne Kämpfer und ohne Schrift.
