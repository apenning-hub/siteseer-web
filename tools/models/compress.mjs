// Compress a GLB for the web: tangents for the normal maps, dedupe, WebP
// textures at 512 px, meshopt geometry. Node names, hierarchy and material
// names are left alone, because the site relies on the Lnn_/S_ naming.
// Usage: node compress.mjs in.glb out.glb [textureSize]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, tangents, textureCompress, meshopt, unweld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { generateTangents } from 'mikktspace';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const [input, output, size = '512'] = process.argv.slice(2);
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
const doc = await io.read(input);
await doc.transform(
  unweld(),
  tangents({ generateTangents }),
  weld({ cleanup: false }), // its cleanup prunes empty leaf nodes, i.e. the Lnn_pin markers
  dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 80, resize: [+size, +size] }),
  prune({ keepLeaves: true }), // keep the empty Lnn_pin marker nodes
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);
await io.write(output, doc);
const kb = (f) => Math.round(statSync(f).size / 1024);
console.log(`${input} ${kb(input)} KB -> ${output} ${kb(output)} KB`);
