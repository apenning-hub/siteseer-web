// Compress a GLB for the web: dedupe, WebP
// textures at 512 px, meshopt geometry. Node names, hierarchy and material
// names are left alone, because the site relies on the Lnn_/S_ naming.
// Usage: node compress.mjs in.glb out.glb [colourSize] [detailSize]
// Colour maps carry most of what the eye reads, so they get the larger size;
// normal and ARM (occlusion/roughness/metal) maps are softer and get the smaller.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const [input, output, size = '512', detail = String(Math.max(256, +size / 2))] = process.argv.slice(2);
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
const doc = await io.read(input);
await doc.transform(
  weld({ cleanup: false }), // its cleanup prunes empty leaf nodes, i.e. the Lnn_pin markers
  dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 74, resize: [+size, +size], slots: /^baseColorTexture$/ }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 76, resize: [+detail, +detail], slots: /^(normalTexture|occlusionTexture|metallicRoughnessTexture)$/ }),
  prune({ keepLeaves: true }), // keep the empty Lnn_pin marker nodes
  // 16-bit UVs: they are remapped into [0,1] by glb.py, so this is ~1 mm on a brick.
  // No stored tangents: three.js derives them in the shader for the normal maps.
  meshopt({ encoder: MeshoptEncoder, level: 'high', quantizeTexcoord: 16 }),
);
await io.write(output, doc);
const kb = (f) => Math.round(statSync(f).size / 1024);
console.log(`${input} ${kb(input)} KB -> ${output} ${kb(output)} KB`);
