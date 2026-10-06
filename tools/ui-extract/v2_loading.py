"""Design v2 loading / title screen (PO master ref/v2/loading.webp): see v2x.py. Run: python3 tools/ui-extract/v2_loading.py
The bar track is rebuilt empty (the fill is a part sprite the game stretches), the label and the tip are native text."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import v2x  # noqa: E402

ELEMENTS = {
    'bar': dict(box=(462, 672, 1216, 790), shape='rect', socket=False, text={'label': (722, 752, 952, 786)}, smooth=['label'],
                bars=[((484, 703, 1194, 743), (1040, 1120))], marks={'track': (488, 706, 1190, 740)}),
    'tip': dict(box=(480, 802, 1200, 898), shape='rect', socket=False, text={'tip': (588, 826, 1134, 864)}, smooth=['tip']),
}
PARTS = {'fill': dict(box=(488, 706, 846, 740))}

if __name__ == '__main__':
    v2x.run('loading', 'loading.webp', ELEMENTS, parts=PARTS, light_ymax=640,
            no_lights=[(500, 0, 1120, 450), (460, 660, 1220, 900)])
