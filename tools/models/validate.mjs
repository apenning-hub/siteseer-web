import { validateBytes } from 'gltf-validator';
import { readFileSync } from 'node:fs';
const r = await validateBytes(new Uint8Array(readFileSync(process.argv[2])));
console.log('errors', r.issues.numErrors, 'warnings', r.issues.numWarnings, 'infos', r.issues.numInfos);
for (const m of r.issues.messages.filter(m => m.severity < 2)) console.log(m.code, m.message, m.pointer);
