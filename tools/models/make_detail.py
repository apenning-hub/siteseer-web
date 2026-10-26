"""Rough placeholder GLB: window opening in a brick-veneer wall on a steel stud frame.

Twelve named nodes, one per layer card in Sean's Window Opening Detail, so the
site's layer panel can be built against it before the real Vectary export
exists. Geometry is boxes only. Units are metres, +Y up, +Z points outside;
the interior face of the plasterboard sits at z=0.

Run: python3 make_detail.py out.glb
"""
import math, sys

from glb import Glb

# ---- wall build-up (z, from inside to outside) -------------------------------
LINING = (0.0, 0.013)          # 13 mm plasterboard
STUD = (0.013, 0.105)          # 92 mm steel stud
CAVITY = (0.105, 0.155)        # 50 mm cavity
BRICK = (0.155, 0.265)         # 110 mm brick veneer

W0, W1 = -0.9, 0.9             # wall extent in x
H = 2.2                        # wall height
OX0, OX1 = -0.45, 0.45         # window opening in x
SILL, HEAD = 0.8, 1.7          # window opening in y


def box(x0, x1, y0, y1, z0, z1, rot_x=0.0, pivot=None):
    """Axis-aligned box as 6 faces (24 verts, 36 indices), optionally rotated about X."""
    c = [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]
    if rot_x:
        py, pz = pivot
        s, co = math.sin(rot_x), math.cos(rot_x)
        c = [(x, py + (y - py) * co - (z - pz) * s, pz + (y - py) * s + (z - pz) * co) for x, y, z in c]
    # corner index = xi*4 + yi*2 + zi
    faces = [((0, 1, 3, 2), (-1, 0, 0)), ((4, 6, 7, 5), (1, 0, 0)),
             ((0, 4, 5, 1), (0, -1, 0)), ((2, 3, 7, 6), (0, 1, 0)),
             ((0, 2, 6, 4), (0, 0, -1)), ((1, 5, 7, 3), (0, 0, 1))]
    pos, nrm, idx = [], [], []
    for quad, n in faces:
        if rot_x:
            s, co = math.sin(rot_x), math.cos(rot_x)
            n = (n[0], n[1] * co - n[2] * s, n[1] * s + n[2] * co)
        base = len(pos)
        pos += [c[i] for i in quad]
        nrm += [n] * 4
        idx += [base, base + 1, base + 2, base, base + 2, base + 3]
    return pos, nrm, idx


def bricks(x0, x1, y0, y1, z0, z1, skip=lambda x0, x1, y0, y1: False):
    """Stretcher bond: 230x76 bricks on 10 mm joints, clipped to the region."""
    out, course, y = [], 0, y0
    while y < y1 - 0.01:
        yt = min(y + 0.076, y1)
        x = x0 - (0.12 if course % 2 else 0)
        while x < x1:
            bx0, bx1 = max(x, x0), min(x + 0.23, x1)
            if bx1 - bx0 > 0.02 and not skip(bx0, bx1, y, yt):
                out.append(box(bx0, bx1, y, yt, z0, z1))
            x += 0.24
        y += 0.086
        course += 1
    return out


def in_opening(bx0, bx1, by0, by1):
    # Leave the opening, the sill zone below it and the lintel bearing above it clear.
    return bx1 > OX0 - 0.0 and bx0 < OX1 + 0.0 and by1 > SILL - 0.1 and by0 < HEAD + 0.08


LAYERS = []


def layer(key, name, rgba, parts, metal=0.0, rough=0.8, extra=()):
    LAYERS.append(dict(key=key, name=name, rgba=rgba, parts=parts, metal=metal, rough=rough, extra=list(extra)))


# 1 External brick veneer (with a cutaway notch bottom-left to expose the cavity)
notch = lambda bx0, bx1, by0, by1: in_opening(bx0, bx1, by0, by1) or (bx0 < -0.5 and by1 < 1.45) or (bx0 < -0.7 and by1 < 1.9)
brick_parts = bricks(W0, W1, 0, H, *BRICK, skip=notch)
# Mortar: one slab behind each brick course, 5 mm proud of the cavity face, filling the joints.
mortar = [box(p[0][0][0] - 0.005, p[0][4][0] + 0.005, p[0][0][1] - 0.005, p[0][3][1] + 0.005, BRICK[0] + 0.004, BRICK[1] - 0.006) for p in brick_parts]
layer('L01', 'External brick wall', (0.66, 0.27, 0.18, 1), brick_parts, extra=[('mortar', (0.74, 0.72, 0.68, 1), mortar)])

# 2 Internal steel framing: studs at 450 centres, jamb studs, plates, nogging
studs = [box(x, x + 0.035, 0.035, H - 0.035, *STUD) for x in (W0, -0.45 - 0.035, OX1, W1 - 0.035)]
plates = [box(W0, W1, 0, 0.035, *STUD), box(W0, W1, H - 0.035, H, *STUD)]
jack = [box(x, x + 0.035, 0.035, SILL - 0.045, *STUD) for x in (-0.2, 0.18)]
cripple = [box(x, x + 0.035, HEAD + 0.045, H - 0.035, *STUD) for x in (-0.2, 0.18)]
nog = [box(W0 + 0.035, OX0 - 0.035, 1.1, 1.135, *STUD), box(OX1 + 0.035, W1 - 0.035, 1.1, 1.135, *STUD)]
layer('L02', 'Internal steel framing', (0.62, 0.66, 0.70, 1), studs + plates + jack + cripple + nog, metal=0.8, rough=0.4)

# 3 Wall ties bridging the cavity, at 600 vertical x 450 horizontal
ties = [box(x - 0.012, x + 0.012, y, y + 0.003, STUD[1] - 0.01, BRICK[0] + 0.06)
        for x in (W0 + 0.02, -0.47, OX1 + 0.02, W1 - 0.02) for y in (0.43, 1.03, 1.63, 2.06)]
layer('L03', 'Wall/cavity ties', (0.85, 0.86, 0.88, 1), ties, metal=0.9, rough=0.3)

# 4 Head lintel (2 x equal angles, back to back) + cavity sill flashing
lx0, lx1 = OX0 - 0.15, OX1 + 0.15
lintel = [box(lx0, lx1, HEAD + 0.0, HEAD + 0.008, BRICK[0], BRICK[1]),       # horizontal legs
          box(lx0, lx1, HEAD + 0.0, HEAD + 0.09, BRICK[0], BRICK[0] + 0.008),  # vertical leg 1
          box(lx0, lx1, HEAD + 0.0, HEAD + 0.09, BRICK[0] + 0.008, BRICK[0] + 0.016)]
tray = [box(OX0 - 0.1, OX1 + 0.1, SILL - 0.12, SILL - 0.115, STUD[1], BRICK[1])]
layer('L04', 'Head lintel + sill flashing', (0.42, 0.45, 0.48, 1), lintel + tray, metal=0.85, rough=0.45)

# 5 Brick sill on edge, sloped ~15 degrees to shed water outward
sill = [box(x, x + 0.076, SILL - 0.11, SILL - 0.0, BRICK[0], BRICK[1] + 0.05,
            rot_x=math.radians(15), pivot=(SILL - 0.11, BRICK[0]))
        for x in [OX0 - 0.06 + i * 0.086 for i in range(12)] if x + 0.076 <= OX1 + 0.07]
layer('L05', 'Angled brickwork sill', (0.64, 0.28, 0.19, 1), sill)

# 6 Timber sill trimmer and head trimmer forming the rough opening
layer('L06', 'Timber sill and head frame', (0.85, 0.70, 0.49, 1),
      [box(OX0, OX1, SILL - 0.045, SILL, *STUD), box(OX0, OX1, HEAD, HEAD + 0.045, *STUD)])

# 7 Aluminium window frame sitting in the cavity zone
fz = (0.09, 0.16)
fw = 0.05
frame = [box(OX0 + 0.01, OX1 - 0.01, SILL + 0.01, SILL + 0.01 + fw, *fz),
         box(OX0 + 0.01, OX1 - 0.01, HEAD - 0.01 - fw, HEAD - 0.01, *fz),
         box(OX0 + 0.01, OX0 + 0.01 + fw, SILL + 0.01, HEAD - 0.01, *fz),
         box(OX1 - 0.01 - fw, OX1 - 0.01, SILL + 0.01, HEAD - 0.01, *fz)]
layer('L07', 'Window frame', (0.20, 0.21, 0.23, 1), frame, metal=0.6, rough=0.35)

# 8 Side jambs lining the reveal
layer('L08', 'Window side jamb', (0.91, 0.86, 0.76, 1),
      [box(OX0, OX0 + 0.019, SILL, HEAD, 0.0, fz[0]), box(OX1 - 0.019, OX1, SILL, HEAD, 0.0, fz[0])])

# 9 Plasterboard, cut away on the right half to show the frame
gyp = [box(W0, OX0, 0, H, *LINING), box(OX0, 0.0, 0, SILL, *LINING), box(OX0, 0.0, HEAD, H, *LINING)]
layer('L09', 'Internal plasterboard lining', (0.95, 0.95, 0.93, 1), gyp)

# 10 Sill and head reveal linings
layer('L10', 'Sill and head jamb lining', (0.93, 0.89, 0.81, 1),
      [box(OX0 + 0.019, OX1 - 0.019, SILL, SILL + 0.019, 0.0, fz[0]),
       box(OX0 + 0.019, OX1 - 0.019, HEAD - 0.019, HEAD, 0.0, fz[0])])

# 11 Glazing
layer('L11', 'Window glazing', (0.62, 0.83, 0.90, 0.35),
      [box(OX0 + 0.06, OX1 - 0.06, SILL + 0.06, HEAD - 0.06, 0.122, 0.128)], rough=0.05)

# 12 External sill flashing under the frame + internal sill trim
layer('L12', 'Sill flashing + internal trim', (0.17, 0.17, 0.18, 1),
      [box(OX0, OX1, SILL - 0.004, SILL + 0.01, fz[0], BRICK[1] + 0.03),
       box(OX0 - 0.05, OX1 + 0.05, SILL - 0.03, SILL, -0.025, 0.0)])


# ---- GLB --------------------------------------------------------------------
# Where the red + sits on each layer, on the face a visitor sees. Layers left
# out get their + at the centre of their bounding box.
PINS = {
    'L01': (0.62, 0.42, 0.266),
    'L02': (-0.88, 0.75, 0.106),
    'L03': (-0.88, 1.03, 0.2),
    'L04': (0.3, 1.704, 0.25),
    'L05': (0.15, 0.75, 0.31),
    'L07': (0.405, 1.25, 0.161),
}


# Texture and real-world tile size (metres per repeat) for each layer's material.
TEX = {
    'L01': ('clay', 0.35), 'L02': ('metal', 0.8), 'L03': ('metal', 0.5), 'L04': ('metal', 0.8),
    'L05': ('clay', 0.35), 'L06': ('wood', 0.9), 'L07': ('metal', 1.2), 'L08': ('plaster', 0.6),
    'L09': ('plaster', 1.2), 'L10': ('plaster', 0.6), 'L12': ('metal', 0.8),
}


def build(path):
    g = Glb('SiteSeer dummy detail (make_detail.py)')
    layer_nodes = []
    # Material names start with the layer key ("L04 ..."), so a viewer can map
    # every material, including secondary ones like mortar, back to its layer.
    for L in LAYERS:
        tex, tile = TEX.get(L['key'], (None, 1.0))
        prims = [g.primitive(L['parts'], g.material(f"{L['key']} {L['name']}", L['rgba'], L['metal'], L['rough'], tex, tile))]
        for sub_name, rgba, parts in L['extra']:
            prims.append(g.primitive(parts, g.material(f"{L['key']} {L['name']} ({sub_name})", rgba, 0.0, 0.9, 'plaster', 0.5)))
        mesh = g.mesh(L['name'], prims)
        name = f"{L['key']}_{L['name'].replace(' ', '_').replace('/', '_').replace('+', 'and')}"
        kw = dict(name=name, mesh=mesh, extras=dict(layer=int(L['key'][1:]), title=L['name']))
        # Optional marker point for the red + on this layer. The layer node has
        # no transform, so the child's translation is a world position.
        if L['key'] in PINS:
            kw['children'] = [g.node(name=f"{L['key']}_pin", translation=list(PINS[L['key']]))]
        layer_nodes.append(g.node(**kw))
    return g.write(path, g.node(name='WindowOpeningDetail', children=layer_nodes))


if __name__ == '__main__':
    n = build(sys.argv[1])
    print(f'{sys.argv[1]}: {n / 1024:.0f} KB, {len(LAYERS)} layers')
    for L in LAYERS:
        print(f"  {L['key']}  {L['name']:<32} {len(L['parts']):>4} parts")
