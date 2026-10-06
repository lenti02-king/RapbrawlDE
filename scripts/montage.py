# montage.py out.png in1.png in2.png ... : images side by side (same height), inputs removed when DEL=1
import os, sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
H = max(i.height for i in ims)
c = Image.new('RGB', (sum(i.width for i in ims), H))
x = 0
for i in ims:
    c.paste(i, (x, 0))
    x += i.width
c.save(out)
if os.environ.get('DEL'):
    for f in files:
        os.remove(f)
