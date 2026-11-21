import * as THREE from "./vendor/three.module.min.js";

const ART_WIDTH = 16;
const ART_HEIGHT = 10;
const FIELD_OF_VIEW = 36;
const CAMERA_DISTANCE = ART_HEIGHT / (2 * Math.tan(THREE.MathUtils.degToRad(FIELD_OF_VIEW / 2)));
const FRAME_INTERVAL = 1000 / 30 - 0.5;
const MAX_PIXELS = 1_400_000;

const COBALT = 0x3158a4;
const INK = 0x233d7b;
const PALE_BLUE = 0xa1b6df;

function point([u, v, depth]) {
  return new THREE.Vector3((u - 0.5) * ART_WIDTH, (v - 0.5) * ART_HEIGHT, depth);
}

function curve(points) {
  return new THREE.CubicBezierCurve3(...points.map(point));
}

function addLine(segments, points) {
  for (let i = 1; i < points.length; i += 1) {
    segments.push(...points[i - 1], ...points[i]);
  }
}

function linework(segments, color, opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color, opacity, transparent: true, depthWrite: false,
  }));
}

const upperFolds = [
  [[[1.13, 1.065, -1.15], [0.994, 0.97, -0.28], [0.81, 0.86, 1.05], [0.58, 0.736, -0.65]], 0.82, 0x5680c4, 0.24],
  [[[1.10, 1.09, -0.23], [0.98, 0.97, 0.53], [0.899, 0.849, 1.1], [0.732, 0.695, -0.33]], 0.40, 0x2e56a5, 0.44],
  [[[1.11, 0.975, -0.23], [1.03, 0.939, 0.57], [0.905, 0.948, 1.26], [0.69, 0.769, 0.24]], 0.36, 0x6b8dca, 0.30],
  [[[1.045, 1.08, 0.41], [0.967, 1.006, 0.86], [0.833, 0.84, 0.68], [0.847, 0.772, -0.63]], 0.22, 0x234d9d, 0.46],
  [[[1.12, 0.925, -1.22], [1.036, 0.91, -0.84], [0.964, 0.846, 0.37], [0.856, 0.808, 1.04]], 0.64, 0x5275bb, 0.18],
];

const lowerFolds = [
  [[[-0.115, -0.019, -1.2], [0.13, 0.013, 0.39], [0.191, 0.143, 0.77], [0.492, 0.213, -1.11]], 0.60, 0x7193cd, 0.28],
  [[[-0.09, -0.096, -0.50], [0.152, 0.004, 0.67], [0.184, 0.041, 1.02], [0.40, 0.186, -0.4]], 0.43, 0x355cab, 0.35],
  [[[0.044, -0.083, 0.49], [0.148, 0.039, 0.73], [0.155, 0.122, -0.13], [0.393, 0.163, -0.5]], 0.29, 0x2f55a7, 0.33],
  [[[-0.110, 0.022, -0.35], [0.098, 0.054, -0.2], [0.320, 0.066, 0.32], [0.55, 0.148, -1.05]], 0.24, 0x6385c3, 0.40],
  [[[-0.08, -0.055, -0.9], [0.085, 0.014, 0.72], [0.19, 0.193, 1.2], [0.282, 0.244, -0.3]], 0.22, 0x9ab2dc, 0.32],
];

const edgeFolds = [
  [[[1.105, 0.652, -1.4], [1.008, 0.602, -0.49], [1.008, 0.537, 0.72], [0.881, 0.446, 0.3]], 0.40, 0x5e80c0, 0.21],
  [[[1.114, 0.624, 0.15], [1.054, 0.62, 0.6], [0.981, 0.57, -0.49], [0.922, 0.524, -0.82]], 0.19, 0x2b54a5, 0.31],
  [[[1.12, 0.243, -1.01], [1.013, 0.181, -0.18], [0.941, 0.088, 0.58], [0.803, -0.027, 0.33]], 0.41, 0x6489c8, 0.22],
];

function makeFolds(group, definitions) {
  const cuts = [];
  const highlights = [];
  for (const [points, width, color, opacity] of definitions) {
    const path = curve(points);
    const positions = [];
    const colors = [];
    const indices = [];
    const outline = [];
    const crease = [];
    const base = new THREE.Color(color);
    const coolWhite = new THREE.Color(0xdce5f2);
    const shadow = new THREE.Color(INK);
    const samples = 24;

    for (let i = 0; i <= samples; i += 1) {
      const t = i / samples;
      const center = path.getPoint(t);
      const tangent = path.getTangent(t);
      const across = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
      const envelope = Math.pow(Math.sin(Math.PI * (0.12 + t * 0.88)), 1.22);
      const span = width * envelope;
      const edge = center.clone().addScaledVector(across, -span * 0.45);
      const ridge = center.clone().addScaledVector(across, -span * 0.16);
      const farEdge = center.clone().addScaledVector(across, span * 0.55);
      edge.z -= span * 0.24;
      farEdge.z -= span * 0.48;
      ridge.z += span * (0.37 + Math.sin(t * Math.PI) * 0.25);
      positions.push(...edge, ...ridge, ...farEdge);
      outline.push(farEdge);
      crease.push(ridge);

      base.clone().lerp(shadow, 0.24 + 0.25 * t).toArray(colors, colors.length);
      base.clone().lerp(coolWhite, 0.72 - 0.27 * t).toArray(colors, colors.length);
      base.clone().lerp(shadow, 0.13 + 0.22 * t).toArray(colors, colors.length);

      const first = i * 3;
      if (i < samples) {
        indices.push(first, first + 3, first + 1, first + 1, first + 3, first + 4);
        indices.push(first + 1, first + 4, first + 2, first + 2, first + 4, first + 5);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true, opacity, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, forceSinglePass: true,
    });
    group.add(new THREE.Mesh(geometry, material));
    addLine(cuts, outline.slice(3, -3));
    addLine(highlights, crease.slice(2, -4));
  }
  group.add(linework(cuts, COBALT, 0.22), linework(highlights, 0xe9effc, 0.65));
}

function randomStream(seed) {
  return () => {
    seed = Math.imul(1664525, seed) + 1013904223 >>> 0;
    return seed / 4294967296;
  };
}

function etchFan(group, origins, targets, count, seed) {
  const random = randomStream(seed);
  const fine = [];
  const emphasis = [];
  const interpolate = (limits) => THREE.MathUtils.lerp(...limits, random());
  for (let i = 0; i < count; i += 1) {
    const start = point([interpolate(origins[0]), interpolate(origins[1]), interpolate(origins[2])]);
    const end = point([interpolate(targets[0]), interpolate(targets[1]), interpolate(targets[2])]);
    const midpoint = start.clone().lerp(end, 0.57);
    midpoint.y += (random() - 0.62) * 0.56;
    midpoint.z += random() * 1.4;
    const route = new THREE.QuadraticBezierCurve3(start, midpoint, end);
    const sampled = [];
    const startAt = i % 3 === 0 ? 0.25 + random() * 0.26 : 0.06;
    const endAt = 0.65 + random() * 0.32;
    for (let segment = 0; segment <= 16; segment += 1) {
      sampled.push(route.getPoint(THREE.MathUtils.lerp(startAt, endAt, segment / 16)));
    }
    addLine(i % 5 === 0 ? emphasis : fine, sampled);
  }
  group.add(linework(fine, COBALT, 0.18), linework(emphasis, INK, 0.30));
}

function connectFolds(parent) {
  const segments = [];
  const strokes = [
    [[[0.23, 0.10, -1.91], [0.58, 0.19, -2.25], [0.62, 0.64, -1.2], [0.94, 0.84, -0.53]], 0.22, 0.89],
    [[[0.31, 0.13, -1.03], [0.55, 0.23, -1.8], [0.68, 0.62, -1.8], [0.91, 0.80, -0.95]], 0.43, 0.67],
  ];
  for (const [points, start, end] of strokes) {
    const route = curve(points);
    const pointsOnStroke = Array.from({ length: 41 }, (_, index) =>
      route.getPoint(THREE.MathUtils.lerp(start, end, index / 40)));
    addLine(segments, pointsOnStroke);
  }
  parent.add(linework(segments, COBALT, 0.15));
}

function makeArcs(parent, anchor, radii, tilt) {
  const group = new THREE.Group();
  const marks = [];
  const traces = [];
  group.position.copy(point(anchor));
  group.rotation.set(...tilt);
  for (let i = 0; i < 4; i += 1) {
    const radius = 1 + 0.075 * i;
    const coordinates = [];
    const angleStart = 0.92 + i * 0.14;
    const angleEnd = 3.44 - i * 0.12;
    for (let j = 0; j <= 42; j += 1) {
      const angle = THREE.MathUtils.lerp(angleStart, angleEnd, j / 42);
      const vertex = new THREE.Vector3(Math.cos(angle) * radii[0], Math.sin(angle) * radii[1], 0)
        .multiplyScalar(radius);
      coordinates.push(vertex);
      if (i === 3 && j % 3 === 0) {
        marks.push(...vertex, ...vertex.clone().multiplyScalar(j % 9 === 0 ? 1.034 : 1.016));
      }
    }
    addLine(traces, coordinates);
  }
  group.add(linework(traces, COBALT, 0.22), linework(marks, INK, 0.33));
  parent.add(group);
}

function dotGeometry(anchor, size, seed) {
  const random = randomStream(seed);
  const positions = [];
  const rows = 8;
  const columns = 12;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const sum = x / columns + y / rows;
      if (sum > 1.24 || random() < sum * 0.25) continue;
      const center = point([
        anchor[0] + x * size[0],
        anchor[1] + y * size[1],
        anchor[2] - y * 0.08 + (random() - 0.5) * 0.075,
      ]);
      const radius = (0.018 + random() * 0.012) * (1.02 - sum * 0.5);
      for (let i = 0; i < 6; i += 1) {
        const theta = i * Math.PI / 3;
        positions.push(...center);
        for (const angle of [theta, theta + Math.PI / 3]) {
          positions.push(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, center.z);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function panelDots(group, anchor, size, seed) {
  group.add(new THREE.Mesh(dotGeometry(anchor, size, seed), new THREE.MeshBasicMaterial({
    color: COBALT, opacity: 0.50, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, forceSinglePass: true,
  })));
}

function dispersedFoil(group, anchor, span, seed, count) {
  const random = randomStream(seed);
  const positions = [];
  const colors = [];
  const ink = new THREE.Color(COBALT);
  const light = new THREE.Color(PALE_BLUE);
  for (let i = 0; i < count; i += 1) {
    const u = random() - 0.5;
    const v = (random() - 0.5) * (1 - 0.38 * Math.abs(u));
    const center = point([anchor[0] + u * span[0], anchor[1] + v * span[1], anchor[2] + random() * 1.4]);
    const length = 0.06 + Math.pow(random(), 2) * 0.30;
    const tip = center.clone().add(new THREE.Vector3(-length * 1.3, -length * 0.60, random() * 0.28));
    const left = center.clone().add(new THREE.Vector3(length * 0.20, length * 0.29, -0.11));
    const right = center.clone().add(new THREE.Vector3(length * 0.39, length * 0.09, 0.09));
    const crest = center.clone().add(new THREE.Vector3(length * 0.11, length * 0.20, 0.11));
    positions.push(...tip, ...left, ...crest, ...tip, ...crest, ...right);
    for (const amount of [0, 0.27, 0.82, 0.16, 0.54, 0.04]) {
      ink.clone().lerp(light, amount).toArray(colors, colors.length);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    vertexColors: true, opacity: 0.46, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, forceSinglePass: true,
  })));
}

function makeArtwork() {
  const art = new THREE.Group();
  const upper = new THREE.Group();
  const lower = new THREE.Group();
  const edge = new THREE.Group();
  makeFolds(upper, upperFolds);
  makeFolds(lower, lowerFolds);
  makeFolds(edge, edgeFolds);

  etchFan(upper, [[1.02, 1.14], [0.89, 1.14], [-1.2, 0.9]],
    [[0.53, 0.86], [0.62, 0.94], [-1.2, 0.8]], 29, 41);
  etchFan(lower, [[-0.13, 0.20], [-0.13, 0.09], [-0.8, 0.65]],
    [[0.32, 0.64], [0.10, 0.30], [-1.0, 1.0]], 26, 191);
  etchFan(edge, [[1.05, 1.19], [0.29, 0.67], [-1.45, 0.5]],
    [[0.72, 0.92], [0.11, 0.51], [-1.05, 0.56]], 17, 262);
  connectFolds(edge);
  makeArcs(upper, [0.846, 0.75, -1.5], [3.35, 0.89], [0.41, 0.31, 0.53]);
  makeArcs(lower, [0.155, 0.064, -1.23], [2.2, 0.74], [0.35, -0.36, 0.44]);
  panelDots(upper, [0.96, 0.745, 0.58], [-0.0069, -0.0120], 71);
  panelDots(lower, [0.068, 0.09, 0.18], [0.0072, 0.0084], 88);
  panelDots(edge, [0.973, 0.176, -0.65], [-0.0056, 0.0105], 132);
  dispersedFoil(upper, [0.86, 0.858, -0.96], [0.32, 0.144], 86, 23);
  dispersedFoil(lower, [0.232, 0.129, -0.45], [0.37, 0.135], 720, 17);
  dispersedFoil(edge, [0.985, 0.497, -1.39], [0.135, 0.213], 87, 13);
  art.add(upper, lower, edge);
  return { art, upper, lower, edge };
}

export function mountBackground(container, { motion = true, onReady } = {}) {
  const canvas = document.createElement("canvas");
  let renderer;
  try {
    const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
    if (!context) return null;
    renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  } catch {
    return null;
  }

  renderer.setClearColor(0xffffff, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 60);
  camera.position.z = CAMERA_DISTANCE;
  const { art, upper, lower, edge } = makeArtwork();
  scene.add(art);
  canvas.className = "background-canvas";
  container.append(canvas);

  const events = new AbortController();
  const listener = { signal: events.signal };
  const pointer = new THREE.Vector2();
  const easedPointer = new THREE.Vector2();
  let active = Boolean(motion);
  let frame = 0;
  let inView = true;
  let contextLost = false;
  let sizeReady = false;
  let disposed = false;
  let needsRender = true;
  let didRender = false;
  let lastTime = 0;
  let elapsed = 0;
  let scrollOffset = 0;
  let scrollRange = 1;

  function queue() {
    if (!frame && sizeReady && inView && !document.hidden && !contextLost && !disposed) {
      frame = requestAnimationFrame(draw);
    }
  }

  function draw(time) {
    frame = 0;
    const passed = time - lastTime;
    if (!needsRender && passed < FRAME_INTERVAL) {
      if (active) queue();
      return;
    }

    if (active) {
      const delta = lastTime ? Math.min(passed / 1000, 0.05) : 0;
      elapsed += delta;
      const settle = 1 - Math.exp(-delta * 5);
      easedPointer.lerp(pointer, settle);
      const scrollTarget = THREE.MathUtils.clamp(scrollY / scrollRange, 0, 1);
      scrollOffset = THREE.MathUtils.lerp(scrollOffset, scrollTarget, settle);
    }

    camera.position.x = easedPointer.x * camera.aspect * 0.26;
    camera.position.y = -easedPointer.y * 0.21 + scrollOffset * 0.20;
    upper.position.x = 0.11 * Math.sin(elapsed * 0.66);
    upper.position.y = 0.085 * Math.sin(elapsed * 0.82);
    upper.rotation.y = 0.10 * Math.sin(elapsed * 0.53);
    upper.rotation.z = 0.016 * Math.sin(elapsed * 0.57);
    lower.position.x = 0.15 * Math.sin(elapsed * 0.62);
    lower.position.y = 0.09 * Math.sin(elapsed * 0.76);
    lower.rotation.y = -0.11 * Math.sin(elapsed * 0.63);
    lower.rotation.z = 0.026 * Math.sin(elapsed * 0.53);
    edge.position.z = 0.21 * Math.sin(elapsed * 0.73);
    edge.rotation.z = 0.016 * Math.sin(elapsed * 0.71);

    renderer.render(scene, camera);
    lastTime = time;
    needsRender = false;
    if (!didRender) {
      didRender = true;
      onReady?.();
    }
    if (active) queue();
  }

  function stopFrame() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }

  function resize() {
    const { width, height } = container.getBoundingClientRect();
    sizeReady = width > 0 && height > 0;
    if (!sizeReady) return;
    scrollRange = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    art.scale.x = camera.aspect * ART_HEIGHT / ART_WIDTH;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(MAX_PIXELS / (width * height)));
    renderer.setDrawingBufferSize(width, height, pixelRatio);
    needsRender = true;
    queue();
  }

  const size = new ResizeObserver(resize);
  size.observe(container);
  const view = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (!inView) stopFrame();
    else if (active || needsRender) queue();
  });
  view.observe(container);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopFrame();
    else if (active || needsRender) queue();
  }, listener);
  window.addEventListener("pointermove", (event) => {
    if (active && event.pointerType !== "touch") {
      pointer.set(2 * event.clientX / innerWidth - 1, 2 * event.clientY / innerHeight - 1);
    }
  }, { ...listener, passive: true });
  document.documentElement.addEventListener("pointerleave", () => pointer.set(0, 0), listener);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    contextLost = true;
    canvas.hidden = true;
    stopFrame();
  }, listener);
  canvas.addEventListener("webglcontextrestored", () => {
    contextLost = false;
    needsRender = true;
    canvas.hidden = false;
    queue();
  }, listener);

  resize();
  return {
    setMotion(enabled) {
      active = Boolean(enabled);
      if (!active) stopFrame();
      if (active || needsRender) queue();
    },
    dispose() {
      disposed = true;
      stopFrame();
      events.abort();
      size.disconnect();
      view.disconnect();
      art.traverse(({ geometry, material }) => {
        geometry?.dispose();
        material?.dispose();
      });
      renderer.dispose();
      canvas.remove();
    },
  };
}
