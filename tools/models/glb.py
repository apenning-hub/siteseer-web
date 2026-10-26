"""Minimal glTF 2.0 binary writer shared by the dummy detail and site generators.

Texture coordinates are projected in world space from each face's normal, so a
texture tiles at real-world scale (`tile` metres per repeat) with no unwrapping.
Textures come from textures/<name>_diff.jpg and textures/<name>_nor.jpg.
"""
import json, struct
from pathlib import Path

TEXTURES = Path(__file__).parent / 'textures'


def planar_uv(p, n, tile):
    ax = max(range(3), key=lambda k: abs(n[k]))
    u, v = {0: (p[2], p[1]), 1: (p[0], p[2]), 2: (p[0], p[1])}[ax]
    return (u / tile, -v / tile)


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
            m['pbrMetallicRoughness']['baseColorTexture'] = dict(index=self._texture(f'{tex}_diff.jpg'))
            m['normalTexture'] = dict(index=self._texture(f'{tex}_nor.jpg'))
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
