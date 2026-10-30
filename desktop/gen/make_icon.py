# Builds desktop/icon.png (256x256) from the first frame of the red queen sprite,
# scaled up with nearest-neighbour so it stays chunky pixel art.
from PIL import Image
import os

here = os.path.dirname(os.path.abspath(__file__))
sheet = Image.open(os.path.join(here, '..', '..', 'public', 'sprites', 'ants', 'Queen', 'queen_idle_red.png')).convert('RGBA')
frame = sheet.crop((0, 0, 32, 32))
frame = frame.crop(frame.getbbox())
side = max(frame.size) + 4
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.paste(frame, ((side - frame.width) // 2, (side - frame.height) // 2))
scale = 256 // side
icon = canvas.resize((side * scale, side * scale), Image.NEAREST)
out = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
out.paste(icon, ((256 - icon.width) // 2, (256 - icon.height) // 2))
out.save(os.path.join(here, '..', 'icon.png'))
