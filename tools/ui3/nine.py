# Design v3 (S13b): 9-slice pieces for the CSS-drawn v3 UI (profile, settings, deck, results, pause, friends, HUD,
# chips, toasts) -> public/assets/ui3/kit/*.webp. Used with border-image in src/ui/v3/v3.css (slice values there).
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import lib  # noqa: E402
import pieces as P  # noqa: E402

OUT = os.path.join(lib.ROOT, 'public', 'assets', 'ui3', 'kit')
only = sys.argv[1].split(',') if len(sys.argv) > 1 else None


def want(n):
    return not only or n in only


def save(name, im):
    os.makedirs(OUT, exist_ok=True)
    im.save(os.path.join(OUT, f'{name}.webp'), 'WEBP', quality=90, method=6)


if __name__ == '__main__':
    if want('panel'):
        save('panel', P.render_piece('k_panel', 240, 240, lambda w, h: kit.panel(w - 0.06, h - 0.06, r=0.3, face=('#232c78', '#0a0d30'), rim='gold', rim_w=0.09, inner_line='#5fa8ff')))
    if want('panel_gold'):
        save('panel_gold', P.render_piece('k_panel_gold', 240, 240, lambda w, h: kit.panel(w - 0.06, h - 0.06, r=0.3, face=('#3a2a8a', '#140c40'), rim='gold', rim_w=0.12, inner_line='#ffd23f')))
    if want('panel_red'):
        save('panel_red', P.render_piece('k_panel_red', 240, 240, lambda w, h: kit.panel(w - 0.06, h - 0.06, r=0.3, face=('#a0283e', '#3a0812'), rim='gold', rim_w=0.09, inner_line='#ff8a9c')))
    if want('well'):
        def well(w, h):
            pts = lib.rounded_rect_pts(w - 0.04, h - 0.04, 0.22)
            lib.frame('wr', pts, 0.035, 0.14, kit.gold(), bevel=0.012)
            lib.slab('wf', lib.inset(pts, 0.03), 0.1, 0.02, kit.candy('well', '#0a0e2c', '#141a44', h, rough=0.45, coat=0.3), seg=3)
        save('well', P.render_piece('k_well', 240, 240, well, outline=0))
    for c in ('gold', 'blue', 'red', 'green', 'navy', 'purple'):
        if want(f'btn_{c}'):
            save(f'btn_{c}', P.render_piece(f'k_btn_{c}', 320, 120, lambda w, h, c=c: kit.candy_button(w - 0.06, h - 0.1, c, r=0.34, depth=0.28)))
    if want('cap'):
        def cap(w, h):
            body = lib.rounded_rect_pts(w - 0.06, h - 0.1, (h - 0.1) / 2 - 0.001, seg=16)
            lib.frame('rim', body, 0.045, 0.14, kit.gold(), bevel=0.016)
            lib.slab('face', lib.inset(body, 0.035), 0.1, 0.03, kit.candy('capf', '#262a5a', '#0b0d26', h, rough=0.3, coat=0.7), seg=4)
        save('cap', P.render_piece('k_cap', 240, 70, cap))
    if want('tab_on'):
        save('tab_on', P.render_piece('k_tab_on', 200, 90, lambda w, h: kit.candy_button(w - 0.06, h - 0.08, 'blue', r=0.24, depth=0.22)))
    if want('tab_off'):
        save('tab_off', P.render_piece('k_tab_off', 200, 90, lambda w, h: kit.candy_button(w - 0.06, h - 0.08, 'navy', r=0.24, depth=0.22, gloss=False)))
