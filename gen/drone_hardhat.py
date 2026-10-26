"""Drone sheets wearing a yellow hard hat, shown while a Drone builds an anthill.
Built on the coloured drone idle sheets so the bob matches.
Usage: python3 gen/drone_hardhat.py [out_dir]"""
import sys
from PIL import Image

SRC = 'public/sprites/ants/Drone'
OUT = sys.argv[1] if len(sys.argv) > 1 else SRC
OUTLINE, DARK, MID, LIGHT = (36, 16, 32), (192, 136, 0), (248, 200, 0), (255, 240, 128)


def head_top(f):
    for y in range(4, 20):
        run = best = 0
        for x in range(18, 28):
            run = run + 1 if f.getpixel((x, y))[3] else 0
            best = max(best, run)
        if best >= 4:
            xs = [x for x in range(18, 28) if f.getpixel((x, y))[3]]
            return y, min(xs), max(xs)
    return 11, 20, 24


def hat(f):
    top, x0, x1 = head_top(f)
    out = f.copy()
    # clear the antennae poking up through the hat
    for y in range(0, top):
        for x in range(x0 - 2, x1 + 3):
            out.putpixel((x, y), (0, 0, 0, 0))
    p = lambda x, y, c: out.putpixel((x, y), c + (255,))
    # brim: one row on the head's top, a pixel wider each side (peak to the front)
    for x in range(x0 - 1, x1 + 3):
        p(x, top, OUTLINE)
    for x in range(x0, x1 + 2):
        p(x, top - 1, DARK)
    p(x0 - 1, top - 1, OUTLINE); p(x1 + 2, top - 1, OUTLINE)
    # dome: three rows narrowing upward
    for k, (a, b) in enumerate(((x0, x1), (x0, x1), (x0 + 1, x1 - 1))):
        y = top - 2 - k
        for x in range(a, b + 1):
            p(x, y, LIGHT if (k == 1 and x == a + 1) else MID)
        p(a - 1, y, OUTLINE); p(b + 1, y, OUTLINE)
    for x in range(x0 + 1, x1):
        p(x, top - 5, OUTLINE)
    # centre ridge
    p((x0 + x1) // 2, top - 3, DARK)
    p((x0 + x1) // 2, top - 4, DARK)
    return out


for c in ['red', 'blue', 'green', 'yellow', 'black']:
    sheet = Image.open(f'{SRC}/drone_idle_{c}.png').convert('RGBA')
    n = sheet.width // 32
    out = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
    for i in range(n):
        out.alpha_composite(hat(sheet.crop((i * 32, 0, i * 32 + 32, 32))), (i * 32, 0))
    out.save(f'{OUT}/dronebuilding_idle_{c}.png')
print('done')
