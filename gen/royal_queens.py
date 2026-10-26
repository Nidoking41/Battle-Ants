"""Brood Queen and Swarm Queen sprite sheets (48px frames, 8 frames, 5 colours).

Built on top of the base queen sheet (public/sprites/ants/Queen/queen_idle_<c>.png,
32px frames) so the body, legs and idle bob match exactly. Each tier adds:
  Brood Queen: second pair of wings, longer abdomen with gold royal bands, gold crown
  Swarm Queen: all of that, bigger still, a tall jewelled crown, back spines,
               glowing gold eyes and drifting gold motes
Usage: python3 gen/royal_queens.py [out_dir]
"""
import sys, os
from PIL import Image

SRC = 'public/sprites/ants/Queen'
OUT = sys.argv[1] if len(sys.argv) > 1 else SRC
COLORS = ['red', 'blue', 'green', 'yellow', 'black']
F, N = 48, 8          # new frame size, frame count
OX, OY = 8, 8         # base frame centred in the 48px frame (same spot on the hex)

# Red sheet palette roles (other colours are mapped pixel-by-pixel to these)
RED_ROLES = {
    (24, 16, 32): 'outline', (255, 216, 168): 'wing', (255, 255, 255): 'wingHi',
    (216, 56, 40): 'light', (176, 40, 40): 'mid', (136, 28, 40): 'dark',
    (88, 16, 40): 'darkest', (248, 120, 64): 'hi',
}
GOLD = {'outline': (60, 36, 12), 'dark': (176, 112, 24), 'mid': (232, 176, 48), 'light': (255, 224, 104), 'hi': (255, 248, 200)}
GEM_R, GEM_B, GEM_G = (224, 40, 72), (72, 160, 255), (80, 220, 120)


def palette_for(color):
    """Role -> RGB for a colour sheet, by matching pixels with the red sheet."""
    red = Image.open(f'{SRC}/queen_idle_red.png').convert('RGBA')
    other = Image.open(f'{SRC}/queen_idle_{color}.png').convert('RGBA')
    votes = {}
    for x in range(red.width):
        for y in range(red.height):
            a, b = red.getpixel((x, y)), other.getpixel((x, y))
            if a[3] and b[3] and a[:3] in RED_ROLES:
                votes.setdefault(RED_ROLES[a[:3]], {}).setdefault(b[:3], 0)
                votes[RED_ROLES[a[:3]]][b[:3]] += 1
    return {role: max(v, key=v.get) for role, v in votes.items()}


def put(img, x, y, c):
    if 0 <= x < F and 0 <= y < F:
        img.putpixel((x, y), c + (255,) if len(c) == 3 else c)


def under(img, x, y, c):
    """Paint only where the frame is still empty (keeps the base on top)."""
    if 0 <= x < F and 0 <= y < F and img.getpixel((x, y))[3] == 0:
        put(img, x, y, c)


def head_top(base):
    """Top row of the head (first row with 4+ solid pixels in the head columns)."""
    for y in range(6, 16):
        run = best = 0
        for x in range(19, 30):
            run = run + 1 if base.getpixel((x, y))[3] else 0
            best = max(best, run)
        if best >= 4:
            xs = [x for x in range(19, 30) if base.getpixel((x, y))[3]]
            return y, min(xs), max(xs)
    return 9, 21, 26


def abdomen_bulge(img, pal, cx, cy, rx, ry, bands):
    """Extra abdomen drawn behind the base body: shaded ellipse with segments."""
    pts = set()
    for y in range(cy - ry - 1, cy + ry + 2):
        for x in range(cx - rx - 1, cx + rx + 2):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                pts.add((x, y))
    for (x, y) in pts:
        edge = any((x + dx, y + dy) not in pts for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge:
            c = pal['outline']
        else:
            t = (y - (cy - ry)) / (2 * ry)
            c = pal['light'] if t < 0.3 else pal['mid'] if t < 0.62 else pal['dark'] if t < 0.85 else pal['darkest']
            if t < 0.3 and (x + y) % 4 == 0:
                c = pal['hi']
            if (x - cx) in bands and t >= 0.25:
                c = GOLD['dark'] if t > 0.6 else GOLD['mid']
        under(img, x + OX, y + OY, c)


def extra_wings(img, base, dx, dy, tint):
    """A second pair of wings: the base wings copied behind, shifted and tinted."""
    for x in range(0, 18):
        for y in range(0, 12):
            p = base.getpixel((x, y))
            if not p[3]:
                continue
            role = None
            # wing pixels and their outline (outline only inside the wing box)
            if p[:3] in tint:
                role = p[:3]
            elif y <= 8 or x <= 3:
                role = 'outline'
            if role is None:
                continue
            c = tint.get(role, tint['outline'])
            under(img, x + OX + dx, y + OY + dy, c)


def crown(img, top, x0, w, tall, gems):
    """Gold crown sitting on the head. `tall`: point height, gems: list of colours."""
    cx0 = OX + x0
    y_base = OY + top - 1         # band row just above the head
    # band (2 rows) with outline
    for x in range(cx0 - 1, cx0 + w + 1):
        put(img, x, y_base + 1, GOLD['outline'])
        put(img, x, y_base - 2, GOLD['outline'])
    for x in range(cx0, cx0 + w):
        put(img, x, y_base, GOLD['dark'])
        put(img, x, y_base - 1, GOLD['mid'])
    put(img, cx0 - 1, y_base, GOLD['outline']); put(img, cx0 - 1, y_base - 1, GOLD['outline'])
    put(img, cx0 + w, y_base, GOLD['outline']); put(img, cx0 + w, y_base - 1, GOLD['outline'])
    # points: every other column, starting at both ends
    cols = list(range(cx0, cx0 + w, 2))
    if cols[-1] != cx0 + w - 1:
        cols.append(cx0 + w - 1)
    for i, x in enumerate(cols):
        mid = (len(cols) - 1) / 2
        h = tall + (1 if tall > 2 and abs(i - mid) < 0.6 else 0) - (1 if tall > 2 and i in (0, len(cols) - 1) else 0)
        for k in range(1, h + 1):
            put(img, x, y_base - 1 - k, GOLD['light'] if k < h else GOLD['hi'])
            under(img, x - 1, y_base - 1 - k, GOLD['outline'])
            under(img, x + 1, y_base - 1 - k, GOLD['outline'])
        put(img, x, y_base - 2 - h, GOLD['outline'])
    # gems on the band
    if gems:
        step = max(1, w // (len(gems) + 1))
        for i, g in enumerate(gems):
            put(img, cx0 + step * (i + 1) - (1 if len(gems) == 1 else 0), y_base, g)


def back_spines(img, base, pal):
    """Three small spikes along the thorax ridge."""
    for sx in (15, 17, 19):
        top = next((y for y in range(6, 20) if base.getpixel((sx, y))[3]), None)
        if top is None:
            continue
        put(img, sx + OX, top + OY - 1, pal['dark'])
        put(img, sx + OX, top + OY - 2, pal['outline'])
        under(img, sx + OX - 1, top + OY - 1, pal['outline'])
        under(img, sx + OX + 1, top + OY - 1, pal['outline'])


def golden_bands(img, pal):
    """The base abdomen's darkest segment lines become gold royal bands."""
    for x in range(OX + 2, OX + 15):
        for y in range(OY + 12, OY + 22):
            p = img.getpixel((x, y))
            if p[3] and p[:3] == pal['darkest']:
                put(img, x, y, GOLD['dark'])


def glowing_eyes(img, base, pal):
    for x in range(20, 30):
        for y in range(8, 16):
            p = base.getpixel((x, y))
            if p[3] and p[:3] == (255, 255, 255):
                put(img, x + OX, y + OY, GOLD['hi'])
                under(img, x + OX + 1, y + OY, GOLD['light'])


MOTES = [(4, 30), (9, 8), (40, 20), (44, 34), (2, 18), (30, 4), (38, 42), (6, 40)]


def motes(img, i):
    """Gold motes that drift up a pixel a frame and blink."""
    for k, (mx, my) in enumerate(MOTES):
        phase = (i + k * 3) % N
        y = my - phase // 2
        if phase in (0, 7):
            continue
        c = GOLD['hi'] if phase in (3, 4) else GOLD['light']
        under(img, mx, y, c)
        if phase in (3, 4):
            under(img, mx - 1, y, GOLD['mid']); under(img, mx + 1, y, GOLD['mid'])
            under(img, mx, y - 1, GOLD['mid']); under(img, mx, y + 1, GOLD['mid'])


def build(color, tier):
    pal = palette_for(color)
    sheet = Image.open(f'{SRC}/queen_idle_{color}.png').convert('RGBA')
    out = Image.new('RGBA', (F * N, F), (0, 0, 0, 0))
    wing = pal.get('wing', (255, 216, 168)); wing_hi = pal.get('wingHi', (255, 255, 255))
    shade = lambda c, k: tuple(int(v * k) for v in c)
    back_wing = {wing: shade(wing, 0.86), wing_hi: shade(wing_hi, 0.92), 'outline': pal['outline']}
    for i in range(N):
        base = sheet.crop((i * 32, 0, i * 32 + 32, 32))
        img = Image.new('RGBA', (F, F), (0, 0, 0, 0))
        img.alpha_composite(base, (OX, OY))
        top, hx0, hx1 = head_top(base)
        if tier == 'brood':
            extra_wings(img, base, -4, -3, back_wing)
            abdomen_bulge(img, pal, 5, 16, 7, 6, bands=(-3, 1))
            golden_bands(img, pal)
            crown(img, top, hx0, 5, 2, [GEM_R])
        else:
            extra_wings(img, base, -8, -5, {wing: (214, 190, 240), wing_hi: (245, 235, 255), 'outline': pal['outline']})
            extra_wings(img, base, -4, -3, back_wing)
            abdomen_bulge(img, pal, 4, 17, 9, 7, bands=(-5, -1, 3))
            golden_bands(img, pal)
            back_spines(img, base, pal)
            crown(img, top, hx0 - 1, 7, 3, [GEM_B, GEM_R, GEM_G])
            glowing_eyes(img, base, pal)
            motes(img, i)
        out.alpha_composite(img, (i * F, 0))
    return out


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for tier, prefix in (('brood', 'broodqueen'), ('swarm', 'swarmqueen')):
        for c in COLORS:
            build(c, tier).save(f'{OUT}/{prefix}_idle_{c}.png')
    print('done')
