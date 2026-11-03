"""Pixel-art "YOUR TURN!" title made of twisted bark with leaf sprigs, to sit
inside the branch frame (gen/vine_frame.py). Usage: python3 gen/your_turn_text.py [out_path]"""
import sys
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/sprites/ui/your_turn.png'
OUTLINE = (34, 22, 14)
BARK = [(74, 44, 22), (112, 70, 34), (150, 100, 52), (190, 140, 80), (222, 182, 120)]
LEAF = [(30, 78, 30), (52, 124, 40), (96, 168, 60), (150, 206, 96)]

FONT = {
    'Y': ["X...X", "X...X", ".X.X.", "..X..", "..X..", "..X..", "..X.."],
    'O': [".XXX.", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
    'U': ["X...X", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
    'R': ["XXXX.", "X...X", "X...X", "XXXX.", "X.X..", "X..X.", "X...X"],
    'T': ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."],
    'N': ["X...X", "XX..X", "X.X.X", "X..XX", "X...X", "X...X", "X...X"],
    '!': ["X", "X", "X", "X", "X", ".", "X"],
    ' ': ["..", "..", "..", "..", "..", "..", ".."],
}
C = 4          # pixels per font cell
PAD = 8        # room for outline and leaves
TEXT = 'YOUR TURN!'

cells = []     # (cx, cy) in font cells
x = 0
for ch in TEXT:
    rows = FONT[ch]
    for cy, row in enumerate(rows):
        for cx, v in enumerate(row):
            if v == 'X':
                cells.append((x + cx, cy))
    x += len(rows[0]) + 1
W = x * C + PAD * 2
H = 7 * C + PAD * 2

g = {}
for cx, cy in cells:
    for dy in range(C):
        for dx in range(C):
            px, py = PAD + cx * C + dx, PAD + cy * C + dy
            # bark: lit from the top-left, with a slanted twist groove every 4px
            t = (px + py) % 8
            if t == 0:
                c = BARK[1]
            elif t == 1:
                c = BARK[4] if dy <= 1 else BARK[3]
            else:
                c = BARK[4] if dy == 0 else BARK[3] if dy == 1 else BARK[2] if dy == 2 else BARK[1]
            g[(px, py)] = c

# leaf sprigs on the tops of some letters
def leaf(px, py, flip):
    for dx, dy, s in [(0, 0, 1), (0, -1, 1), (1, -1, 2), (2, -1, 2), (3, -1, 1), (1, -2, 3), (2, -2, 3), (3, -2, 2),
                      (4, -2, 1), (2, -3, 2), (3, -3, 2), (4, -3, 2), (5, -3, 1), (4, -4, 1)]:
        g.setdefault((px + (-dx if flip else dx), py + dy), LEAF[s])

filled = set(g)
for (px, py) in list(filled):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1)):
        q = (px + dx, py + dy)
        if q not in filled:
            g[q] = OUTLINE

im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for (px, py), c in g.items():
    if 0 <= px < W and 0 <= py < H:
        im.putpixel((px, py), c + (255,))
im.save(OUT)
print(W, H)
