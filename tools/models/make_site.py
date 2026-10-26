"""Rough placeholder GLB: a messy building site for the window detail to sit on.

Same coordinate frame as make_detail.py (metres, +Y up, +Z outside, the
detail's wall on x -0.9..0.9, z 0..0.265), so the two files line up with no
transform. One node per prop group, named S_<thing>, so the hero can bring the
site in piece by piece. Geometry is boxes, cylinders and heightfields only.

Run: python3 make_site.py out.glb
"""
import math, random, sys
from pathlib import Path

from glb import Glb, chamfer_box
from PIL import Image
from make_detail import box

random.seed(7)


# ---- geometry helpers ---------------------------------------------------------
def xform(part, rx=0.0, ry=0.0, rz=0.0, t=(0.0, 0.0, 0.0)):
    """Rotate about Z, then X, then Y (radians), then translate."""
    def rot(v):
        x, y, z = v
        c, s = math.cos(rz), math.sin(rz); x, y = x * c - y * s, x * s + y * c
        c, s = math.cos(rx), math.sin(rx); y, z = y * c - z * s, y * s + z * c
        c, s = math.cos(ry), math.sin(ry); x, z = x * c + z * s, -x * s + z * c
        return (x, y, z)
    pos, nrm, idx = part
    return ([tuple(a + b for a, b in zip(rot(p), t)) for p in pos], [rot(n) for n in nrm], idx)


def tris(triangles):
    """Flat-shaded triangles, each given counter-clockwise as seen from outside."""
    pos, nrm, idx = [], [], []
    for a, b, c in triangles:
        u = [b[i] - a[i] for i in range(3)]
        v = [c[i] - a[i] for i in range(3)]
        n = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
        ln = math.sqrt(sum(k * k for k in n)) or 1.0
        base = len(pos)
        pos += [a, b, c]
        nrm += [tuple(k / ln for k in n)] * 3
        idx += [base, base + 1, base + 2]
    return pos, nrm, idx


def heightfield(h, x0, x1, z0, z1, n, keep=lambda x, z: True):
    out = []
    dx, dz = (x1 - x0) / n, (z1 - z0) / n
    for i in range(n):
        for j in range(n):
            xa, xb, za, zb = x0 + i * dx, x0 + (i + 1) * dx, z0 + j * dz, z0 + (j + 1) * dz
            if not keep((xa + xb) / 2, (za + zb) / 2):
                continue
            p = lambda x, z: (x, h(x, z), z)
            out.append((p(xa, za), p(xa, zb), p(xb, za)))
            out.append((p(xb, za), p(xa, zb), p(xb, zb)))
    return tris(out)


def radial_field(h, cx, cz, rad, rings, segs, power=1.0):
    """Heightfield on a polar grid, so the outer edge is a clean circle. power > 1
    packs the rings towards the centre, for a big ground that is detailed close in."""
    ring = lambda i: rad * (i / rings) ** power
    pt = lambda i, k: (cx + ring(i) * math.sin(2 * math.pi * k / segs), 0,
                       cz + ring(i) * math.cos(2 * math.pi * k / segs))
    up = lambda q: (q[0], h(q[0], q[2]), q[2])
    out = []
    for i in range(rings):
        for k in range(segs):
            a, b, c, d = pt(i, k), pt(i, k + 1), pt(i + 1, k), pt(i + 1, k + 1)
            out.append((up(a), up(c), up(b)))
            if i:
                out.append((up(b), up(c), up(d)))
            else:
                out[-1] = (up(a), up(c), up(d))
    return tris(out)


def cylinder(r0, r1, height, n=18, caps=True):
    """Along +Y from y=0. r1=0 makes a cone."""
    out = []
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        b0 = (r0 * math.sin(a0), 0, r0 * math.cos(a0)); b1 = (r0 * math.sin(a1), 0, r0 * math.cos(a1))
        t0 = (r1 * math.sin(a0), height, r1 * math.cos(a0)); t1 = (r1 * math.sin(a1), height, r1 * math.cos(a1))
        out.append((b0, b1, t1))
        if r1 > 0:
            out.append((b0, t1, t0))
            if caps:
                out.append(((0, height, 0), t0, t1))
        else:
            out[-1] = (b0, b1, (0, height, 0))
        if caps:
            out.append(((0, 0, 0), b1, b0))
    return tris(out)


# ---- displacement, baked into the geometry --------------------------------------
# The displacement maps are sampled here, offline, and moved into the vertices.
# The browser gets the relief as ordinary geometry (meshopt-compressed) and
# never downloads or runs a displacement map.
_TEX = Path(__file__).parent / 'textures'
class _Disp:
    def __init__(self, name, tile, amp):
        im = Image.open(_TEX / f'{name}_disp.png').convert('L')
        self.w, self.h, self.px = im.width, im.height, im.load()
        self.tile, self.amp = tile, amp
    def __call__(self, x, z):
        # Bilinear, tiling, in the same world-space frame as the texture UVs.
        u = (x / self.tile) % 1 * self.w; v = (-z / self.tile) % 1 * self.h
        x0, y0 = int(u) % self.w, int(v) % self.h
        x1, y1 = (x0 + 1) % self.w, (y0 + 1) % self.h
        fx, fy = u - int(u), v - int(v)
        p = self.px
        top = p[x0, y0] * (1 - fx) + p[x1, y0] * fx
        bot = p[x0, y1] * (1 - fx) + p[x1, y1] * fx
        return ((top * (1 - fy) + bot * fy) / 255 - 0.5) * self.amp

MUD = _Disp('mud', 5.0, 0.07)
SAND = _Disp('sand', 1.4, 0.03)
SLAB = (-3.6, 3.0, -3.0, 0.9)   # x0, x1, z0, z1 of the slab


def _rut(x, z):
    """Two tyre ruts curving in from the gate past the stacks: 4 cm deep."""
    cx = 1.2 + 0.18 * z + 0.06 * z * z           # track centre line
    d = 0.0
    for off in (-0.55, 0.55):
        t = (x - (cx + off)) / 0.12
        d -= 0.04 * math.exp(-t * t)
    return d if 0.9 < z < 7.0 else d * max(0.0, 1 - abs(z - 3.9) / 3.1) if z <= 0.9 else d * max(0.0, (7.5 - z) / 0.5)


def ground_y(x, z):
    base = -0.12 + 0.03 * math.sin(1.7 * x + 0.3) * math.cos(1.3 * z) + 0.015 * math.sin(5.1 * x + 2 * z)
    # Relief fades out under the slab, so the ground never pokes through it.
    dx = max(SLAB[0] - x, 0.0, x - SLAB[1]); dz = max(SLAB[2] - z, 0.0, z - SLAB[3])
    near = min(1.0, math.hypot(dx, dz) / 0.6)
    far = max(0.0, 1 - math.hypot(x, z) / 14)    # flatter towards the fogged horizon
    return base + near * far * (MUD(x, z) + _rut(x, z))


def smooth_radial(h, cx, cz, rad, rings, segs, power=1.0):
    """Heightfield on a polar grid with shared vertices and smooth normals, so a
    dense displaced surface costs one vertex per grid point, not three per triangle."""
    ring = lambda i: rad * (i / rings) ** power
    pos, nrm, idx = [], [], []
    e = 0.01
    def add(x, z):
        y = h(x, z)
        nx, nz = h(x - e, z) - h(x + e, z), h(x, z - e) - h(x, z + e)
        ln = math.sqrt(nx * nx + 4 * e * e + nz * nz)
        pos.append((x, y, z)); nrm.append((nx / ln, 2 * e / ln, nz / ln))
    add(cx, cz)
    for i in range(1, rings + 1):
        r = ring(i)
        for k in range(segs):
            a = 2 * math.pi * k / segs
            add(cx + r * math.sin(a), cz + r * math.cos(a))
    vid = lambda i, k: 0 if i == 0 else 1 + (i - 1) * segs + k % segs
    for k in range(segs):  # centre fan
        idx += [vid(0, 0), vid(1, k), vid(1, k + 1)]
    for i in range(1, rings):
        for k in range(segs):
            a, b, c, d = vid(i, k), vid(i, k + 1), vid(i + 1, k), vid(i + 1, k + 1)
            idx += [a, c, b, b, c, d]
    # Wind every triangle to face up.
    for t in range(0, len(idx), 3):
        a, b, c = (pos[j] for j in idx[t:t + 3])
        if (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]) > 0:
            idx[t + 1], idx[t + 2] = idx[t + 2], idx[t + 1]
    return pos, nrm, idx


# ---- the site -------------------------------------------------------------------
GROUPS = []  # (key, [(material, [parts])])


def group(key, *prims):
    GROUPS.append((key, list(prims)))


MAT = {
    'dirt': ((0.9, 0.86, 0.82, 1), 0.0, 0.95, 'mud', 2.5),
    'concrete': ((0.95, 0.95, 0.95, 1), 0.0, 0.85, 'concrete', 2.0),
    'steel': ((0.62, 0.66, 0.70, 1), 0.8, 0.4, 'metal', 0.8),
    'pine': ((1, 0.95, 0.88, 1), 0.0, 0.75, 'wood', 1.0),
    'pallet': ((0.72, 0.6, 0.5, 1), 0.0, 0.85, 'wood', 0.8),
    'brick': ((0.66, 0.27, 0.18, 1), 0.0, 0.85, 'clay', 0.35),
    'sand': ((1, 0.94, 0.85, 1), 0.0, 1.0, 'sand', 1.2),
    'bag': ((0.85, 0.80, 0.70, 1), 0.0, 0.9, 'plaster', 0.5),
    'orange': ((0.95, 0.40, 0.08, 1), 0.0, 0.6),
    'barrow': ((0.16, 0.40, 0.28, 1), 0.3, 0.5, 'metal', 0.6),
    'rubber': ((0.07, 0.07, 0.07, 1), 0.0, 0.9),
    'galv': ((0.72, 0.74, 0.76, 1), 0.8, 0.35, 'metal', 0.6),
    'mesh': ((0.55, 0.57, 0.60, 0.3), 0.6, 0.5),
    'skip': ((0.93, 0.72, 0.10, 1), 0.2, 0.55, 'metal', 1.0),
    'mortar': ((0.6, 0.6, 0.58, 1), 0.0, 1.0, 'concrete', 0.6),
}

# Ground: a round dirt pad, and the slab the wall stands on.
# Far bigger than any camera view, so its edge is never on screen; the hero
# fogs the distance into the background red.
R = 60.0
group('ground', ('dirt', [smooth_radial(ground_y, 0.0, 0.0, R, 90, 200, power=2.4)]))
group('slab', ('concrete', [chamfer_box(-3.6, 3.0, -0.14, 0.0, -3.0, 0.9, 0.012)]))

# The stud frame carries on past the finished detail, so the build is mid-way.
frame = []
for x in (-1.5, -2.1, -2.7, -3.3, 1.5, 2.1, 2.7):
    frame.append(box(x - 0.02, x + 0.02, 0.04, 2.16, 0.013, 0.105))
for x0, x1 in ((-3.4, -0.9), (0.9, 2.9)):
    frame += [box(x0, x1, 0.0, 0.04, 0.013, 0.105), box(x0, x1, 2.16, 2.2, 0.013, 0.105)]
frame.append(box(-3.4, -0.9, 1.08, 1.12, 0.013, 0.105))  # nogging
group('frame', ('steel', frame))


def pallet(cx, cz, ry=0.0, w=1.1, d=1.1):
    parts = []
    for k in range(3):
        z = -d / 2 + 0.05 + k * (d - 0.1) / 2
        parts.append(chamfer_box(-w / 2, w / 2, 0.0, 0.1, z - 0.05, z + 0.05, 0.006))
    for k in range(6):
        x = -w / 2 + 0.07 + k * (w - 0.14) / 5
        parts.append(chamfer_box(x - 0.07, x + 0.07, 0.1, 0.12, -d / 2, d / 2, 0.003))
    return [xform(p, ry=ry, t=(cx, ground_y(cx, cz), cz)) for p in parts]


def brick_stack(cx, cz, ry, courses, top_rows=None):
    parts = []
    for c in range(courses):
        rows = top_rows if (top_rows and c == courses - 1) else 9
        for i in range(4):
            for j in range(rows):
                x0, z0, y0 = -0.48 + i * 0.24, -0.5 + j * 0.115, 0.12 + c * 0.086
                # Only bricks on the outside of the stack can be seen.
                if 0 < i < 3 and 0 < j < rows - 1 and c < courses - 1:
                    continue
                parts.append(chamfer_box(x0, x0 + 0.23, y0, y0 + 0.076, z0, z0 + 0.11, 0.004))
    return [xform(p, ry=ry, t=(cx, ground_y(cx, cz), cz)) for p in parts]


group('bricks_full', ('pallet', pallet(2.0, 1.9, 0.1)), ('brick', brick_stack(2.0, 1.9, 0.1, 6)))
group('bricks_used', ('pallet', pallet(3.4, 0.6, 0.4)), ('brick', brick_stack(3.4, 0.6, 0.4, 3, top_rows=4)))

# Timber stack on spacer battens, plus offcuts and loose bricks kicked around.
timber = []
for layer in range(4):
    y = 0.05 + layer * 0.1
    for k in range(8):
        z = -0.4 + k * 0.11
        timber.append(chamfer_box(-1.8, 1.8 - 0.25 * (k % 3 == 2 and layer == 3), y, y + 0.045, z, z + 0.09, 0.004))
    for x in (-1.4, 0.0, 1.4):
        timber.append(box(x - 0.03, x + 0.03, y - 0.05, y, -0.45, 0.5))
timber = [xform(p, ry=0.14, t=(-0.6, ground_y(-0.6, 2.7), 2.7)) for p in timber]
offcuts, loose = [], []
for _ in range(16):
    x, z, ln = random.uniform(-1.5, 4.0), random.uniform(0.9, 3.8), random.uniform(0.2, 0.7)
    offcuts.append(xform(chamfer_box(-ln / 2, ln / 2, 0, 0.045, -0.045, 0.045, 0.004), ry=random.uniform(0, math.pi), t=(x, ground_y(x, z), z)))
for _ in range(12):
    x, z = random.uniform(-0.5, 3.6), random.uniform(0.95, 3.4)
    loose.append(xform(chamfer_box(-0.115, 0.115, 0, 0.076, -0.055, 0.055, 0.004), ry=random.uniform(0, math.pi),
                       rz=random.choice((0, 0, math.pi / 2)), t=(x, ground_y(x, z), z)))
group('timber', ('pine', timber + offcuts))
group('loose_bricks', ('brick', loose))

# Sand pile and a pallet of cement bags.
def mound(cx, cz, rad, ht):
    def h(x, z):
        d = math.hypot(x - cx, z - cz) / rad
        return ground_y(x, z) + ht * max(0.0, 1 - d * d) ** 1.3 + max(0.0, 1 - d) * SAND(x, z)
    return smooth_radial(h, cx, cz, rad, 26, 96)


group('sand', ('sand', [mound(4.3, -1.1, 1.15, 0.6)]))
bags = []
for layer in range(2):
    for k in range(3):
        bags.append(chamfer_box(-0.5 + k * 0.34, -0.5 + k * 0.34 + 0.32, 0.12 + layer * 0.13, 0.24 + layer * 0.13, -0.3, 0.3, 0.035))
group('cement', ('pallet', pallet(4.0, 2.6, -0.3, 1.1, 0.8)),
      ('bag', [xform(p, ry=-0.3 + (0.15 if i >= 3 else 0), t=(4.0, ground_y(4.0, 2.6), 2.6)) for i, p in enumerate(bags)]))

# Wheelbarrow, mortar tub, cones and a ladder against the frame.
bx, bz, bry = 1.1, 3.1, -0.45
at = lambda p: xform(p, ry=bry, t=(bx, ground_y(bx, bz), bz))
barrow = [box(-0.32, 0.32, 0.38, 0.62, -0.42, 0.32), box(-0.25, 0.25, 0.3, 0.38, -0.32, 0.22)]
handles = [box(x - 0.02, x + 0.02, 0.5, 0.54, 0.3, 1.05) for x in (-0.24, 0.24)]
legs = [box(x - 0.02, x + 0.02, 0.0, 0.38, 0.25, 0.29) for x in (-0.2, 0.2)]
wheel = [xform(cylinder(0.19, 0.19, 0.08), rz=math.pi / 2, t=(0.04, 0.19, -0.5))]
group('wheelbarrow', ('barrow', [at(p) for p in barrow]), ('galv', [at(p) for p in handles + legs]), ('rubber', [at(p) for p in wheel]))
tub = (0.6, 1.0)
group('mortar_tub', ('rubber', [xform(cylinder(0.3, 0.34, 0.24), t=(tub[0], ground_y(*tub), tub[1]))]),
      ('mortar', [xform(cylinder(0.31, 0.31, 0.01), t=(tub[0], ground_y(*tub) + 0.2, tub[1]))]))
cones = []
for cx, cz in ((-0.4, 3.9), (2.7, 4.1), (5.0, 1.0)):
    y = ground_y(cx, cz)
    cones += [xform(box(-0.18, 0.18, 0, 0.03, -0.18, 0.18), t=(cx, y, cz)), xform(cylinder(0.13, 0.02, 0.5, 14), t=(cx, y + 0.03, cz))]
group('cones', ('orange', cones))
lean = -math.asin(0.78 / 2.3)
ladder = [box(x - 0.025, x + 0.025, 0.0, 2.3, 0.92, 0.97, rot_x=lean, pivot=(0.0, 0.95)) for x in (2.2, 2.6)]
ladder += [box(2.2, 2.6, y, y + 0.03, 0.93, 0.96, rot_x=lean, pivot=(0.0, 0.95)) for y in [0.25 + 0.28 * k for k in range(8)]]
group('ladder', ('galv', ladder))

# Skip bin with rubble, and temporary fencing round the back and side.
sx, sz = 4.4, -3.6
skip = [box(-1.0, 1.0, 0.0, 0.08, -0.6, 0.6), box(-1.0, 1.0, 0.08, 1.0, -0.6, -0.54), box(-1.0, 1.0, 0.08, 1.0, 0.54, 0.6),
        box(-1.0, -0.94, 0.08, 1.0, -0.6, 0.6), box(0.94, 1.0, 0.08, 1.0, -0.6, 0.6)]
rubble = [xform(box(-0.2, 0.2, 0, 0.12, -0.15, 0.15), ry=random.uniform(0, 3), rz=random.uniform(-0.4, 0.4),
                t=(random.uniform(-0.7, 0.7), random.uniform(0.3, 0.75), random.uniform(-0.35, 0.35))) for _ in range(14)]
group('skip', ('skip', [xform(p, ry=0.2, t=(sx, ground_y(sx, sz), sz)) for p in skip]),
      ('concrete', [xform(p, ry=0.2, t=(sx, ground_y(sx, sz), sz)) for p in rubble]))
posts, panels, feet = [], [], []
runs = [((-2.2, -4.6), (6.2, -4.6)), ((6.2, -4.6), (6.2, 4.2))]
for (x0, z0), (x1, z1) in runs:
    ln = math.hypot(x1 - x0, z1 - z0)
    ry = -math.atan2(z1 - z0, x1 - x0)
    for k in range(int(ln / 2.4)):
        t = (x0 + (x1 - x0) * k * 2.4 / ln, ground_y(x0, z0), z0 + (z1 - z0) * k * 2.4 / ln)
        posts += [xform(box(a - 0.02, a + 0.02, 0.1, 1.9, -0.02, 0.02), ry=ry, t=t) for a in (0.02, 2.38)]
        posts += [xform(box(0.0, 2.4, y, y + 0.03, -0.02, 0.02), ry=ry, t=t) for y in (0.12, 1.87)]
        panels.append(xform(box(0.04, 2.36, 0.15, 1.87, -0.004, 0.004), ry=ry, t=t))
        feet.append(xform(box(-0.3, 0.3, 0.0, 0.12, -0.1, 0.1), ry=ry, t=t))
group('fence', ('galv', posts), ('mesh', panels), ('orange', feet))


# ---- writer ---------------------------------------------------------------------
def build(path):
    g = Glb('SiteSeer dummy site (make_site.py)')
    mats = {}
    for key, (rgba, metal, rough, *tex) in MAT.items():
        mats[key] = g.material(f'S {key}', rgba, metal, rough, *tex)
    children = [g.node(name=f'S_{key}', mesh=g.mesh(key, [g.primitive(parts, mats[mk]) for mk, parts in prims]))
                for key, prims in GROUPS]
    return g.write(path, g.node(name='BuildingSite', children=children))


if __name__ == '__main__':
    n = build(sys.argv[1])
    tri = sum(len(i) // 3 for _, prims in GROUPS for _, parts in prims for _, _, i in parts)
    print(f'{sys.argv[1]}: {n / 1024:.0f} KB, {len(GROUPS)} groups, {tri} triangles')
