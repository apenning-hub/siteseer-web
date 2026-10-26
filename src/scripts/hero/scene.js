// Renderer, lights, camera and orbit controls for the hero. The camera is held
// as orbit values (target, azimuth, polar, radius) so moves sweep round the
// model instead of cutting through it.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t) => 1 - (1 - t) ** 3;

// The paper ground behind the canvas, for fog that melts the far ground into it.
const BACKDROP = 0xf3eee6;

// Desktop gets the full-fidelity path: ambient occlusion and finer shadows.
// Phones and touch tablets skip both; they cost more than they show at that size.
export const HIGH_QUALITY = typeof matchMedia !== 'undefined' && matchMedia('(min-width: 901px) and (pointer: fine)').matches;

// Crisp textures at grazing angles (the ground, brick faces seen side-on).
export function sharpenTextures(root, renderer) {
  const max = renderer.capabilities.getMaxAnisotropy();
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      for (const key of ['map', 'normalMap', 'roughnessMap']) if (m[key]) { m[key].anisotropy = max; m[key].needsUpdate = true; }
    }
  });
}

export function createScene(hero) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'hero-canvas';
  hero.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  // Fog is only switched on (by distance) for the site finale; see site.js.
  scene.fog = new THREE.Fog(BACKDROP, 1e4, 2e4);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d0c4, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(-3.5, 5, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(HIGH_QUALITY ? 4096 : 2048);
  Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1.5, near: 0.5, far: 14 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.9);
  fill.position.set(3, 3, -4);
  scene.add(fill);
  // A shadow-only floor on the paper; the site's own ground replaces it in the finale.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ color: 0x3a3128, opacity: 0.22 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {
    enableZoom: false, enablePan: false, enableDamping: true, dampingFactor: 0.08,
    minPolarAngle: THREE.MathUtils.degToRad(30), maxPolarAngle: THREE.MathUtils.degToRad(92),
  });

  // The canvas is sized by CSS: the right of the hero on desktop, the lower part on phones.
  // Ambient occlusion (GTAO): soft contact shading in brick joints, under the
  // sill and where layers meet. The canvas stays transparent so the page's own
  // ground shows behind the model.
  let composer = null, gtao = null;
  if (HIGH_QUALITY) {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.updateGtaoMaterial({ radius: 0.18, distanceExponent: 1.5, thickness: 1, scale: 1.1, samples: 16 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    gtao.blendIntensity = 0.9;
    composer.addPass(gtao);
    composer.addPass(new OutputPass());
  }
  const render = () => (composer ? composer.render() : renderer.render(scene, camera));

  const resize = () => {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
  };
  new ResizeObserver(resize).observe(renderer.domElement);
  resize();

  const cam = { t: new THREE.Vector3(0, 1.1, 0.13), az: -30, polar: 76, r: 6.2 };
  const sph = new THREE.Spherical();
  let tween = null;

  // Keep a subject sphere (the whole wall, by default) inside the frame, with
  // room left for a side panel on desktop. The camera stands at least as far
  // back as that needs; a step's own distance can only push it further.
  let fit = { c: new THREE.Vector3(0, 1.1, 0.13), r: 1.5 };
  const setFit = (f) => { fit = f && { c: new THREE.Vector3(...f.c), r: f.r }; };
  function fitDistance() {
    if (!fit) return 0;
    const c = renderer.domElement;
    const w = c.clientWidth * (hero.clientWidth > 900 ? 0.78 : 0.94), h = c.clientHeight * 0.9;
    if (!w || !h) return 0;
    const v = THREE.MathUtils.degToRad(camera.fov) / 2;
    const half = Math.min(v, Math.atan(Math.tan(v) * (w / h)));
    return (fit.c.distanceTo(cam.t) + fit.r) / Math.sin(half);
  }
  function applyCam() {
    // Narrow screens stack the copy over the model, so stand further back.
    const r = Math.max(cam.r * (hero.clientWidth > 900 ? 1.05 : 1.25), fitDistance());
    sph.set(r, THREE.MathUtils.degToRad(cam.polar), THREE.MathUtils.degToRad(cam.az));
    camera.position.setFromSpherical(sph).add(cam.t);
    controls.target.copy(cam.t);
  }

  function camTo(c, ms = 1500) {
    const d = (((c.az - cam.az) % 360) + 540) % 360 - 180; // shortest way round
    tween = {
      t0: performance.now(), ms,
      from: { t: cam.t.clone(), az: cam.az, polar: cam.polar, r: cam.r },
      to: { t: new THREE.Vector3(...c.t), az: cam.az + d, polar: c.polar, r: c.r },
    };
  }

  function tickCamera(now, dt, drift) {
    if (tween) {
      const k = Math.min((now - tween.t0) / tween.ms, 1), e = ease(k), f = tween.from, to = tween.to;
      cam.t.lerpVectors(f.t, to.t, e);
      cam.az = f.az + (to.az - f.az) * e;
      cam.polar = f.polar + (to.polar - f.polar) * e;
      cam.r = f.r + (to.r - f.r) * e;
      if (k === 1) tween = null;
    } else if (drift) {
      cam.az += dt * 0.0025; // slow drift while a step holds
    }
    applyCam();
  }

  // Take over the orbit from wherever the visitor left the camera.
  function adoptControls() {
    sph.setFromVector3(camera.position.clone().sub(controls.target));
    Object.assign(cam, { t: controls.target.clone(), az: THREE.MathUtils.radToDeg(sph.theta), polar: THREE.MathUtils.radToDeg(sph.phi), r: sph.radius });
  }

  const V = new THREE.Vector3();
  // A world point, optionally offset in x/z, as pixels relative to the hero.
  function toScreen(at, dx = 0, dz = 0) {
    V.set(at[0] + dx, at[1], at[2] + dz).project(camera);
    const c = renderer.domElement;
    return [c.offsetLeft + ((V.x + 1) / 2) * c.clientWidth, c.offsetTop + ((1 - V.y) / 2) * c.clientHeight];
  }

  return {
    renderer, scene, camera, controls, sun, ground, render, setFit,
    camTo, tickCamera, applyCam, adoptControls, toScreen,
    stopTween: () => { tween = null; },
    tweening: () => !!tween,
  };
}
