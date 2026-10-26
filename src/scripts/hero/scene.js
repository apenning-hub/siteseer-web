// Renderer, lights, camera and orbit controls for the hero. The camera is held
// as orbit values (target, azimuth, polar, radius) so moves sweep round the
// model instead of cutting through it.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t) => 1 - (1 - t) ** 3;

// The paper ground behind the canvas, for fog that melts the far ground into it.
const BACKDROP = 0xf3eee6;

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
  sun.shadow.mapSize.set(2048, 2048);
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
  const resize = () => {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(renderer.domElement);
  resize();

  const cam = { t: new THREE.Vector3(0, 1.1, 0.13), az: -30, polar: 76, r: 6.2 };
  const sph = new THREE.Spherical();
  let tween = null;

  function applyCam() {
    // Narrow screens stack the copy over the model, so stand further back.
    sph.set(cam.r * (hero.clientWidth > 900 ? 1.05 : 1.25), THREE.MathUtils.degToRad(cam.polar), THREE.MathUtils.degToRad(cam.az));
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
    renderer, scene, camera, controls, sun, ground,
    camTo, tickCamera, applyCam, adoptControls, toScreen,
    stopTween: () => { tween = null; },
    tweening: () => !!tween,
  };
}
