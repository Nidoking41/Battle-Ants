"""Unclaimed Mine and Honeypot node sprites (32x32), shown before a Drone builds
on them. Once built they become the mound sprites (mine_<c>.png / honeypot_<c>.png).
Usage: python3 gen/node_sprites.py [out_dir]"""
import sys
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/sprites/anthill'
S = 32
OUTLINE = (30, 20, 24)


def blank():
    return [[None] * S for _ in range(S)]


def ellipse(g, cx, cy, rx, ry, color_fn):
    for y in range(S):
        for x in range(S):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if dx * dx + dy * dy <= 1:
                c = color_fn(x, y, dx, dy)
                if c:
                    g[y][x] = c


def outline(g):
    out = [row[:] for row in g]
    for y in range(S):
        for x in range(S):
            if g[y][x] is None and any(
                    0 <= x + dx < S and 0 <= y + dy < S and g[y + dy][x + dx] is not None
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = OUTLINE
    return out


def save(g, name):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    for y in range(S):
        for x in range(S):
            if g[y][x]:
                im.putpixel((x, y), g[y][x] + (255,))
    im.save(f'{OUT}/{name}.png')


# ---------------------------------------------------------------- Mine
# A rocky outcrop with a timber-braced tunnel mouth and blue crystal veins
ROCK = [(70, 72, 80), (104, 106, 116), (140, 142, 152), (178, 180, 188)]
WOOD = [(92, 56, 28), (140, 90, 44), (176, 124, 64)]
CRY = [(40, 110, 200), (90, 180, 255), (200, 240, 255)]


def mine():
    g = blank()

    def rock(x, y, dx, dy):
        light = -dx * 0.5 - dy * 0.8 + ((x * 7 + y * 3) % 5) * 0.08
        return ROCK[0] if light < -0.5 else ROCK[1] if light < 0.1 else ROCK[2] if light < 0.55 else ROCK[3]
    # three boulders make a lumpy, angular outcrop (not a round mound)
    ellipse(g, 11, 20, 9, 8, rock)
    ellipse(g, 21, 21, 9, 7, rock)
    ellipse(g, 16, 13, 8, 8, rock)
    # cracks between the boulders
    for (x, y) in [(13, 10), (12, 11), (19, 15), (20, 16), (6, 18), (7, 19), (25, 18), (24, 19)]:
        g[y][x] = ROCK[0]
    # tunnel mouth: dark arch at the bottom centre
    for y in range(18, 28):
        for x in range(12, 21):
            if (x - 16) ** 2 / 16 + (y - 23) ** 2 / 25 <= 1 and y >= 19:
                g[y][x] = (20, 14, 18) if y > 20 else (36, 28, 34)
    # timber frame: two posts and a lintel
    for y in range(19, 28):
        g[y][11] = WOOD[1]; g[y][12] = WOOD[0]
        g[y][20] = WOOD[1]; g[y][21] = WOOD[0]
    for x in range(10, 23):
        g[18][x] = WOOD[2] if x % 4 else WOOD[1]
        g[19][x] = WOOD[0] if x not in (11, 12, 20, 21) else g[19][x]
    # crystal clusters poking out of the rock
    def crystal(x, y, h):
        for k in range(h):
            g[y - k][x] = CRY[1] if k < h - 1 else CRY[2]
            g[y - k][x + 1] = CRY[0]
    crystal(6, 16, 4); crystal(8, 15, 3)
    crystal(24, 17, 4); crystal(26, 18, 2)
    crystal(15, 8, 4); crystal(18, 9, 3)
    # glints inside the tunnel
    g[24][15] = CRY[1]; g[26][18] = CRY[0]
    # a few loose rocks on the ground
    for (x, y) in [(4, 27), (5, 27), (27, 27), (26, 27)]:
        g[y][x] = ROCK[1]
    return outline(g)


# ------------------------------------------------------------ Honeypot
# A round clay pot brimming with honey that drips down its sides
CLAY = [(110, 52, 30), (156, 78, 40), (196, 108, 56), (228, 150, 90)]
HONEY = [(196, 120, 10), (240, 168, 24), (255, 208, 64), (255, 240, 160)]


def honeypot():
    g = blank()

    def clay(x, y, dx, dy):
        light = -dx * 0.7 - dy * 0.4
        return CLAY[0] if light < -0.55 else CLAY[1] if light < 0.05 else CLAY[2] if light < 0.5 else CLAY[3]
    # pot body
    ellipse(g, 16, 20, 11, 9, clay)
    # neck
    for y in range(9, 13):
        for x in range(10, 23):
            g[y][x] = CLAY[1] if x < 14 else CLAY[2] if x < 20 else CLAY[0]
    # rim (lip), slightly wider
    for x in range(8, 25):
        g[8][x] = CLAY[3] if 10 < x < 20 else CLAY[2]
        g[9][x] = CLAY[1]
    # honey heaped above the rim
    for y, (a, b) in zip(range(3, 8), ((14, 18), (12, 20), (11, 21), (10, 22), (9, 23))):
        for x in range(a, b + 1):
            g[y][x] = HONEY[3] if (y < 5 and x < 16) else HONEY[2] if x < 19 else HONEY[1]
    # a wooden dipper stuck in the honey
    for k in range(6):
        g[1 + k][21 + (k < 3)] = (140, 90, 44)
    g[0][22] = (176, 124, 64)
    # thick drips running down over the rim and belly, with round ends
    for x, length in [(9, 5), (13, 9), (18, 4), (22, 7)]:
        for k in range(length):
            y = 8 + k
            g[y][x] = HONEY[2] if k < length - 2 else HONEY[1]
            g[y][x + 1] = HONEY[1]
        g[8 + length][x] = HONEY[0]
        g[8 + length][x + 1] = HONEY[0]
    for x in range(9, 24):
        g[8][x] = HONEY[1] if g[8][x] not in (HONEY[2],) else g[8][x]
    # a dark band round the belly
    for x in range(6, 27):
        if g[21][x] and g[21][x] in CLAY:
            g[21][x] = CLAY[0]
    # honey puddle at the base
    for x in range(9, 24):
        if g[28][x] is None:
            g[28][x] = HONEY[1]
    for x in range(6, 10):
        g[28][x] = HONEY[0]
    return outline(g)


save(mine(), 'mine_node')
save(honeypot(), 'honeypot_node')
print('done')
