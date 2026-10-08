# RAPBRAWL Design v4 – Figma-Dateien

Deine fünf Master-Screens als **Ebenen-Dateien für Figma** (nichts neu gezeichnet – alles aus deinen Bildern
ausgeschnitten):

| Datei | Screen |
|---|---|
| `home.svg` | Hauptmenü (Frankfurt, Taunusstraße / Moselstraße) |
| `modes.svg` | Spielmodus (Frankfurt Hauptbahnhof) |
| `select.svg` | Kämpferauswahl (Berlin, Pallasseum) |
| `custom.svg` | Kämpfer anpassen (Berlin Schöneberg) |
| `lobby.svg` | Freunde-Lobby (Berlin, Pallasstraße) |

## In Figma öffnen
1. Figma öffnen → Datei oder Seite wählen.
2. Die `.svg`-Datei **ins Figma-Fenster ziehen** (oder *Datei → Importieren*).
3. Jede Datei wird ein Frame 1672 × 941 px mit diesen Ebenen-Gruppen:
   - **Referenz (Original-Master)** – dein Originalbild, unsichtbar (Deckkraft 0 %); zum Vergleichen auf 100 % stellen.
   - **Hintergrund** – die Szene ohne UI (Stellen hinter den Panels sind automatisch aufgefüllt, man sieht sie nur, wenn
     man ein Panel wegschiebt).
   - **Panels und Banner** – große Flächen als eigene Bilder: Freunde-/Lobby-Panel, Skin-Panel, Stats-Leiste,
     Auswahl-Raster, Banner rot/blau, Podeste, Namensschilder, Nav-Leiste, die Ketten-Rahmen der gelben Buttons.
   - **UI-Elemente** – jeder Button, jede Kachel, jede Kapsel einzeln (z. B. „Kachel KÄMPFER“, „Button FIGHT“,
     „Skin GOLD“, „Einladen 1“).
   - **Zustände** – Teile, die das Spiel verschiebt oder umschaltet (blauer Auswahlrahmen, P1/P2-Cursor, leuchtende
     Stat-Zelle, ONLINE/OFFLINE-Beschriftung, leere Buttons blau/gold). Unsichtbar (0 %), bei Bedarf einschalten.
   - **Texte (live)** – alles, was das Spiel selbst schreibt (Münzen, Diamanten, Pokale, Spielername, Level, XP,
     Kämpfernamen, Room-Code …) als **editierbare Textebenen** in *Barlow Condensed* (in Figma als Google-Font verfügbar).

## Eigene Artworks einsetzen
Wo genau welches Bild hinkommt, zeigen die markierten Screens in `design/v4/artwork/` (01 Hauptmenü, 02 Kämpferauswahl,
03 Kämpferkarten, 04 Anpassen, 05 Karten/Deck). Format: PNG oder WebP, Größe wie unten (oder größer im selben
Seitenverhältnis). Datei ablegen, `npm run build` (oder `node scripts/art-manifest.mjs`) – das Spiel zeigt sie sofort
statt des Platzhalters.

| Wo | Datei | Größe | Hinweis |
|---|---|---|---|
| Hauptmenü, Kacheln (6) | `public/assets/ui4/art/home/kaempfer.webp`, `deck.webp`, `shop.webp`, `events.webp`, `battlepass.webp`, `anpassen.webp` | 772×368, 790×298, 798×286, 786×336, 802×310, 808×300 | ganze Kachel mit Rahmen und Schrift, transparenter Rand (Vorlage: Ebene „Kachel …“ in `home.svg`) |
| Kämpferauswahl, Banner | `public/assets/ui4/art/banner_p1.webp`, `banner_p2.webp` | 652×956 | hinter dem Kämpfer, rot/blau |
| Kämpferauswahl, Auswahlkästen (Gesichter) | `public/assets/ui4/art/select/<kämpfer>.webp` | 270×216 | wird achteckig beschnitten, Gesicht mittig; auch das Avatar-Bild im Hauptmenü |
| Kämpfer, Kartenbild | `public/assets/ui4/art/fighters/<kämpfer>.webp` | 816×1002 (4:5) | ohne Namen – Name und Heimatstadt setzt das Spiel darunter |
| Anpassen, Skins (Items) | `public/assets/ui4/art/skins/<kämpfer>_<1-6>.webp` | 616×333 | Felder STANDARD, STREET, CHAMPION, NACHT, GOLD, EXKLUSIV |
| Karten (Deck, Sammlung, Kampf) | `public/assets/cards/<karten-id>.webp` | 768×1024 (3:4) | Kosten, Name, Signature-Krone setzt das Spiel darüber |

`<kämpfer>` = `jazeek`, `bonez`, `manuellsen`, `lacazette`.

Karten-IDs:
- Jazeek: `jaz_wave` (Stimmwelle), `jaz_rain` (Diamanten-Regen), `jaz_blunt` (Blunt für dich), `jaz_spot` (Spotlight-Dash), `jaz_counter` (Rhythmus-Konter), `jaz_mvp` (MVP-Kombo), `jaz_99` (Ninetynine, Signature)
- Bonez MC: `bon_car` (Tiefergelegt), `bon_croc` (Krokodil-Attacke), `bon_smoke` (Rauchwand), `bon_lean` (Lila Becher), `bon_grin` (Goldzahn-Grinsen), `bon_team` (Ohne mein Team, Signature)
- Manuellsen: `manu_kurden` (5000 Kurden), `manu_schatten` (König im Schatten), `manu_sofa` (Sofa-Backpfeifen, Signature)
- Lacazette: `laca_abc` (Drei Buchstaben), `laca_chart` (Chart-Einstieg), `laca_gwagon` (70 Schüsse, Signature)

Die markierten Screens neu erzeugen (nach Layout-Änderungen): Screens aufnehmen (`UI=v4 node scripts/v2shot.mjs …`)
und `python3 tools/ui-extract/artwork_sheets.py <ordner>`.

Neu erzeugen (nach Änderungen an den Mastern): `python3 tools/ui-extract/v4_screens.py all && python3 tools/ui-extract/v4_figma.py`
