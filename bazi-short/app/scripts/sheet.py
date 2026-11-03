"""contact sheet: python3 scripts/sheet.py out.jpg cols width img1 img2 ... (labels = file names)"""
import sys
from PIL import Image, ImageDraw
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
ims = [Image.open(p).convert("RGB") for p in sys.argv[4:]]
h = int(w * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
S = Image.new("RGB", (cols * w, rows * (h + 18)), "white")
d = ImageDraw.Draw(S)
for i, (p, im) in enumerate(zip(sys.argv[4:], ims)):
    x, y = (i % cols) * w, (i // cols) * (h + 18)
    S.paste(im.resize((w, h)), (x, y + 18)); d.text((x + 4, y + 3), p.split("/")[-1], fill="black")
S.save(out, quality=85)
