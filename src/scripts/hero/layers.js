// The window detail's twelve layers: finding them in the GLB, painting them as
// clay or real materials, building them up in construction order, and sliding
// them out and back for the layer pulls.
import * as THREE from 'three';
import { ease, easeOut } from './scene.js';
import { systemOf } from './systems.js';

// A layer is the outermost node named Lnn_… (Lnn_pin markers excluded),
// wherever the exporter nests it. See tools/models/README.md.
const LAYER = /^L(\d\d)_(?!pin$)/;
const METAL = new Set([2, 3, 4, 7, 12]);
// When one layer is picked out, everything else steps back to Apple's systemGray5.
const RECEDE = new THREE.Color(0xe5e5ea);
// Construction order for the build-up (layer numbers).
export const ORDER = [2, 6, 3, 1, 4, 5, 7, 11, 12, 8, 10, 9];

// One material per mesh that can run anywhere between plain clay (no texture,
// clay colour) and the real textured material, so the finale can blend them.
function withTextureMix(mat) {
  const mix = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTextureMix = mix;
    shader.fragmentShader = 'uniform float uTextureMix;\n' + shader.fragmentShader.replace(
      '#include <map_fragment>',
      '#ifdef USE_MAP\n  diffuseColor *= mix( vec4( 1.0 ), texture2D( map, vMapUv ), uTextureMix );\n#endif',
    );
  };
  mat.customProgramCacheKey = () => 'texture-mix';
  return mix;
}

export function createLayers(root) {
  const layers = [];
  root.traverse((o) => {
    if (!LAYER.test(o.name) || LAYER.test(o.parent?.name ?? '')) return;
    // Compressed files carry a per-node offset (meshopt quantisation), so every
    // animation is relative to the node's own position, never an overwrite.
    layers[parseInt(LAYER.exec(o.name)[1], 10)] = {
      node: o, meshes: [], baseX: o.position.x, baseY: o.position.y, baseZ: o.position.z, pull: 0, dv: [0, 0],
    };
  });
  for (const [n, L] of layers.entries()) {
    if (!L) continue;
    L.node.traverse((o) => {
      if (!o.isMesh) return;
      Object.assign(o, { castShadow: true, receiveShadow: true });
      const real = o.material, glass = real.transparent, metal = METAL.has(n);
      const work = real.clone();
      o.userData = {
        real, glass, mix: withTextureMix(work), baseOpacity: real.opacity,
        // The "systems" look: each layer in its building system's colour.
        // The finale blends from this to the real, textured material.
        clay: {
          color: new THREE.Color(systemOf(n)?.color ?? '#c7c7cc'),
          roughness: glass ? 0.1 : metal ? 0.4 : 0.6,
          metalness: metal ? 0.15 : 0,
        },
      };
      o.material = work;
      L.meshes.push(o);
    });
  }
  const each = (fn) => { for (const [n, L] of layers.entries()) if (L) fn(L, n); };

  // System colours everywhere; with a focus layer, the rest recede to grey.
  function paint(focus) {
    each((L, n) => {
      for (const m of L.meshes) {
        const { clay, mix } = m.userData;
        const recede = focus && n !== focus;
        m.material.color.copy(recede ? RECEDE : clay.color);
        m.material.roughness = clay.roughness;
        m.material.metalness = clay.metalness;
        m.material.normalScale.setScalar(0);
        mix.value = 0;
      }
    });
  }

  // 0 = clay, 1 = the real textured material.
  function lerpReal(k) {
    each((L) => {
      for (const m of L.meshes) {
        const { clay, real, mix } = m.userData;
        m.material.color.copy(clay.color).lerp(real.color, k);
        m.material.roughness = THREE.MathUtils.lerp(clay.roughness, real.roughness, k);
        m.material.metalness = THREE.MathUtils.lerp(clay.metalness, real.metalness, k);
        m.material.normalScale.setScalar(k);
        mix.value = k;
      }
    });
  }

  // k = 0 hidden above its place, 1 landed.
  function setLayer(n, k) {
    const L = layers[n];
    if (!L) return;
    L.node.position.y = L.baseY + (1 - k) * 0.7;
    L.node.visible = k > 0.001;
    L.k = k;
    for (const m of L.meshes) {
      m.material.transparent = m.userData.glass || k < 1;
      m.material.opacity = m.userData.baseOpacity * k;
      m.castShadow = k > 0.5;
    }
  }
  const setAll = (k) => ORDER.forEach((n) => setLayer(n, k));

  // Build-up: each layer drops in from above and fades up, in construction order.
  let build = null;
  function startBuild(delay = 250) {
    setAll(0);
    build = { t0: performance.now() + delay };
  }
  function stepBuild(now) {
    if (!build) return;
    let done = true;
    ORDER.forEach((n, i) => {
      const t = THREE.MathUtils.clamp((now - build.t0 - i * 170) / 520, 0, 1);
      if (t < 1) done = false;
      setLayer(n, easeOut(t));
    });
    if (done) build = null;
  }
  function finishBuild() {
    build = null;
    setAll(1);
  }

  // Pulls: `pulling` names the layers that should be out now; everything else
  // eases home. Layers slide towards the viewer and left, away from the panel.
  function stepPulls(dt, pulling) {
    each((L, n) => {
      const out = !!pulling?.layers.includes(n);
      if (out) L.dv = pulling.dv;
      L.pull += ((out ? 1 : 0) - L.pull) * Math.min(1, dt * 0.006);
      const e = ease(THREE.MathUtils.clamp(L.pull, 0, 1));
      L.node.position.x = L.baseX + e * L.dv[0];
      L.node.position.z = L.baseZ + e * L.dv[1];
    });
  }
  const isOut = (n) => (layers[n]?.pull ?? 0) > 0.5;
  // Has this layer landed (mostly) during a build-up?
  const landed = (n) => (layers[n]?.k ?? 1) > 0.5;

  return { paint, lerpReal, startBuild, stepBuild, finishBuild, stepPulls, isOut, landed };
}
