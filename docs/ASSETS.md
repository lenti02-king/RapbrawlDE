# Assets für RAPBRAWL – was gebraucht wird und wie es ins Spiel kommt

Stand: 2026-10-04. Alles im Spiel ist aktuell selbst gebaut (Code). Fotorealistische Figuren wie auf den
Referenzbildern brauchen **echte 3D-Modelle**. Der Import ist fertig und getestet: Ein Modell, das hier
abgelegt wird, übernimmt automatisch alle Moves, Kombos, Intros, Siege und beide Signature-Kinosequenzen.

## 1. Charaktere (wichtigste Lieferung)

Pro Figur eine Datei: `public/assets/characters/jazeek.glb` und `public/assets/characters/bonez.glb`.
Alternativ einfach die FBX-Dateien aus Mixamo schicken – die Umwandlung in GLB übernehme ich.

**Stand Session 4:** Beide Figuren stammen aus deinen Meshy-Modellen („Diamond Confidence“ = Jazeek, „Golden Hour
Stare“ = Bonez MC). Ungefärbte Meshy-Modelle (auch neue Versionen) reichen: Farben, Gesicht, Texturen, Rig und Fäuste
erzeugt `tools/meshy`. Ein neues Modell einfach schicken – die Bemalungsregeln in `tools/meshy/<id>.py` werden angepasst.
Bitte angeben, mit welchem Meshy-Tarif sie erstellt wurden (Free = CC BY 4.0 mit Nennung von Meshy; bezahlt = Eigentum).

### Schritt A – Ganzkörper-Referenz für die 3D-Erzeugung (Higgsfield, Bild)
Wichtig für gute 3D-Ergebnisse: ganze Figur inkl. Füße, **A-Pose** (Arme ca. 45° vom Körper), frontal,
neutraler grauer Hintergrund, gleichmäßiges Studiolicht, keine Requisiten in den Händen.
Zusätzlich je ein Bild von der Seite und von hinten (gleiche Pose) verbessert das Modell deutlich.

**Jazeek – Prompt:**
> photorealistic full-body 3D character, young athletic man, dense black curly hair, light mustache and short
> chin beard, white ribbed tank top, beige trousers with an all-over monogram-style pattern (generic, no brand
> logo), white sneakers, layered silver chains with pendant, silver watch, tattoos on both arms, standing in
> A-pose with arms 45 degrees away from the body, palms open, front view, feet visible, neutral grey studio
> background, soft even lighting, unreal engine 5 character render, 8k detail

**Bonez MC – Prompt:**
> photorealistic full-body 3D character, very tall man (1.98 m), long face, light eyes, short dark-blond curls
> with very short sides, light beard, gold teeth, black t-shirt, black quilted puffer vest, black knit scarf
> with white lettering (generic, no brand name), gold cuban chain with cross, gold watch and rings, hand and
> forearm tattoos, black trousers, black sneakers, standing in A-pose with arms 45 degrees away from the body,
> palms open, front view, feet visible, neutral grey studio background, soft even lighting, unreal engine 5
> character render, 8k detail

Hinweis: Echte Markenlogos/-muster (z. B. Gucci-Monogramm, „VANDAL“-Schriftzug) bitte generisch halten,
solange keine Lizenz vorliegt.

### Schritt B – Bild → 3D-Modell
Mit Higgsfield (Image-to-3D) oder einem vergleichbaren Dienst ein texturiertes Modell erzeugen.
Zielwerte für Handys:
- 1 Figur = 1 zusammenhängendes Mesh, **≤ 40 000 Dreiecke**
- Texturen **2048 × 2048** (Base Color, Normal, Roughness/Metallic)
- Gesicht schaut nach vorne, Füße auf dem Boden

### Schritt C – Skelett (Rigging) mit Mixamo (kostenlos, Adobe-Konto)
1. mixamo.com → „Upload Character“ → Modell hochladen (OBJ/FBX; eine GLB vorher in Blender als FBX exportieren).
2. Marker setzen: Kinn, Handgelenke, Ellbogen, Knie, Leiste → Skeleton LOD „Standard“.
3. Download: **FBX Binary, With Skin, T-Pose**, keine Animation nötig.

Die Bone-Namen von Mixamo (Hips, Spine, LeftArm …) erkennt das Spiel automatisch.

### Schritt D – Ablegen
- `jazeek.glb` / `bonez.glb` nach `public/assets/characters/` (≤ 15 MB pro Datei), oder die FBX-Dateien schicken.
- Optional: Goldzähne von Bonez als eigenes Objekt mit dem Namen `prop_teeth` – sie werden dann nur beim
  Grinsen, im Intro, beim Sieg und vor der Signature eingeblendet.

Danach skaliere ich die Modelle (Jazeek 1,80 m, Bonez 1,98 m), prüfe alle Moves gegen die Trefferzonen
(Kontaktbögen per `scripts/moves.mjs`) und rendere die Menü-Portraits automatisch aus den Modellen.

## 2. Bilder für Karten und Menüs (optional, sofort nutzbar)

**Kartenkunst:** `public/assets/cards/<karten-id>.webp`, 768 × 1024, Hochformat, **ohne Text** (Name und
Kosten zeichnet das Spiel). Sobald eine Datei existiert, ersetzt sie das Platzhalter-Symbol.

| Datei | Motiv (Prompt-Idee) |
|---|---|
| `jaz_wave.webp` | Jazeek singt, sichtbare türkise Schallwelle bricht aus dem Mund, Hinterhof bei Nacht |
| `jaz_spot.webp` | Jazeek sprintet durch einen hellen Bühnen-Lichtkegel, Bewegungsunschärfe |
| `jaz_counter.webp` | Jazeek weicht im Takt aus, Musiknoten um ihn, Gegner schlägt ins Leere |
| `jaz_mvp.webp` | Jazeek mit Krone aus Licht, schnelle Schlagserie, Funken |
| `jaz_heart.webp` | Jazeek im Spotlight, pinkes Herz zerbricht in zwei Hälften |
| `bon_croc.webp` | Bonez, dahinter ein riesiges Krokodilmaul, das zuschnappt |
| `bon_smoke.webp` | Bonez halb in dichtem Rauch, nur Silhouette und Goldkette glänzen |
| `bon_abriss.webp` | Bonez holt zu einer schweren Geraden aus, Staub, Beton bricht |
| `bon_grin.webp` | Nahaufnahme Bonez grinst, Goldzähne funkeln |
| `bon_palm.webp` | Bonez schlägt auf den Boden, Palmen-Silhouetten vor Sonnenuntergang, Bass-Druckwelle |

Stil für alle: „photorealistic, cinematic lighting, unreal engine 5, gritty Berlin backyard at dusk,
portrait 3:4, no text“.

**Weitere Bilder:** Key Art / Ladebild 1920 × 1080, App-Icon 1024 × 1024, Logo „RapBrawl – Block Beats“ als
transparentes PNG. Diese baue ich ein, sobald sie da sind.

## 3. Arena (optional)
Die Arena ist nach dem Referenzbild nachgebaut (Hinterhof, Hoop-Balkon mit Lila-LEDs, Spots, Bühne, Rolltore,
Zäune, nasser Asphalt mit Spiegelungen). Noch mehr Realismus bringen kachelbare 4K-Texturen
(Altbau-Putz mit Abplatzungen, nasser Asphalt, Rolltor, Graffiti-Tags als PNG mit Transparenz,
Block-Beats-Plakate). Ein komplett modellierter Hinterhof als GLB (≤ 150 000 Dreiecke) ist auch möglich.

## 4. Rechte (vor jeder Veröffentlichung)
- Schriftliche Erlaubnis von **Jazeek** und **Bonez MC** für Name, Aussehen und Stimme.
- Keine fremden Marken ohne Lizenz (Kleidungsmuster, Schriftzüge).
- Nutzungsbedingungen des 3D-/Bild-Dienstes für kommerzielle Nutzung prüfen.
