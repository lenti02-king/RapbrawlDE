# RAPBRAWL GERMANY – Projektübergabe

Stand: 2026-10-09 (Ende Session 18, mitten in der Arbeit am neuen „Jazeek Cartoon“, siehe Abschnitt 9).
Repository: `lenti02-king/RapbrawlDE` · Arbeits-Branch: `claude/modest-sagan-84h64j`.

Diese Datei fasst die bisherigen Gespräche zwischen Product Owner (PO) und Agent zusammen, damit das Projekt lokal
oder in einer neuen Sitzung ohne den langen Gesprächsverlauf weiterentwickelt werden kann. Tiefe Details stehen in:
- `docs/STATUS.md`: Stand pro Session, was VERIFIZIERT ist und was nicht.
- `docs/DECISIONS.md`: Architektur- und Designentscheidungen D1–D51 mit Begründung.
- `docs/DESIGN.md`: Kampfsystem, Frame-Daten, Steuerung, Karten.
- `docs/ASSETS.md`: Asset-Vorgaben, Rechte.
- `CLAUDE.md`: Befehle, Architektur, dauerhafte Regeln für den Agenten.

**Kennzeichnung in dieser Datei**

| Kürzel | Bedeutung |
|---|---|
| **[BESCHLOSSEN]** | Vom PO so gewollt oder ausdrücklich bestätigt; gilt, bis der PO es ändert. |
| **[VORGESCHLAGEN]** | Vom Agenten empfohlen, vom PO nicht (oder noch nicht) bestätigt. |
| **[OFFEN]** | Nicht entschieden oder nicht gebaut. |
| **[UNKLAR]** | Aus dem Gespräch nicht sicher ableitbar; nicht erfunden, bitte klären. |
| VERIFIZIERT | Durch Test oder Screenshot beobachtet. |
| GEBAUT | Kompiliert und eingebaut, aber nicht im Einsatz geprüft. |
| UNGEPRÜFT | Eingebaut, nicht kontrolliert (z. B. auf dem echten iPhone). |

---

## 1. Was das Spiel werden soll (Vision und langfristige Ziele)

**Das Spiel:**
- Ein kompetitives **2.5D-Kampfspiel** im Stil von Street Fighter / Tekken.
- Thema: deutsche Rap- und Creator-Kultur. Die Kämpfer sind echte Rapper: Jazeek, Bonez MC, Manuellsen, Lacazette. [BESCHLOSSEN]
- **Mobile-first**: iPhone/Android im Querformat, spielbar auch am Desktop. Gebaut mit Web-Technik (three.js) und als native App verpackt (Capacitor). [BESCHLOSSEN, D1/D2]

**Eigenheiten:**
- Jeder Kämpfer hat ein **Deck aus Fähigkeitskarten** aus seinen Songs, Memes und seinem Image, dazu eine **Signature** mit Kino-Zwischensequenz.
- Der **Beat ist Teil des Kampfs** (Beat-Drop).
- Dazu Mic-Duell, Wand-Splat und eine Fatality mit Mini-Spiel.

**Langfristige Ziele:**
- **Optik auf AAA-Niveau** („Jazeek wie ein AAA+ Character“). [BESCHLOSSEN]
- Später neue Modelle für alle Kämpfer. [BESCHLOSSEN]
- Online-Modus mit Matchmaking. [OFFEN]
- Ranked/Rangliste, Shop, Battle Pass, Währungen: Geschäftsentscheidung des PO. [OFFEN]
- Weitere Kämpfer und Arenen. [OFFEN]

---

## 2. Verbindlich beschlossene Entscheidungen

### 2.1 Technik [BESCHLOSSEN]
- **Technik-Stack:** TypeScript + three.js r186 (WebGL2) + Vite. Capacitor für iOS/Android. Keine Game-Engine (D1).
  - Unity wurde besprochen. Der Agent empfahl, jetzt **nicht** zu wechseln. Der PO hat nicht ausdrücklich entschieden: [VORGESCHLAGEN].
- **Simulation:** deterministisch, nur Ganzzahl-Mathematik (10000 Einheiten = 1 m, 60 Hz), strikt getrennt von der Darstellung (D3). Rollback-Netcode im GGPO-Stil (D4).
- **2.5D:** 3D-Figuren auf einer 2D-Spielebene (D2).
- **Qualitätsstufen** niedrig/mittel/hoch:
  - Handys starten auf MITTEL.
  - Auf HOCH lädt das iPhone seit S17 das volle Jazeek-Modell (`<id>.h.glb`).
  - Textur-Budget gegen Abstürze auf dem iPhone (D41).
- **iPhone-App ohne Apple-Entwicklerkonto:** unsignierte IPA aus GitHub Actions, Installation mit Sideloadly (D44).

### 2.2 Gameplay [BESCHLOSSEN] (Details: `docs/DESIGN.md`)
- **Runden und Zeit:** Best of 3, 99 s pro Runde, 60 fps.
- **Lebenspunkte:** Jazeek 1000, Bonez MC 1050, Manuellsen 1100, Lacazette 980.
- **Knöpfe:** Light, Heavy, Griff, Block, Special 1/2, Signature, Aufladen.
- **Touch:** virtueller Stick links, Knöpfe rechts, die Handkarten unten in der Mitte (D5/D15).
- **Verteidigungs-Dreieck:**
  - Block schlägt Schläge.
  - Griff schlägt Block (Tech-Fenster 10 Frames).
  - Schläge schlagen Griffe.
- **Perfect Block:** höchstens 6 Frames vor dem Treffer gedrückt. Danach ist der nächste Treffer innerhalb von 26 Frames ein Konter (D31).
- **Slams:** vorwärts und rückwärts (D31).
- **Kombos und Schaden:**
  - Ketten L→L→H.
  - Target-Kombos nur per Knopf: L·L·L, H·H, L·L·H, H·L als Launcher, 2L·H (D24).
  - Konter-Treffer: +20 % Schaden.
  - Schadens-Skalierung: ab dem 3. Treffer −12 % pro Treffer, Minimum 30 %.
  - Höchstens 4 Juggle-Treffer.
- **Hype-Meter:** 3 Balken, wird in die nächste Runde übernommen. Aufladen per Halten.
- **Deck:** 2 Specials + 1 Signature in einem festen goldenen Slot.
  - Karten sind nur Fähigkeiten, normale Schläge kosten nichts.
  - **Seltenheit ändert nie die Stärke** (D14).
- **Spezialmechaniken (D35):**
  - Beat-Drop: 90 BPM, ±4 Frames um den Beat = +15 % Schaden.
  - Mic-Duell.
  - Wand-Splat.
  - Fatality mit 3-Knopf-Mini-Spiel. Blut ist abschaltbar, Altersgrenze höchstens USK 16.
- **Signatures:** Super-Flash → Treffer-Check → Kino-Sequenz. Bei Block oder Fehlschlag gibt es keine Sequenz.
  - Die Sequenzen laufen auf halbe Geschwindigkeit (`RULES.CINE_RATE`, D42).
- **Kämpferwahl:** Beide Spieler wählen ihren Kämpfer, Spiegelmatches sind erlaubt. P2 erkennt man im PBR-Look am blauen Rand (D48).
- **Kampfintro:** In Runde 1 wird jeder Kämpfer vorgestellt (Emote, Gesicht in Nahaufnahme, Name, Heimatstadt). Überspringbar (D39).

### 2.3 Design / Optik [BESCHLOSSEN]
- **Menüs:** Design v4 „STREET“ ist Standard.
  - Die 5 Street-Master-Screenshots des PO werden 1:1 zerlegt (`src/ui/v4/`, D47).
  - v2 „RING“ und v1 „KLASSISCH“ lassen sich unter EINSTELLUNGEN → DESIGN umschalten.
  - In v4 gibt es **keine** lebende Platte und keine Glows, Dunst oder Glut (PO). Nur UI-Teile und 3D-Figuren bewegen sich.
- **Master-Screenshots** des PO sind die visuelle Vorlage. Grafik wird aus deren Pixeln geschnitten, Text bleibt nativ auf Deutsch (D38).
- **Alle Texte im Spiel auf Deutsch.**
- **Jazeek und Jazeek Cartoon:** realistischer PBR-Look ohne Comic-Shader und ohne Outline (D50).
  - Eigenes Charakterlicht `CHAR_LIGHT` und Farbkorrektur `CHAR_GRADE` (Render-Pass S17).
- **Bonez, Manuellsen, Lacazette:** bleiben im Cel-/Toon-Look mit Outline, bis ihre neuen Modelle kommen (PO).
- **Neues Jazeek-Cartoon-Modell (modelle-5):** „stylized 3D mobile game character, wenig toon, wie ein Clash Royale Character“ (PO, S18). Der Stil wird beibehalten und das Gesicht nur behutsam an die Fotos angepasst.
- **Standard-Arena:** Podcast-Studio „Block Beats Podcast“ (D29). Außerdem Splash Festival und Bahnhofsviertel als gemalte Kulissen mit 3D-Publikum (D40).
- **Keine Fremdlogos und keine fremde Musik.** Echte Marken und Namen auf Vorlagen werden ersetzt (D7/D33).

### 2.4 Arbeitsregeln des PO [BESCHLOSSEN]
- **„Erstmal nur an Jazeek arbeiten, bis ich etwas anderes sage.“**
  - Keine Änderungen an Bonez, Manuellsen und Lacazette, für sie kommen neue Modelle.
  - Gilt seit S17 und bis auf Widerruf.
- **Keine kostenpflichtigen Tools ohne ausdrückliche Freigabe:** Higgsfield-Credits, Faceit (~100 $), Character Creator usw. (D8).
- **Ehrlich berichten:** VERIFIZIERT vs. UNGEPRÜFT. Visuelles immer per Screenshot prüfen, bevor es als fertig gemeldet wird.
- **Berichte an den PO auf Deutsch**, kurz und knapp. Zwischendurch Screenshots schicken.
- **Echte Personen:** Name, Gesicht und Stimme sind bis zur Freigabe durch den PO nicht geklärt. Gesichter werden nur als Merkmale beschrieben, niemand wird per Gesicht identifiziert.

---

## 3. Anforderungen des PO und ausdrücklich verworfene Ansätze

### 3.1 Anforderungen (dauerhaft)
- **Jazeek als fertiger AAA-Charakter zuerst:** Gesicht nah an den echten Fotos, keine Augenringe, keine Glubschaugen, lebendige Augen.
- **Natürliche Bewegungen:** nicht „labrisch und mechanisch“, Beine nicht ständig zappelnd (S17: Mocap-Beine auf 30 %).
- **Kein „mit Paint gemalt“-Look:** Die Figuren sollen gerendert und plastisch wirken (S17 Render-Pass).
- **iPhone:** flüssig und ohne Grafikverluste. HOCH lädt das volle Modell. Flüssigkeit auf dem Gerät ist **UNGEPRÜFT**.
- **Arbeitsweise:** Zwischenstände mit Screenshots, Vorschau (Artifact) aktuell halten.

### 3.2 Verworfen [BESCHLOSSEN]
- **Design v3** (in Blender gerenderte Menüs, D46): vom PO verworfen. Code liegt in der Git-Historie vor `45ff826`.
- **Lebende Platte und Glows in v4:** PO will ein stilles Gemälde.
- **Comic-/Cel-Shader für Jazeek:** ersetzt durch PBR (S17).
- **Grauer, aufgehellter Farbfilter für Jazeek** (sat 0.5 / gain 1.5): „wie mit Paint gemalt“, ersetzt im S17-Render-Pass.
- **Frühere Kämpfer-Pipelines:** prozedurale Toon-Figuren, MakeHuman-Realismus (D21), Comic-Ausschnitte (D42), erstes Anime-Cartoon-Modell (modelle-4) und zweiter Cartoon-Kopf (anime2). Alle durch neuere Modelle ersetzt.
- **Uppercut aus Motion Capture** für Jazeek (S17): wirkte schwächer, zurückgenommen.
- **Fremder „game-development“-Skill** (`npx skillfish …`): nicht installiert. Das Repo war nicht erreichbar, der PO hat keinen passenden gefunden.
- **Herzbrecher** (Jazeek) und **Palmen-Bassdrop** (Bonez): nicht mehr als Karten im Einsatz, ersetzt durch Ninetynine bzw. Ohne mein Team. Der Code ist noch vorhanden.

---

## 4. Was umgesetzt ist und funktioniert

Siehe auch `docs/STATUS.md` (pro Session mit Nachweis).

**Kern:**
- Deterministische Simulation, Kampfsystem, Rollback-Netcode. **VERIFIZIERT** mit 92/92 Unit-Tests (`npm test`).
- CPU-Gegner (3 Stufen), Training mit Frame-Anzeige, 2 Spieler lokal. **VERIFIZIERT** (e2e).
- Online „Gegen Freunde“ per Code-Austausch (WebRTC). **VERIFIZIERT nur auf demselben Gerät.** Im Artifact blockiert, kein Matchmaking.

**Kämpfer:**
- 4 Kämpfer + Jazeek Cartoon, je 2+1 Karten und Signature-Sequenzen:
  - Jazeek: Ninetynine, Blunt für dich, Diamanten-Regen, Stimmwelle, Spotlight-Dash, Rhythmus-Konter, MVP-Kombo.
  - Bonez: Ohne mein Team, Tiefergelegt, Krokodil, Rauchwand, Lila Becher, Goldzahn-Grinsen.
  - Manuellsen: Sofa-Backpfeifen, 5000 Kurden, König im Schatten.
  - Lacazette: 70 Schüsse, Drei Buchstaben, Chart-Einstieg.
  - **VERIFIZIERT** per Captures (D43/D45).

**Mechaniken:**
- Mic-Duell, Wand-Splat, Beat-Drop, Fatality mit Mini-Spiel, Aufladen, Kampfintro. **VERIFIZIERT** (D35/D39).

**Menüs:**
- Design v4 (Home, Modi, Kämpferwahl, Anpassen, Lobby) sowie Profil/Einstellungen/Deck/Ergebnis/Pause, Freunde. **VERIFIZIERT** auf Desktop- und Handy-Format (D47/D48).

**Jazeek (stylized, modelle-4):**
- Gesicht an den Fotos vermessen: MediaPipe-Abweichung von 2,18 % auf 1,56 % gesenkt.
- Augen und Haare retuschiert, Blinzeln als Morph Target.
- Motion Capture für Idle, Laufen und Jab (CMU-Daten, frei nutzbar).
- PBR-Look mit Charakterlicht.
- **VERIFIZIERT** per Captures (D50, S17).

**iPhone:**
- HOCH lädt das volle Modell (120k Dreiecke, alle Maps in 2K). **VERIFIZIERT** in iPhone-Emulation (geladene Dateien, Dreieckszahl). Leistung auf dem Gerät **UNGEPRÜFT**.

**Builds:**
- iOS-IPA (Workflow `ios.yml`, bei jedem Push auf `claude/**`) und Android-APK (`android.yml`). **VERIFIZIERT** (Build grün). Installation und Lauf auf dem Gerät testet der PO.

**Vorschau (Artifact):**
- Version **v26**: Stand S17 *vor* dem Render-Pass, also noch ohne den neuen Look und ohne das modelle-5-Modell.
- **Muss neu veröffentlicht werden**, siehe Abschnitt 8.

---

## 5. Bekannte Fehler und offene Aufgaben

### 5.1 Bekannte Fehler / Grenzen
- **Jazeek-Optik:** Die KI-Texturen von Meshy setzen die Grenze. Die Locken fransen aus, am Hals sind gemalte Streifen (modelle-4-Jazeek).
- **Verformung:** Ellbogen und Handgelenke verbiegen sich gummiartig, es gibt keine Twist-Knochen. Die Fäuste der Meshy-Hände wirken aus der Nähe leicht krallenartig.
- **Neuer Jazeek Cartoon (modelle-5):**
  - Augenöffnung jetzt nahe an den Fotos.
  - In der Frontal-Aufnahme im Spiel wirken die Lider **eventuell schläfrig**. Wurde zuletzt geprüft, ob das am Kamerawinkel liegt (Kamera unter Augenhöhe). **UNGEPRÜFT**, siehe Abschnitt 9.
- **IPA-Download:** Der Agent kann die IPA nicht direkt schicken, der Proxy sperrt GitHubs Artefakt-Server. Der PO lädt sie aus dem Actions-Lauf.
- **Ninetynine:** Der Ketten-Peitschenschlag wird von `reach.mjs` als „zu kurz“ gemeldet; die Reichweite liefert die Kette als Requisit. Gilt für beide Jazeeks.
- **Weitere:** siehe `docs/STATUS.md` → „Known issues / risks“ (Bot ausnutzbar, Online ohne Matchmaking/TURN, Crew-Statisten grob).

### 5.2 Offene Aufgaben (Jazeek zuerst)
1. **Jazeek Cartoon (modelle-5) fertigstellen:** Augen-Check, ggf. Augenöffnung nachjustieren, e2e/animprobe, Vorschau neu veröffentlichen (Abschnitt 9). [OFFEN]
2. **Twist-Knochen** an Schulter, Ellbogen und Handgelenk. [OFFEN]
3. **Haare:** saubere Silhouette. [OFFEN]
4. **Eingebackene Ambient Occlusion** (Falten, Achseln, unter der Kette). Der Hook `CHAR_LIGHT.ao` existiert, die AO-Map fehlt. [OFFEN]
5. **Mimik:** Faceit (~100 $), eigenes kleines Set oder Character Creator 5. [OFFEN, PO-Entscheidung]
6. **VFX** weg vom Comic, hin zu „high visual stylized“. Geplant nach dem Jazeek-Look. [VORGESCHLAGEN, PO will es]
7. **Mixamo:** Kicks, Treffer-Reaktionen, Emotes, Ausweich-Moves. Der PO lädt FBX („Without Skin“, 30 fps), weil Adobe-Login nötig ist. Das Skelett nutzt schon Mixamo-Namen. [VORGESCHLAGEN, nach dem Look]
8. **„Slip“-Mechanik** (Ausweichen statt Blocken, Timing-basiert, höchstens 2× in Folge, nur gegen Schläge). Wartet auf das „go“ des PO. [VORGESCHLAGEN]
9. **KTX2/Basis-Texturkompression:** etwa 4–8× weniger GPU-Speicher, damit 4K auch aufs iPhone passt. Werkzeug `ktx2-encoder` (npm) gefunden. Test auf echtem iPhone nötig. [VORGESCHLAGEN]
10. **Getrennte Augäpfel** (Blickrichtung, echte Hornhaut-Glanzlichter), Zähne und Mundraum für offene Münder. [VORGESCHLAGEN]
11. **Bonez, Manuellsen, Lacazette:** neue Modelle. Der PO erstellt sie, Nano-Banana-Prompts wurden geliefert (Manuellsen mit neuem Outfit). [OFFEN, wartet auf PO]
12. **PO-Entscheidungen rund um Rechte und Inhalte:** siehe `docs/STATUS.md` → „Needs the product owner“.
    - Bild- und Namensrechte aller echten Personen.
    - Meshy-Lizenz.
    - Drogen- und Waffen-Darstellung (Blunt, Lila Becher, 70 Schüsse).
    - Flagge in 5000 Kurden.
    - Echte Namen auf den Master-Screens.

---

## 6. Wichtige Dateien und Assets

| Pfad | Zweck |
|---|---|
| `src/core/` | Deterministische Simulation (`sim.ts`, `RULES`), Zustand, Eingaben, Registry. Keine DOM- oder three-Imports. |
| `src/content/<id>.ts` | Kämpfer als Daten: Moves, Hitboxen, Karten, Signatures. `index.ts` registriert, `JAZEEK_TOON` = Jazeek Cartoon (Look-Variante von Jazeek). |
| `src/render/view.ts` | GameView: Szene, Kamera, Licht-Slots, Qualitätsstufen, DPR-Regler. |
| `src/render/glbRig.ts` | GLB-Laden (`.glb` / `.m.glb` / `.h.glb`), Retargeting auf das Posen-System, Blinzeln, Fußplanting. |
| `src/render/cel.ts` | Charakter-Materialien: PBR für die Jazeek-Paarung (`CHAR_LIGHT`, `CHAR_GRADE`, `CHAR_NEUTRAL`), Toon/Cel für die anderen. |
| `src/render/textureBudget.ts` | Textur-Budget für Handys. |
| `src/render/anims/` | Animations-Clips pro Kämpfer, `reach.ts` (Reichweiten-Ausgleich pro Modell), `mocap/` (Motion Capture für Jazeek). |
| `src/render/animator.ts` | Zustand → Pose, Blending, Idle-/Walk-Layer. |
| `src/ui/v4/`, `src/ui/v2/`, `src/ui/menu/` | Menü-Designs v4 (Standard), v2, v1. |
| `src/app/app.ts` | Bildschirmfluss, Einstellungen, Pause, Ergebnis. |
| `public/assets/characters/` | Spielmodelle: `<id>.glb` (120k, 4K), `<id>.m.glb` (40k, Handy MITTEL/NIEDRIG), `<id>.h.glb` (120k, Maps 2K, Handy HOCH; nur jazeek/jazeektoon), `<id>.credits.json` (Herkunft). |
| `public/assets/arena/`, `props/`, `ui2/`, `ui4/` | Arenen, Requisiten, Menügrafik. |
| `tools/meshy/merge4.py` | Kopf + Körper zusammenfügen, Gesichts-Fixes, Backen. Styles `styl`/`anime`/`anime2` (modelle-4), `v5` (modelle-5). |
| `tools/meshy/faceretouch.py` | Texel-Retusche: Augen, Lider, Haare, `--underlid` (Augenringe, S18). |
| `tools/meshy/facemarks.py`, `facewarp.py` | MediaPipe-Landmarks und Gesichts-Warp zu den Fotos. |
| `tools/meshy/reduce.py`, `skin.py`, `blink.py`, `texcap.py` | Spielkopie, Rig, Blinzel-Morph, Handy-HOCH-Kopie. |
| `tools/meshy/<id>_cr.py` | Gelenk-Landmarks fürs Rig pro Modell (`jazeektoon_cr.py` = modelle-5). |
| `tools/meshy/warps/warp_v5.json` | Gesichts-Warp von modelle-5 (Fotos → Modell; Augen 0.9, Rest 0.5). |
| `tools/meshy/grid.py` | Orthografische Raster-Renders (`CLEAN=1` ohne Raster). |
| `tools/mocap/` | CMU-BVH → Spielclips (`retarget.py`, `strike.py`). |
| `scripts/*.mjs` | Prüf- und Capture-Skripte (Liste in `CLAUDE.md`): `charshot`, `lookprobe`, `reach`, `animprobe`, `artifact-check`, `e2e` … |
| `.github/workflows/` | `ios.yml` (IPA), `android.yml` (APK), `ci.yml`, `pages.yml`. |

**Nicht in Git (lokal sichern!)**
- `.cache/`: Arbeitskopien und Quellmodelle.
  - Die Original-Meshy-GLBs kommen aus den GitHub-Releases `modelle-1` … `modelle-4`.
  - `modelle-5` ist ein **Entwurfs-Release** und nur per API mit Login ladbar: Asset-IDs `625096356` (Kopf), `625095606` (Körper).
  - Befehl: `curl -L -H "Accept: application/octet-stream" https://api.github.com/repos/lenti02-king/RapbrawlDE/releases/assets/<id>`.
- `artifacts/`: Screenshots und Captures. Darin die **Referenzfotos von Jazeek**: `artifacts/s17/photo_event.png`, `photo_wall.png`, `photo_beach.png`. Sie sind nötig für `facemarks`/`facewarp`/`faceretouch`. **[UNKLAR]**: Der PO hat die Originale; bitte lokal ablegen.
- `public/assets/music/*.mp3`: eigene Musik als Drop-in, ohne Lizenz nicht ins Repo.
- `tools/ui-extract/ref/`, `tools/arena/ref/`: Master-Screenshots und Gemälde des PO (enthalten Fremdmarken).

---

## 7. Projekt und Vorschau starten

```bash
npm install
npm run dev                 # Vite-Dev-Server, http://localhost:5173 (mit --host fürs Handy im WLAN)
npm test                    # 92 Unit-Tests: Sim, Determinismus, Rollback
npm run typecheck
npm run build               # dist/
npm run e2e                 # Playwright gegen BASE_URL (Dev-Server muss laufen)
```

- **Schnellstart-URLs:**
  - `/?quick=jazeektoon,bonez&mode=cpu` (auch `local`, `training`, `demo`)
  - `?q=low|medium|high`
  - `?ui=v1|v2|v4`
  - `?arena=festival|bahnhof`
- **Debug-API:** `window.__rb` in der Browser-Konsole.
- **Lange Capture-Läufe:** ein Dev-Server ohne HMR: `scripts/nohmr.sh 5175`, dann `BASE_URL=http://localhost:5175 …`.
- **Vorschau (privates claude.ai-Artifact):** https://claude.ai/artifact/QxFGw7nin7xvWrdnmQZuiv
  1. `node scripts/artifact-check.mjs` baut `dist-single/` und prüft Modelle und Arenen unter Artifact-CSP.
  2. `dist-single/rapbrawl.html` mit `rapbrawl.js` und den geänderten Dateien unter `dist-single/assets/` als Begleitdateien veröffentlichen (D41).
- **iPhone:** jeder Push auf `claude/**` baut die IPA.
  - GitHub → Actions → „iOS app (unsigned IPA for sideloading)“ → Artifact `rapbrawl-ios-ipa` → `RAPBRAWL.ipa` mit Sideloadly installieren (kostenlose Apple-ID, 7 Tage gültig).
  - Im Spiel: EINSTELLUNGEN → GRAFIKQUALITÄT → HOCH für die volle Grafik.
- **Android:** Actions → „Android debug APK“ → `rapbrawl-debug-apk`.
- **Python/Blender-Werkzeuge:** Python 3 mit `bpy` (Blender 4.2 als Modul), numpy, scipy, Pillow. MediaPipe in einem venv: `.cache/mpvenv`, siehe `tools/meshy/facemarks.py`.

---

## 8. Nächste geplante Schritte (Reihenfolge)
1. **Jazeek Cartoon (modelle-5) abschließen**, siehe Abschnitt 9:
   - Augen bei Augenhöhe prüfen.
   - Bei Bedarf Augen-Warp abschwächen (Augen-Anteil 0.9 → ~0.6) und die Pipeline neu laufen lassen.
   - Menü-Screenshots.
   - animprobe, e2e, `artifact-check`, Vorschau neu veröffentlichen.
   - Screenshots an den PO.
2. **Render-Qualität Jazeek-Paarung:** AO backen, Twist-Knochen, Haare.
3. **Entscheidungen des PO einholen:** Slip-Mechanik, Mimik-Weg (Faceit / eigenes Set / Character Creator 5 + Headshot 3), KTX2-Test.
4. **VFX-Restyle** („high visual stylized“).
5. **Mixamo-Animationen** für fehlende Moves, sobald der PO die FBX liefert.
6. **Neue Modelle** für Bonez, Manuellsen und Lacazette einbauen, wenn der PO sie liefert. Gleiche Pipeline: `merge4` → `faceretouch` → `reduce` → `skin` → `blink` → `texcap`.

---

## 9. Arbeitsstand Session 18 (zum Wiederaufnehmen)

**Auftrag des PO:**
- Neues Jazeek-Modell „Jazeek 3“ (modelle-5: Kopf + Körper, Meshy) als **Ersatz für Jazeek Cartoon**.
- Gesicht ans Original anpassen: Glubschaugen und Augenringe weg.
- Erst recherchieren, wie es in bester Qualität ins Spiel kommt.
- Zwischendurch Screenshots, am Ende Vorschau neu starten.

**Erledigt (GEBAUT, teils VERIFIZIERT):**
- **Zusammenfügen:** `merge4.py v5`.
  - Der Körper hat keinen Kopf, deshalb wird der Kopf über den Hals skaliert und um 12 % größer gemacht (Mobile-Game-Proportionen).
  - Die Figur wird auf den modelle-4-Rahmen normiert.
  - Körperhaut an das Gesicht angeglichen.
- **Augen:** zurückgesetzt, Tränensäcke geometrisch geglättet.
- **Gesichts-Warp** zu den Fotos (`tools/meshy/warps/warp_v5.json`). MediaPipe-Messung, VERIFIZIERT:
  - Augenbreite 0,496 → 0,445 (Fotos 0,40–0,42).
  - Augenöffnung 0,151 → 0,116 (Fotos 0,10–0,12).
- **Augenringe** per Texel-Retusche (`faceretouch.py --underlid 0.95`) entfernt. VERIFIZIERT per Nahaufnahme-Render.
- **Rig, LODs, Blinzeln:**
  - Rig mit neuen Landmarks (`jazeektoon_cr.py`).
  - Modelle `jazeektoon.glb`, `.m.glb`, `.h.glb` mit Blinzel-Morph.
- **Reichweiten-Ausgleich** in `reach.ts` neu kalibriert: alle Moves „ok“ außer Ninetynine (Kette).
- **Erste Screenshots im Spiel** (Kampf, Körper, Gesicht) in `artifacts/s18/`.

**Pipeline zum Wiederholen:**
```bash
python3 tools/meshy/merge4.py v5 --scale 1.12 --facewarp tools/meshy/warps/warp_v5.json --preview artifacts/meshy5/final
.cache/mpvenv/bin/python tools/meshy/facemarks.py artifacts/meshy5/fm_final.json artifacts/s17/photo_event.png artifacts/s17/photo_wall.png artifacts/meshy5/final/v5_final_front.png
python3 tools/meshy/faceretouch.py jazeektoon artifacts/meshy5/fm_final.json artifacts/meshy5/final/v5_final_front.png artifacts/s17/photo_event.png,artifacts/s17/photo_wall.png --iris 0 --sclera 0 --lid 0 --hair 0 --hair-rough 0.5 --catch 0 --underlid 0.95
python3 tools/meshy/reduce.py jazeektoon --dir meshy4 --keep-mr
python3 tools/meshy/reduce.py jazeektoon --dir meshy4 --keep-mr --tris 40000 --base 2048 --maps 1024 --out .cache/meshy4/jazeektoon_mob_src.glb
python3 tools/meshy/skin.py jazeektoon --dir meshy4 --src .cache/meshy4/jazeektoon_std_src.glb --out public/assets/characters/jazeektoon.glb
python3 tools/meshy/skin.py jazeektoon --dir meshy4 --src .cache/meshy4/jazeektoon_mob_src.glb --out public/assets/characters/jazeektoon.m.glb
python3 tools/meshy/blink.py artifacts/meshy5/fm_final.json artifacts/meshy5/final/v5_final_front.png public/assets/characters/jazeektoon.glb public/assets/characters/jazeektoon.m.glb
python3 tools/meshy/texcap.py public/assets/characters/jazeektoon.glb public/assets/characters/jazeektoon.h.glb
```
(Die Quell-GLBs gehören nach `.cache/meshy5/` und werden als `.cache/meshy4/v5_head_src.glb` / `v5_body_src.glb` verlinkt.)

**Offen in S18:**
- **Augen-Check:** Frontal im Spiel wirken die Lider möglicherweise schwer.
  - Nächster Test: Kamera exakt auf Augenhöhe, Blinzeln aus (`EXTRA="&blink=0"`).
  - Dafür war eine Option `FRONT_DY` für `scripts/charshot.mjs` geplant; noch **nicht** eingebaut.
- **Weitere Prüfungen:** Menü-Screenshot mit dem neuen Modell, animprobe, e2e, `artifact-check`, Vorschau neu veröffentlichen, Bericht an den PO.
- **Anzeigename** bleibt „JAZEEK CARTOON“. [UNKLAR] Ob der PO für das neue Modell einen anderen Namen will.
