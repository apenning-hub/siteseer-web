// The "Pause the build" tile needs only the slab and the stud frame from the
// site model. This writes them alone to a small file, so the tile doesn't pull
// the whole 1 MB site. Usage: node tools/models/stage-base.mjs public/models/site.glb public/models/site-base.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { statSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
const KEEP = new Set(['S_slab', 'S_frame', 'BuildingSite']);
for (const node of doc.getRoot().listNodes()) if (/^S_/.test(node.getName()) && !KEEP.has(node.getName())) node.dispose();
await doc.transform(prune({ keepLeaves: true }));
await io.write(output, doc);
console.log(`${output} ${Math.round(statSync(output).size / 1024)} KB`);
