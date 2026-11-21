const mount = document.querySelector("#canvas-mount");
const backgroundMount = document.querySelector("#background-art");
const viewport = document.querySelector("#viewport");
const explore = document.querySelector("#explore");
const help = document.querySelector("#scene-help");
const state = document.querySelector("#scene-state");
const controls = document.querySelector("#scene-controls");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const motionButton = document.querySelector("#motion");
const resetButton = document.querySelector("#reset");
const sectionLinks = document.querySelectorAll('.masthead nav a[href^="#"]');
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let scene;
let background;
let animationEnabled = !reduceMotion.matches;
let currentMode = "solid";

function updateMotion(enabled) {
  animationEnabled = enabled;
  motionButton.setAttribute("aria-pressed", String(enabled));
  motionButton.title = enabled ? "Пауза анимации" : "Возобновить анимацию";
  scene?.setMotion(enabled);
  background?.setMotion(enabled && !controls.hidden);
}

function showStatic() {
  viewport.classList.remove("has-scene");
  mount.tabIndex = -1;
  controls.hidden = true;
  background?.setMotion(false);
  help.textContent = "Статичный ракурс";
  state.textContent = "Статичный вид";
}

async function startBackground() {
  try {
    const { mountBackground } = await import("./background.js");
    background = mountBackground(backgroundMount, {
      motion: animationEnabled && !controls.hidden,
      onReady: () => backgroundMount.classList.add("is-ready"),
    });
  } catch (error) {
    console.error("Не удалось загрузить 3D-фон.", error);
  }
}

function showScene() {
  viewport.classList.add("has-scene");
  mount.tabIndex = 0;
  controls.hidden = false;
  help.textContent = "Мышь, касание или стрелки";
  state.textContent = "Three.js";
  updateMotion(animationEnabled);
  scene?.setMode(currentMode);
}

async function startScene() {
  try {
    const { mountScene } = await import("./scene.js");
    scene = mountScene(mount, { onReady: showScene, onUnavailable: showStatic });
    if (!scene) showStatic();
  } catch (error) {
    showStatic();
    console.error("Не удалось загрузить 3D-сцену.", error);
  }
}

explore.addEventListener("click", (event) => {
  if (!scene || controls.hidden || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  requestAnimationFrame(() => mount.focus({ preventScroll: true }));
  scene.nudge(1);
});

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    if (!scene) return;
    currentMode = button.dataset.mode;
    scene.setMode(currentMode);
    for (const modeButton of modeButtons) {
      modeButton.setAttribute("aria-pressed", String(modeButton === button));
    }
  });
}

motionButton.addEventListener("click", () => updateMotion(!animationEnabled));
resetButton.addEventListener("click", () => scene?.reset());
reduceMotion.addEventListener("change", (event) => updateMotion(!event.matches));

function markCurrentSection() {
  const current = location.hash === "#scene" ? "#scene" : "#intro";
  for (const link of sectionLinks) {
    if (link.hash === current) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}

window.addEventListener("hashchange", markCurrentSection);
markCurrentSection();

const turn = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: "up", ArrowDown: "down" };
mount.addEventListener("keydown", (event) => {
  if (!scene || !(event.key in turn)) return;
  event.preventDefault();
  scene.nudge(turn[event.key]);
});

startScene();
startBackground();
