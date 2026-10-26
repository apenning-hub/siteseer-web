// The placeholder building site for the hero finale. Loaded after the detail so
// it never delays the first frame. In the finale the ground and slab fade up
// under the wall, then each S_ prop group settles into place.
import * as THREE from 'three';
import { easeOut } from './scene.js';

export function createSite(loader, url, { scene, sun, ground }) {
  let root = null;
  const parts = [];
  let wanted = null; // a show() that arrived before the file did
  const ready = loader.loadAsync(url).then((gltf) => {
    root = gltf.scene;
    root.traverse((o) => { if (/^S_/.test(o.name)) parts.push({ node: o, meshes: [], baseY: o.position.y }); });
    for (const P of parts) {
      P.node.traverse((o) => {
        if (!o.isMesh) return;
        Object.assign(o, { castShadow: true, receiveShadow: true });
        o.userData = { glass: o.material.transparent, baseOpacity: o.material.opacity, depthWrite: o.material.depthWrite };
        P.meshes.push(o);
      });
    }
    root.visible = false;
    scene.add(root);
    if (wanted) show(...wanted);
  });

  function setPart(P, k, drop) {
    P.node.position.y = P.baseY + (1 - k) * drop;
    P.node.visible = k > 0.001;
    for (const m of P.meshes) {
      m.material.transparent = m.userData.glass || k < 1;
      m.material.opacity = m.userData.baseOpacity * k;
      // While see-through, don't write depth, or a fading slab hides the ground behind it.
      m.material.depthWrite = k >= 1 && m.userData.depthWrite;
      m.castShadow = k > 0.6;
    }
  }

  let fadeIn = null;
  function show(on, instant = false) {
    if (!root) {
      wanted = on ? [on, instant] : null;
      return;
    }
    wanted = null;
    root.visible = on;
    ground.visible = !on;
    // The far ground melts into the background red, so the floor never shows an edge.
    scene.fog.near = on ? 19 : 1e4;
    scene.fog.far = on ? 40 : 2e4;
    Object.assign(sun.shadow.camera, on
      ? { left: -9, right: 9, top: 9, bottom: -9, far: 30 }
      : { left: -2.5, right: 2.5, top: 3, bottom: -1.5, far: 14 });
    sun.shadow.camera.updateProjectionMatrix();
    fadeIn = on && !instant ? { t0: performance.now() + 300 } : null;
    parts.forEach((P) => setPart(P, on && instant ? 1 : 0, 0));
  }

  function step(now) {
    if (!fadeIn) return;
    let done = true;
    parts.forEach((P, i) => {
      // Ground and slab first, then the clutter piece by piece, rising from just below.
      const delay = i < 2 ? 0 : 350 + (i - 2) * 110;
      const t = THREE.MathUtils.clamp((now - fadeIn.t0 - delay) / (i < 2 ? 900 : 550), 0, 1);
      if (t < 1) done = false;
      setPart(P, easeOut(t), i < 2 ? 0 : -0.3);
    });
    if (done) fadeIn = null;
  }

  return { show, step, ready };
}
