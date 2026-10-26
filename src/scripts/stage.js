// "Pause the build": the stage buttons rebuild a small wall to that stage.
// Nothing is tied to scroll. The first time the tile is seen it builds once
// from the slab up (about four seconds), then waits for a click.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// What each stage adds, in order. Lnn are the detail's layers; S_ come from the site file.
const STAGES = [
  ['S_slab'],
  ['L02', 'L06', 'S_frame'],
  ['L03', 'L04', 'L01', 'L05', 'L12', 'L07', 'L11'],
  ['L08', 'L10', 'L09'],
];
const easeOut = (t) => 1 - (1 - t) ** 3;

export async function mountStage(host) {
  const buttons = [...host.parentElement.querySelectorAll('.seg button')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d0c4, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(-3.5, 5, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 4, bottom: -3, near: 0.5, far: 16 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.9);
  fill.position.set(3, 3, -4);
  scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ color: 0x3a3128, opacity: 0.22 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.14;
  floor.receiveShadow = true;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  const target = new THREE.Vector3(-0.3, 0.6, -0.9);
  camera.position.setFromSpherical(new THREE.Spherical(8, THREE.MathUtils.degToRad(64), THREE.MathUtils.degToRad(-38))).add(target);
  camera.lookAt(target);
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Narrow tiles zoom out so the whole slab stays in frame.
    camera.zoom = Math.min(1, w / h / 1.6);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  new ResizeObserver(resize).observe(host);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [detail, site] = await Promise.all([loader.loadAsync(host.dataset.detail), loader.loadAsync(host.dataset.site)]);
  const parts = [];
  const register = (key, node) => {
    const meshes = [];
    node.traverse((o) => {
      if (!o.isMesh) return;
      Object.assign(o, { castShadow: true, receiveShadow: true });
      o.userData = { glass: o.material.transparent, baseOpacity: o.material.opacity };
      meshes.push(o);
    });
    const stage = STAGES.findIndex((s) => s.includes(key));
    parts.push({ key, node, meshes, baseY: node.position.y, stage, order: STAGES[stage].indexOf(key), k: 1, to: 1, at: 0 });
  };
  detail.scene.traverse((o) => {
    const m = /^(L\d\d)_(?!pin$)/.exec(o.name);
    if (m && !/^L\d\d_/.test(o.parent?.name ?? '')) register(m[1], o);
  });
  site.scene.traverse((o) => {
    if (o.name === 'S_slab' || o.name === 'S_frame') register(o.name, o);
    else if (/^S_/.test(o.name)) o.visible = false;
  });
  scene.add(detail.scene, site.scene);
  // Crisp textures at grazing angles.
  const aniso = renderer.capabilities.getMaxAnisotropy();
  for (const root of [detail.scene, site.scene]) root.traverse((o) => {
    if (!o.isMesh) return;
    for (const key of ['map', 'normalMap']) if (o.material[key]) o.material[key].anisotropy = aniso;
  });

  // k = 0 lifted off and invisible, 1 in place. Relative to the node's own
  // position, which carries the compressed file's per-node offset.
  const apply = (p) => {
    const k = easeOut(p.k);
    p.node.position.y = p.baseY + (1 - k) * 0.6;
    p.node.visible = k > 0.001;
    for (const m of p.meshes) {
      m.material.transparent = m.userData.glass || k < 1;
      m.material.opacity = m.userData.baseOpacity * k;
      m.castShadow = k > 0.6;
    }
  };

  let last = 0;
  function tick(now) {
    const dt = last ? now - last : 16;
    last = now;
    for (const p of parts) {
      if (now < p.at || p.k === p.to) continue;
      p.k = THREE.MathUtils.clamp(p.k + (Math.sign(p.to - p.k) * dt) / 450, 0, 1);
      apply(p);
    }
    renderer.render(scene, camera);
    // Render on demand: stop once every piece has landed.
    if (parts.every((p) => p.k === p.to)) {
      renderer.setAnimationLoop(null);
      last = 0;
    }
  }

  function show(stage) {
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === stage)));
    const now = performance.now();
    let n = 0;
    // Arriving pieces land in construction order; leaving pieces lift off together.
    for (const p of [...parts].sort((a, b) => a.stage - b.stage || a.order - b.order)) {
      const to = p.stage <= stage ? 1 : 0;
      if (to === p.to) continue;
      p.to = to;
      p.at = now + (reduce ? 0 : (to ? n++ : 0) * 90);
      if (reduce) {
        p.k = to;
        apply(p);
      }
    }
    renderer.setAnimationLoop(tick);
  }
  buttons.forEach((b, i) => b.addEventListener('click', () => show(i)));
  resize();

  for (const p of parts) {
    p.k = 0;
    p.to = 0;
    apply(p);
  }
  if (reduce) {
    show(3);
    return;
  }
  const seen = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    seen.disconnect();
    [0, 1, 2, 3].forEach((s, i) => setTimeout(() => show(s), 200 + i * 1100));
  }, { threshold: 0.5 });
  seen.observe(host);
}
