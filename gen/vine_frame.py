"""Pixel-art twisted-branch frame for the "Your Turn" pop-up, used as a CSS
9-slice border-image (slice 16). 48x48: 16px corners, a 16px edge that tiles
(the twist repeats every 8px), transparent middle.
Usage: python3 gen/vine_frame.py [out_path]"""
import sys, math
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/sprites/ui/vine_frame.png'
N, B = 48, 16
OUTLINE = (34, 22, 14)
BARK = [(74, 44, 22), (112, 70, 34), (150, 100, 52), (186, 136, 78)]
LEAF = [(30, 78, 30), (52, 124, 40), (96, 168, 60), (150, 206, 96)]

g = {}


def put(x, y, c):
    if 0 <= x < N and 0 <= y < N:
        g[(x, y)] = c


def branch_top():
    """The top edge: a 6px-thick branch with diagonal twist grooves every 8px."""
    for x in range(6, N - 6):          # ends tuck into the corner knots
        for y in range(5, 12):
            t = (x + (y - 5)) % 8          # slanted twist
            if t == 0:
                c = BARK[0]                 # groove
            elif t == 1:
                c = BARK[3] if y < 8 else BARK[2]   # lit ridge after the groove
            else:
                c = BARK[2] if y < 7 else BARK[1] if y < 10 else BARK[0]
            put(x, y, c)


# build the top edge, then copy it round the other three sides
branch_top()
top = dict(g)
g.clear()
for (x, y), c in top.items():
    put(x, y, c)                  # top
    put(x, N - 1 - y, c)          # bottom
    put(y, x, c)                  # left
    put(N - 1 - y, x, c)          # right

# the panel's own dark backing inside the branch, so leaves sit on it
BG = (31, 23, 15)
for y in range(10, N - 10):
    for x in range(10, N - 10):
        if (x, y) not in g:
            put(x, y, BG)

# corner knots: a round burl of bark with a leaf pair
for cx, cy in ((8, 8), (N - 9, 8), (8, N - 9), (N - 9, N - 9)):
    for y in range(cy - 4, cy + 5):
        for x in range(cx - 4, cx + 5):
            d = (x - cx) ** 2 + (y - cy) ** 2
            if d <= 17:
                put(x, y, BARK[3] if d <= 3 and x <= cx else BARK[2] if d <= 9 else BARK[1])
    put(cx - 1, cy - 1, BARK[0]); put(cx + 1, cy + 1, BARK[0])
    sx = 1 if cx < N // 2 else -1
    sy = 1 if cy < N // 2 else -1
    # leaf pointing into the frame's middle
    for k in range(5):
        lx, ly = cx + sx * (4 + k), cy + sy * (4 + k)
        put(lx, ly, LEAF[2]); put(lx - sx, ly, LEAF[1]); put(lx, ly - sy, LEAF[3] if k < 3 else LEAF[2])

# a leaf hanging inward from each 8px tile of every edge (so edges still tile)
LEAF_SHAPE = [(0, 0, 1), (1, 0, 2), (0, 1, 2), (1, 1, 2), (2, 1, 3), (1, 2, 1), (2, 2, 2), (2, 3, 1)]
for x in range(B, N - B, 8):
    for dx, dy, shade in LEAF_SHAPE:
        lx, ly = x + 2 + dx, 12 + dy
        for (px, py) in ((lx, ly), (lx, N - 1 - ly), (ly, lx), (N - 1 - ly, lx)):
            put(px, py, LEAF[shade])

# dark outline round everything
filled = set(g)
for (x, y) in list(filled):
    if g[(x, y)] == BG:
        continue
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        q = (x + dx, y + dy)
        if q not in filled and 0 <= q[0] < N and 0 <= q[1] < N:
            g[q] = OUTLINE

im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
for (x, y), c in g.items():
    im.putpixel((x, y), c + (255,))
im.save(OUT)
print('done')
