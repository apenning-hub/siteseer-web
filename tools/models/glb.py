"""Minimal glTF 2.0 binary writer shared by the dummy detail and site generators.

Texture coordinates are projected in world space from each face's normal, so a
texture tiles at real-world scale (`tile` metres per repeat) with no unwrapping.
Textures come from textures/<name>_diff.jpg and textures/<name>_nor.jpg.
"""
import json, math, struct
from pathlib import Path

TEXTURES = Path(__file__).parent / 'textures'


# World-space UVs run well outside [0,1] (they tile), which stops them being
# quantised to 16 bits. They are stored remapped into [0,1] over a fixed span
# of UV_SPAN tiles, and every texture carries a KHR_texture_transform that
# undoes the remap, so the tiling is unchanged and the UVs compress.
UV_SPAN = 64.0


def planar_uv(p, n, tile):
    ax = max(range(3), key=lambda k: abs(n[k]))
    u, v = {0: (p[2], p[1]), 1: (p[0], p[2]), 2: (p[0], p[1])}[ax]
    u, v = u / tile, -v / tile
    assert abs(u) < UV_SPAN / 2 and abs(v) < UV_SPAN / 2, 'UV outside the remap span'
    return (u / UV_SPAN + 0.5, v / UV_SPAN + 0.5)


def _tex_info(index, **extra):
    return dict(index=index, **extra, extensions={'KHR_texture_transform': {'offset': [-UV_SPAN / 2, -UV_SPAN / 2], 'scale': [UV_SPAN, UV_SPAN]}})


class Glb:
    def __init__(self, generator):
        self.generator = generator
        self.bins, self.views, self.accessors = [], [], []
        self.meshes, self.nodes, self.materials = [], [], []
        self.images, self.textures, self.tiles = [], [], []
        self.offset = 0
        self._tex = {}

    def _view(self, data, target=None):
        pad = (-len(data)) % 4
        self.bins.append(data + b'\0' * pad)
        view = dict(buffer=0, byteOffset=self.offset, byteLength=len(data))
        if target:
            view['target'] = target
        self.views.append(view)
        self.offset += len(data) + pad
        return len(self.views) - 1

    def _texture(self, file):
        if file not in self._tex:
            self.images.append(dict(bufferView=self._view((TEXTURES / file).read_bytes()), mimeType='image/jpeg'))
            self.textures.append(dict(source=len(self.images) - 1, sampler=0))
            self._tex[file] = len(self.textures) - 1
        return self._tex[file]

    def material(self, name, rgba, metal, rough, tex=None, tile=1.0):
        m = dict(name=name, pbrMetallicRoughness=dict(baseColorFactor=list(rgba), metallicFactor=metal, roughnessFactor=rough))
        if rgba[3] < 1:
            m.update(alphaMode='BLEND', doubleSided=True)
        if tex:
            m['pbrMetallicRoughness']['baseColorTexture'] = _tex_info(self._texture(f'{tex}_diff.jpg'))
            m['normalTexture'] = _tex_info(self._texture(f'{tex}_nor.jpg'))
            # ARM: ambient occlusion (R), roughness (G), metalness (B), which is
            # glTF's own occlusion + metallicRoughness layout, so one file serves both.
            if (TEXTURES / f'{tex}_arm.jpg').exists():
                arm = self._texture(f'{tex}_arm.jpg')
                m['occlusionTexture'] = _tex_info(arm, strength=1.0)
                m['pbrMetallicRoughness']['metallicRoughnessTexture'] = _tex_info(arm)
        self.materials.append(m)
        self.tiles.append(tile)
        return len(self.materials) - 1

    def primitive(self, parts, mat):
        pos, nrm, idx = [], [], []
        for p, n, i in parts:
            base = len(pos)
            pos += p
            nrm += n
            idx += [base + k for k in i]
        uv = [planar_uv(p, n, self.tiles[mat]) for p, n in zip(pos, nrm)]
        pv = self._view(struct.pack(f'<{len(pos) * 3}f', *[c for v in pos for c in v]), 34962)
        nv = self._view(struct.pack(f'<{len(nrm) * 3}f', *[c for v in nrm for c in v]), 34962)
        tv = self._view(struct.pack(f'<{len(uv) * 2}f', *[c for v in uv for c in v]), 34962)
        iv = self._view(struct.pack(f'<{len(idx)}I', *idx), 34963)
        self.accessors += [
            dict(bufferView=pv, componentType=5126, count=len(pos), type='VEC3',
                 min=[min(v[k] for v in pos) for k in range(3)], max=[max(v[k] for v in pos) for k in range(3)]),
            dict(bufferView=nv, componentType=5126, count=len(nrm), type='VEC3'),
            dict(bufferView=tv, componentType=5126, count=len(uv), type='VEC2'),
            dict(bufferView=iv, componentType=5125, count=len(idx), type='SCALAR'),
        ]
        a = len(self.accessors) - 4
        return dict(attributes=dict(POSITION=a, NORMAL=a + 1, TEXCOORD_0=a + 2), indices=a + 3, material=mat)

    def mesh(self, name, prims):
        self.meshes.append(dict(name=name, primitives=prims))
        return len(self.meshes) - 1

    def node(self, **kw):
        self.nodes.append(kw)
        return len(self.nodes) - 1

    def write(self, path, root):
        gltf = dict(asset=dict(version='2.0', generator=self.generator), scene=0,
                    scenes=[dict(name='Scene', nodes=[root])], nodes=self.nodes, meshes=self.meshes,
                    materials=self.materials, accessors=self.accessors, bufferViews=self.views,
                    buffers=[dict(byteLength=self.offset)])
        if self.textures:
            gltf['extensionsUsed'] = ['KHR_texture_transform']
            gltf.update(images=self.images, textures=self.textures,
                        samplers=[dict(magFilter=9729, minFilter=9987, wrapS=10497, wrapT=10497)])
        js = json.dumps(gltf, separators=(',', ':')).encode()
        js += b' ' * ((-len(js)) % 4)
        blob = b''.join(self.bins)
        out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob))
        out += struct.pack('<II', len(js), 0x4E4F534A) + js
        out += struct.pack('<II', len(blob), 0x004E4942) + blob
        Path(path).write_bytes(out)
        return len(out)


def chamfer_box(x0, x1, y0, y1, z0, z1, b, rot_x=0.0, pivot=None):
    """Box with its edges chamfered by b metres: 6 faces, 12 edge bevels, 8 corner
    triangles. The bevels catch light the way real arrises do, for a few dozen
    extra triangles. Faces are flat-shaded, with outward normals."""
    b = min(b, (x1 - x0) / 3, (y1 - y0) / 3, (z1 - z0) / 3)
    lo, hi = (x0, y0, z0), (x1, y1, z1)
    def pt(c, axis):
        # corner c (3 signs), full extent along `axis`, inset by b on the other two
        return tuple((hi[k] if c[k] else lo[k]) if k == axis else (hi[k] - b if c[k] else lo[k] + b) for k in range(3))
    corners = [(i, j, k) for i in (0, 1) for j in (0, 1) for k in (0, 1)]
    P = {(c, a): pt(c, a) for c in corners for a in range(3)}
    polys = []
    for axis in range(3):  # main faces
        for side in (0, 1):
            cs = [c for c in corners if c[axis] == side]
            o = [k for k in range(3) if k != axis]
            cs.sort(key=lambda c: math.atan2(c[o[1]] - .5, c[o[0]] - .5))
            polys.append([P[(c, axis)] for c in cs])
    for a1 in range(3):  # edge bevels: between faces a1 and a2, along the third axis
        for a2 in range(a1 + 1, 3):
            a3 = 3 - a1 - a2
            for s1 in (0, 1):
                for s2 in (0, 1):
                    c0 = [0, 0, 0]; c0[a1] = s1; c0[a2] = s2
                    c1 = list(c0); c1[a3] = 1; c0 = tuple(c0); c1 = tuple(c1)
                    polys.append([P[(c0, a1)], P[(c1, a1)], P[(c1, a2)], P[(c0, a2)]])
    for c in corners:  # corner triangles
        polys.append([P[(c, 0)], P[(c, 1)], P[(c, 2)]])
    centre = [(lo[k] + hi[k]) / 2 for k in range(3)]
    if rot_x:
        py, pz = pivot
        sn, co = math.sin(rot_x), math.cos(rot_x)
        rot = lambda v: (v[0], py + (v[1] - py) * co - (v[2] - pz) * sn, pz + (v[1] - py) * sn + (v[2] - pz) * co)
        polys = [[rot(v) for v in poly] for poly in polys]
        centre = list(rot(centre))
    pos, nrm, idx = [], [], []
    for poly in polys:
        a, bb, c = poly[0], poly[1], poly[2]
        u = [bb[k] - a[k] for k in range(3)]; v = [c[k] - a[k] for k in range(3)]
        n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        mid = [sum(p[k] for p in poly) / len(poly) for k in range(3)]
        if sum(n[k] * (mid[k] - centre[k]) for k in range(3)) < 0:
            poly = poly[::-1]; n = [-x for x in n]
        ln = math.sqrt(sum(x * x for x in n)) or 1.0
        n = tuple(x / ln for x in n)
        base = len(pos)
        pos += poly; nrm += [n] * len(poly)
        for i in range(1, len(poly) - 1):
            idx += [base, base + i, base + i + 1]
    return pos, nrm, idx
