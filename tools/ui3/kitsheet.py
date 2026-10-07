# Kit look check: every icon and the basic pieces rendered one by one -> artifacts/ui3/kit/*.png (+ _kit.jpg)
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import lib  # noqa: E402

OUT = os.path.join(lib.ROOT, 'artifacts', 'ui3', 'kit')
os.makedirs(OUT, exist_ok=True)
only = sys.argv[1].split(',') if len(sys.argv) > 1 else None
done = []


def go(name, fn, w, h, px=180, samples=64):
    if only and name not in only:
        return
    t = time.time()
    lib.reset(samples)
    kit._mats.clear()
    kit._link_mesh.clear()
    lib.studio_world(0.55)
    lib.ui_lights()
    fn()
    lib.ortho_camera(w, h, px)
    p = lib.render(os.path.join(OUT, f'{name}.png'))
    done.append(p)
    print(name, f'{time.time() - t:.1f}s', flush=True)


for k, fn in kit.ICONS.items():
    go(k, fn, 1.3, 1.3)
for c in ('gold', 'blue', 'red', 'green', 'purple'):
    go(f'btn_{c}', lambda c=c: kit.candy_button(3.0, 0.9, c), 3.4, 1.2, 120)
go('btn_chains', lambda: kit.candy_button(4.6, 1.3, 'gold', chains=True), 6.2, 2.2, 120)
go('panel', lambda: kit.panel(3.6, 1.0, inner_line='#3d8dff'), 3.9, 1.3, 120)
go('pill', lambda: kit.pill(1.8, 0.52), 2.0, 0.7, 150)
go('badge', lambda: kit.badge(), 0.5, 0.5, 300)
subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'contact.py'), os.path.join(OUT, '_kit.jpg'), *done])
