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

## Eigene Artworks einsetzen (später)
Für Karten, Items, Charaktere, Auswahlkästen und Banner einfach die jeweilige Ebene in Figma ersetzen und das
Ergebnis als PNG/WebP exportieren (gleiche Größe wie die Ebene). Ablage im Spiel:
- Banner: `public/assets/ui4/art/banner_p1.webp`, `banner_p2.webp`
- Auswahlkästen Kämpferwahl: `public/assets/ui4/art/select/<kämpfer-id>.webp` (jazeek, bonez, manuellsen, lacazette)
- Skins: `public/assets/ui4/art/skins/<kämpfer-id>_<1-6>.webp`
- Karten: `public/assets/cards/<karten-id>.webp` (wird schon jetzt bevorzugt angezeigt)

Neu erzeugen (nach Änderungen an den Mastern): `python3 tools/ui-extract/v4_screens.py all && python3 tools/ui-extract/v4_figma.py`
