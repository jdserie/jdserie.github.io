"""Render the standalone crossed-shockwave mark at installable sizes."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
canvas = Image.new('RGB', (512, 512), '#101722')
draw = ImageDraw.Draw(canvas)
draw.rounded_rectangle((32, 32, 480, 480), radius=95, fill='#172637', outline='#334c62', width=8)
draw.ellipse((104, 104, 408, 408), outline='#39546e', width=8)
draw.polygon([(93, 114), (273, 208), (244, 238), (419, 363), (240, 295), (260, 255)], fill='#68ecf2')
draw.polygon([(418, 105), (303, 247), (334, 265), (104, 410), (207, 253), (174, 231)], fill='#ff776a')
draw.polygon([(256, 193), (271, 236), (315, 253), (271, 273), (256, 317), (239, 273), (196, 256), (239, 238)], fill='#fff9eb')
for name, side in (('icon.png', 192), ('icon-512.png', 512)):
    canvas.resize((side, side), Image.Resampling.LANCZOS).save(ROOT / 'web/assets' / name, optimize=True)
