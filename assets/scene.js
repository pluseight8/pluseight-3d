import * as THREE from './vendor/three.module.min.js';

const TAU = Math.PI * 2;
const STUDIO_ANGLE = -0.29;
const INK = 0x17409b;
const REST_Y = -0.27;
const REST_X = 0.10;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const RUNNER_PLANE = new THREE.Euler(0.84, -0.10, -0.16, 'ZYX');

function studioReflection() {
  const bitmap = document.createElement('canvas');
  bitmap.width = 512;
  bitmap.height = 256;
  const copy = bitmap.getContext('2d');
  const sky = copy.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#253264');
  sky.addColorStop(0.36, '#a6b7df');
  sky.addColorStop(0.54, '#111936');
  sky.addColorStop(0.69, '#22396c');
  sky.addColorStop(1, '#09152a');
  copy.fillStyle = sky;
  copy.fillRect(0, 0, 512, 256);

  // Large light cards and narrow strips show the changing curvature of the metal.
  const cards = [
    [34, 28, 122, 97, -0.27, '#f8f7ef', '#a5bdf1'],
    [186, 55, 227, 29, 0.15, '#fdfeff', '#e4eaff'],
    [228, 104, 21, 101, -0.25, '#d3eaff', '#73a3ef'],
    [359, 115, 76, 106, 0.33, '#769fed', '#344988'],
    [467, 53, 21, 117, 0.2, '#ffffff', '#a4ccff'],
    [100, 176, 128, 9, -0.18, '#83b3fb', '#3558a3'],
  ];
  for (const [x, y, width, height, rotation, light, dark] of cards) {
    copy.save();
    copy.translate(x + width / 2, y + height / 2);
    copy.rotate(rotation);
    const panel = copy.createLinearGradient(0, -height / 2, 0, height / 2);
    panel.addColorStop(0, light);
    panel.addColorStop(1, dark);
    copy.fillStyle = panel;
    copy.fillRect(-width / 2, -height / 2, width, height);
    copy.restore();
  }
  const texture = new THREE.CanvasTexture(bitmap);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function spine(t) {
  return new THREE.Vector3(
    1.34 * Math.sin(2 * t) * (1 - 0.095 * Math.sin(t)),
    2.17 * Math.sin(t) - 0.06 * Math.cos(2 * t),
    0.43 * Math.cos(t) + 0.12 * Math.sin(3 * t),
  );
}

function rimSampler(t) {
  const center = spine(t);
  const tangent = spine(t + 0.001).sub(spine(t - 0.001)).normalize();
  const lateral = new THREE.Vector3().crossVectors(tangent, Z_AXIS).normalize();
  const face = new THREE.Vector3().crossVectors(lateral, tangent).normalize();
  const roll = 0.29 * Math.sin(2 * t - 0.48) + 0.15 * Math.cos(t + 0.22);
  lateral.applyAxisAngle(tangent, roll);
  face.applyAxisAngle(tangent, roll);
  const width = 0.37 - 0.037 * Math.sin(t) + 0.052 * Math.cos(2 * t);
  const depth = 0.18 + 0.045 * Math.cos(t);
  return (angle) => {
    const rounded = (value) => Math.sign(value) * Math.pow(Math.abs(value), 0.64);
    return center.clone()
      .addScaledVector(lateral, width * rounded(Math.cos(angle)))
      .addScaledVector(face, depth * rounded(Math.sin(angle)));
  };
}

function makeSculpture(environment) {
  const group = new THREE.Group();
  const ringCount = 204;
  const profileCount = 32;
  const stride = profileCount + 1;
  const positions = [];
  const colors = [];
  const indices = [];
  const deep = new THREE.Color('#173984');
  const high = new THREE.Color('#698fdf');
  const silver = new THREE.Color('#a3b8ec');

  for (let ring = 0; ring <= ringCount; ring += 1) {
    const t = ring / ringCount * TAU;
    const sample = rimSampler(t);
    for (let profile = 0; profile <= profileCount; profile += 1) {
      const angle = profile / profileCount * TAU;
      const point = sample(angle);
      positions.push(point.x, point.y, point.z);
      const front = Math.max(0, Math.sin(angle));
      const swept = 0.5 + 0.5 * Math.cos(2 * t + 1.3);
      const color = deep.clone().lerp(high, 0.13 + 0.29 * front + 0.18 * swept);
      if (profile === 2 || profile === 14 || profile === 30) color.lerp(silver, 0.61);
      colors.push(color.r, color.g, color.b);
      const corner = ring * stride + profile;
      if (ring < ringCount && profile < profileCount) {
        indices.push(corner, corner + stride, corner + 1, corner + 1, corner + stride, corner + stride + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Equalize the duplicated seam normals so the continuous band has no joins.
  const normals = geometry.attributes.normal;
  const seamA = new THREE.Vector3();
  const seamB = new THREE.Vector3();
  const blend = (a, b) => {
    seamA.fromBufferAttribute(normals, a);
    seamB.fromBufferAttribute(normals, b);
    seamA.add(seamB).normalize();
    normals.setXYZ(a, seamA.x, seamA.y, seamA.z);
    normals.setXYZ(b, seamA.x, seamA.y, seamA.z);
  };
  for (let ring = 0; ring <= ringCount; ring += 1) blend(ring * stride, ring * stride + profileCount);
  for (let profile = 0; profile <= profileCount; profile += 1) blend(profile, ringCount * stride + profile);

  const metal = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    metalness: 0.83,
    roughness: 0.21,
    envMap: environment,
    envMapIntensity: 1.32,
    clearcoat: 0.73,
    clearcoatRoughness: 0.19,
  });
  const solid = new THREE.Mesh(geometry, metal);
  group.add(solid);

  const wirePositions = [];
  const appendSegment = (from, to) => wirePositions.push(from.x, from.y, from.z, to.x, to.y, to.z);
  const wireRings = 68;
  const wireProfile = 14;
  for (let index = 0; index < wireRings; index += 1) {
    const current = rimSampler(index / wireRings * TAU);
    const next = rimSampler((index + 1) / wireRings * TAU);
    for (let section = 0; section < wireProfile; section += 1) {
      const angle = section / wireProfile * TAU;
      const point = current(angle);
      appendSegment(point, next(angle));
      if (index % 2 === 0) appendSegment(point, current((section + 1) / wireProfile * TAU));
    }
  }
  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wirePositions, 3));
  const wire = new THREE.LineSegments(wireGeometry, new THREE.LineBasicMaterial({
    color: 0x193e92, transparent: true, opacity: 0.67, depthWrite: false,
  }));
  const shaded = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0xa8bcec, transparent: true, opacity: 0.17, depthWrite: false,
  }));
  group.add(shaded, wire);
  wire.visible = shaded.visible = false;

  const accents = new THREE.Group();
  for (const [angle, start, end] of [[0.16, 0.20, 2.27], [2.96, 3.97, 5.77], [0.12, 2.75, 3.88]]) {
    const points = [];
    for (let i = 0; i <= 92; i += 1) {
      const point = rimSampler(THREE.MathUtils.lerp(start, end, i / 92))(angle);
      point.z += 0.008;
      points.push(point);
    }
    accents.add(hairline(points, 0xbbd4ff, 0.54));
  }
  group.add(accents);
  return {
    group,
    setMode(mode) {
      const isWire = mode === 'wire';
      wire.visible = shaded.visible = isWire;
      solid.visible = accents.visible = !isWire;
    },
  };
}

function hairline(points, color, opacity) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
}

function orbit(radiusX, radiusY, tilt, lean, from, to) {
  const points = [];
  const spin = new THREE.Euler(tilt, lean, -0.16, 'ZYX');
  for (let i = 0; i <= 140; i += 1) {
    const t = THREE.MathUtils.lerp(from, to, i / 140);
    points.push(new THREE.Vector3(radiusX * Math.cos(t), radiusY * Math.sin(t), 0).applyEuler(spin));
  }
  return points;
}

function makeOrbits() {
  const group = new THREE.Group();
  group.add(
    hairline(orbit(3.36, 1.03, 0.84, -0.10, 0.10, 5.78), INK, 0.31),
    hairline(orbit(3.42, 1.09, 0.82, -0.11, 3.31, 5.38), INK, 0.22),
    hairline(orbit(2.89, 1.43, 0.46, -0.54, -0.76, 2.26), INK, 0.24),
    hairline(orbit(3.03, 1.49, 0.48, -0.55, 3.09, 5.72), 0x4069bf, 0.33),
    hairline(orbit(2.77, 2.19, 0.54, 0.20, 0.35, 2.07), INK, 0.17),
    hairline(orbit(2.82, 2.24, 0.56, 0.20, 2.91, 4.36), INK, 0.15),
  );
  const runner = new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 10, 7),
    new THREE.MeshBasicMaterial({ color: 0x173986 }),
  );
  group.add(runner);
  return { group, runner };
}

function noise(seed) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function makeDebris() {
  const group = new THREE.Group();
  const shards = [];
  const random = noise(58);
  const colors = [0x0f2767, 0x3564c5, 0x305093, 0xb9cefa, 0x102f77];
  const palettes = colors.map((color, index) => new THREE.MeshStandardMaterial({
    color, metalness: index === 3 ? 0.14 : 0.47, roughness: 0.20,
    side: THREE.DoubleSide, flatShading: true,
  }));
  const sections = [
    { center: new THREE.Vector3(1.42, 1.47, -0.36), angle: -0.53, count: 11 },
    { center: new THREE.Vector3(-1.50, -1.32, -0.22), angle: 2.61, count: 18 },
    { center: new THREE.Vector3(1.02, -2.23, 0.46), angle: 2.22, count: 8 },
  ];

  for (const { center, angle, count } of sections) {
    for (let index = 0; index < count; index += 1) {
      const size = index < 3 ? 0.61 + random() * 0.38 : 0.055 + random() * 0.32;
      const width = size * (0.10 + random() * 0.24);
      const distance = (random() - 0.42) * 1.35;
      const offset = (random() - 0.5) * 0.88;
      const slide = angle + (random() - 0.5) * 0.85;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        -size * 0.48, 0, 0, size * 0.54, width * 0.56, 0, size * 0.61, -width, 0,
        -size * 0.48, 0, 0, size * 0.61, -width, 0, size * 0.16, 0, width * 1.16,
        -size * 0.48, 0, 0, size * 0.16, 0, width * 1.16, size * 0.54, width * 0.56, 0,
        size * 0.54, width * 0.56, 0, size * 0.16, 0, width * 1.16, size * 0.61, -width, 0,
      ], 3));
      geometry.computeVertexNormals();
      const shard = new THREE.Mesh(geometry, palettes[index % palettes.length]);
      shard.position.copy(center).add(new THREE.Vector3(
        Math.cos(angle) * distance - Math.sin(angle) * offset,
        Math.sin(angle) * distance + Math.cos(angle) * offset,
        random() * 0.76,
      ));
      shard.rotation.set(random() * 1.8, random() * 2.2 - 1.10, slide);
      group.add(shard);
      if (index < 4) shards.push({ mesh: shard, base: shard.rotation.y, phase: random() * TAU });
    }
  }

  const points = [];
  const tickCoordinates = [];
  for (let index = 0; index < 103; index += 1) {
    const x = (random() - 0.5) * 6.05;
    const y = 0.57 * x + (random() - 0.5) * 3.55;
    const z = (random() - 0.47) * 2.20;
    points.push(x, y, z);
    if (index % 5 === 0) tickCoordinates.push(x, y, z, x + 0.045 + random() * 0.10, y - 0.02, z);
  }
  const cloud = new THREE.BufferGeometry();
  cloud.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  group.add(new THREE.Points(cloud, new THREE.PointsMaterial({
    color: 0x173a89, size: 0.022, transparent: true, opacity: 0.54, depthWrite: false,
  })));
  const ticks = new THREE.BufferGeometry();
  ticks.setAttribute('position', new THREE.Float32BufferAttribute(tickCoordinates, 3));
  group.add(new THREE.LineSegments(ticks, new THREE.LineBasicMaterial({
    color: 0x254eaa, transparent: true, opacity: 0.31, depthWrite: false,
  })));

  const facets = [
    [[-2.85, -1.38, -0.7], [-1.22, -0.61, -0.2], [-1.93, -2.30, 0.2], [-2.85, -1.38, -0.7], [-0.61, -1.45, -0.6]],
    [[1.29, 2.67, -0.2], [2.66, 1.06, -0.6], [1.13, 1.28, 0.76], [1.29, 2.67, -0.2], [1.86, 1.81, 0.25]],
    [[1.34, -1.27, 0.34], [1.98, -2.36, -0.42], [0.53, -2.33, 0.23], [1.34, -1.27, 0.34]],
  ];
  for (const points of facets) {
    group.add(hairline(points.map((point) => new THREE.Vector3(...point)), INK, 0.27));
  }
  return { group, shards };
}

function lighting(scene) {
  scene.add(new THREE.HemisphereLight(0xe6edff, 0x365194, 1.65));
  for (const [color, intensity, position] of [
    [0xf6faff, 3.0, [4, 3, 7]],
    [0xc4d6ff, 2.5, [-4, 2, 4]],
    [0x7299ff, 3.8, [1, -5, -6]],
  ]) {
    const lamp = new THREE.DirectionalLight(color, intensity);
    lamp.position.set(...position);
    scene.add(lamp);
  }
}

export function mountScene(container, { onReady, onUnavailable } = {}) {
  let renderer;
  let scene;
  let environment;
  let sculpture;
  let debris;
  let orbits;
  let stage;
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  const canvas = document.createElement('canvas');

  try {
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true });
    if (!context) {
      onUnavailable?.();
      return null;
    }
    renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
    renderer.setClearColor(0xffffff, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.27;
    scene = new THREE.Scene();
    environment = studioReflection();
    scene.environment = environment;
    stage = new THREE.Group();
    sculpture = makeSculpture(environment);
    debris = makeDebris();
    orbits = makeOrbits();
    stage.rotation.z = STUDIO_ANGLE;
    stage.add(orbits.group, debris.group, sculpture.group);
    scene.add(stage);
    lighting(scene);
  } catch {
    renderer?.dispose();
    environment?.dispose();
    onUnavailable?.();
    return null;
  }

  canvas.className = 'scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'pan-y', cursor: 'grab' });
  container.append(canvas);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new AbortController();
  const eventOptions = { signal: listeners.signal };
  let animated = !reducedMotion.matches;
  let frame = 0;
  let initialized = false;
  let disposed = false;
  let sized = false;
  let inView = true;
  let contextLost = false;
  let previousTime = 0;
  let elapsed = 0;
  let turn = REST_Y;
  let tilt = REST_X;
  let hoverX = 0;
  let hoverY = 0;
  let drag = null;

  function queueFrame() {
    if (!frame && sized && !disposed && !document.hidden && !contextLost && inView) {
      frame = requestAnimationFrame(draw);
    }
  }

  function render(time) {
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.042) : 0;
    previousTime = time;
    if (animated && !drag) elapsed += delta;

    const drift = Math.sin(elapsed * 0.81) * 0.165;
    const lift = Math.sin(elapsed * 1.16) * 0.073;
    const targetY = turn + drift + hoverX * 0.10;
    const targetX = tilt + hoverY * 0.08 + lift * 0.32;
    const follow = animated && delta ? 1 - Math.exp(-delta * 10) : 1;
    stage.rotation.y += (targetY - stage.rotation.y) * follow;
    stage.rotation.x += (targetX - stage.rotation.x) * follow;
    stage.position.y = lift;
    orbits.group.rotation.y = Math.sin(elapsed * 0.56) * 0.09;
    orbits.group.rotation.x = Math.sin(elapsed * 0.69 + 0.4) * 0.06;
    const runnerAngle = elapsed * 0.55 + 0.59;
    orbits.runner.position.set(3.36 * Math.cos(runnerAngle), 1.03 * Math.sin(runnerAngle), 0)
      .applyEuler(RUNNER_PLANE);
    for (const { mesh, base, phase } of debris.shards) {
      mesh.rotation.y = base + Math.sin(elapsed * 0.88 + phase) * 0.25;
    }
    renderer.render(scene, camera);
  }

  function draw(time) {
    frame = 0;
    render(time);
    if (!initialized) {
      initialized = true;
      onReady?.();
    }
    if (animated) queueFrame();
  }

  function resize() {
    const { width, height } = container.getBoundingClientRect();
    sized = width > 0 && height > 0;
    if (!sized) return;
    camera.aspect = width / height;
    const visibleHeight = Math.max(6.58, 4.13 / camera.aspect);
    camera.position.set(0, 0, visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height, false);
    queueFrame();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersection = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    previousTime = 0;
    if (inView) queueFrame();
    else if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  intersection.observe(container);

  function setMotion(enabled) {
    animated = Boolean(enabled);
    previousTime = 0;
    if (!animated) {
      turn += hoverX * 0.10;
      tilt += hoverY * 0.08;
      hoverX = 0;
      hoverY = 0;
    }
    queueFrame();
  }

  function endDrag(event) {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    canvas.style.cursor = 'grab';
    queueFrame();
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  }, eventOptions);
  canvas.addEventListener('pointermove', (event) => {
    if (drag?.id === event.pointerId) {
      turn += (event.clientX - drag.x) * 0.0082;
      tilt = THREE.MathUtils.clamp(tilt + (event.clientY - drag.y) * 0.0043, -0.62, 0.62);
      drag.x = event.clientX;
      drag.y = event.clientY;
    } else if (animated && event.pointerType === 'mouse') {
      const rect = canvas.getBoundingClientRect();
      hoverX = (event.clientX - rect.left) / rect.width * 2 - 1;
      hoverY = (event.clientY - rect.top) / rect.height * 2 - 1;
    }
    queueFrame();
  }, eventOptions);
  canvas.addEventListener('pointerleave', () => {
    hoverX = 0;
    hoverY = 0;
    queueFrame();
  }, eventOptions);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, endDrag, eventOptions);
  }
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    onUnavailable?.();
  }, eventOptions);
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    initialized = false;
    previousTime = 0;
    queueFrame();
  }, eventOptions);
  document.addEventListener('visibilitychange', () => {
    previousTime = 0;
    queueFrame();
  }, eventOptions);
  reducedMotion.addEventListener('change', (event) => setMotion(!event.matches), eventOptions);

  resize();
  return {
    setMode(mode) {
      sculpture.setMode(mode);
      queueFrame();
    },
    setMotion,
    nudge(direction) {
      if (direction === 'up' || direction === 'down') {
        tilt = THREE.MathUtils.clamp(tilt + (direction === 'up' ? -0.21 : 0.21), -0.62, 0.62);
      } else {
        turn += direction === -1 || direction === 'left' ? -0.37 : 0.37;
      }
      queueFrame();
    },
    reset() {
      turn = REST_Y;
      tilt = REST_X;
      hoverX = hoverY = elapsed = 0;
      queueFrame();
    },
    dispose() {
      disposed = true;
      listeners.abort();
      resizeObserver.disconnect();
      intersection.disconnect();
      cancelAnimationFrame(frame);
      const resources = new Set();
      scene.traverse(({ geometry, material }) => {
        if (geometry) resources.add(geometry);
        if (material) resources.add(material);
      });
      resources.forEach((item) => item.dispose());
      environment.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
