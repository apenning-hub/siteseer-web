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
// The layers held solid in the x-ray look: the logo red.
const HELD = new THREE.Color(0xff0000);
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
        // Three looks the model moves between (see setLook):
        //   white   - the plain presentation model
        //   systems - each layer in its building system's colour
        //   xray    - everything ghosted except the layers being shown
        white: new THREE.Color(glass ? 0xdfe8ea : metal ? 0xc4bfb8 : 0xebe5dd),
        system: new THREE.Color(systemOf(n)?.color ?? '#c7c7cc'),
        roughness: glass ? 0.1 : metal ? 0.4 : 0.7,
        metalness: metal ? 0.15 : 0,
        target: new THREE.Color(),
      };
      o.userData.target.copy(o.userData.white);
      work.color.copy(o.userData.white);
      work.roughness = o.userData.roughness;
      work.metalness = o.userData.metalness;
      work.normalScale.setScalar(0);
      o.userData.mix.value = 0;
      o.material = work;
      L.meshes.push(o);
    });
    L.xr = 0; L.xrTo = 0; L.k = 1;
  }
  const each = (fn) => { for (const [n, L] of layers.entries()) if (L) fn(L, n); };

  // The look eases in over a moment rather than snapping.
  function setLook(look, focus = [], instant = false) {
    each((L, n) => {
      const held = focus.includes(n);
      L.xrTo = look === 'xray' && !held ? 1 : 0;
      for (const m of L.meshes) {
        const u = m.userData;
        u.target.copy(look === 'systems' ? u.system : look === 'xray' && held ? HELD : u.white);
        if (instant) m.material.color.copy(u.target);
      }
      if (instant) L.xr = L.xrTo;
      apply(L);
    });
  }
  function stepLook(dt) {
    const k = Math.min(1, dt * 0.005);
    each((L) => {
      for (const m of L.meshes) m.material.color.lerp(m.userData.target, k);
      if (L.xr !== L.xrTo) {
        L.xr += (L.xrTo - L.xr) * k;
        if (Math.abs(L.xrTo - L.xr) < 0.002) L.xr = L.xrTo;
        apply(L);
      }
    });
  }

  // 0 = the white model, 1 = the real textured material (the finale).
  function lerpReal(k) {
    each((L) => {
      for (const m of L.meshes) {
        const u = m.userData;
        m.material.color.copy(u.white).lerp(u.real.color, k);
        u.target.copy(m.material.color);
        m.material.roughness = THREE.MathUtils.lerp(u.roughness, u.real.roughness, k);
        m.material.metalness = THREE.MathUtils.lerp(u.metalness, u.real.metalness, k);
        m.material.normalScale.setScalar(k);
        u.mix.value = k;
      }
    });
  }

  // Opacity is the build-up (k) times the x-ray ghosting (xr).
  function apply(L) {
    const ghost = 1 - 0.9 * L.xr;
    for (const m of L.meshes) {
      const op = m.userData.baseOpacity * L.k * ghost;
      m.material.transparent = m.userData.glass || op < 0.999;
      m.material.opacity = op;
      m.material.depthWrite = L.xr < 0.05;
      m.castShadow = L.k > 0.5 && L.xr < 0.5;
    }
  }

  // k = 0 hidden above its place, 1 landed.
  function setLayer(n, k) {
    const L = layers[n];
    if (!L) return;
    L.node.position.y = L.baseY + (1 - k) * 0.7;
    L.node.visible = k > 0.001;
    L.k = k;
    apply(L);
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

  return { setLook, stepLook, lerpReal, startBuild, stepBuild, finishBuild, stepPulls, isOut, landed };
}
