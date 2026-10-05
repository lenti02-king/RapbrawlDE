# UI extraction (D38)

The PO's UI screenshots are the visual master. These scripts cut them into game assets: panel/button/frame art as
sprites (baked text removed), a clean background plate, and a generated TypeScript table of reference-pixel boxes. The
game sets all text natively (German) at those boxes.

## Setup (once per machine, free)
```
pip install opencv-contrib-python-headless torch pillow numpy
mkdir -p .cache/lama && curl -L -o .cache/lama/big-lama.pt https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt
```
LaMa (https://github.com/advimman/lama, Apache-2.0) fills the background behind panels and under removed text. Without
it the scripts fall back to OpenCV inpainting (fine for small holes, smeary for large ones).

## References (not in git)
Put the PO's master screenshots in `tools/ui-extract/ref/` (git-ignored: they contain third-party marks such as the
car badge). Names used by the scripts: `main_menu.webp`, `logo.jpg` (PO logo on black), later `loading.webp`,
`char_select.webp`, `arena_select.webp`, `shop.webp`, `battle_pass.webp`, `hud.webp`, `leaderboard.webp`.

## Run
```
python3 tools/ui-extract/main_menu.py        # -> src/ui/img/menu/*.webp + src/ui/menu/mainMenuArt.ts (~2 min CPU)
python3 tools/ui-extract/loading.py          # loading/title screen
python3 tools/ui-extract/char_select.py      # character select (plate outpainted for wide phones, ~4 min)
python3 tools/ui-extract/arena_select.py     # arena select
python3 tools/ui-extract/shop.py             # shop (swooshes retouched first)
REUSE_BG=1 python3 tools/ui-extract/main_menu.py   # keep the cached background plate (.cache/ui/mm_bg.png)
python3 tools/ui-extract/sheet.py src/ui/img/menu .cache/ui/sheet.png   # sprites on magenta (alpha check)
node scripts/menushot.mjs artifacts/menu     # captures: 2000x1125 + phones in landscape (dev server running)
python3 tools/ui-extract/compare.py tools/ui-extract/ref/main_menu.webp artifacts/menu/ref.png artifacts/menu/compare.png
```
All coordinates live at the top of each screen script (`ELEMENTS`: grabcut box, frame interior, text zones, removal
zones, progress bars, transparent slots). Debug images go to `.cache/ui/`.
