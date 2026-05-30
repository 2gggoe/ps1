import * as THREE from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { CameraFollow } from "./cameraFollow.js";
import { CharacterController } from "./characterController.js";
import { Collectibles, TOTAL_COLLECTIBLES } from "./collectibles.js";
import { createUI } from "./ui.js";

const canvas = document.querySelector("#scene");
const ui = createUI(TOTAL_COLLECTIBLES);
window.__demoDebug = {
  status: "booting",
  frames: 0,
  triangles: 0,
  calls: 0,
};
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070604);
scene.fog = new THREE.Fog(0x070604, 3.6, 7.4);

const camera = new THREE.PerspectiveCamera(
  54,
  window.innerWidth / window.innerHeight,
  0.01,
  40,
);

const ambient = new THREE.HemisphereLight(0xffefba, 0x1f140b, 1.65);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffd27a, 2.1);
keyLight.position.set(-2.5, 3.2, 1.8);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x58b7e7, 0.65);
fillLight.position.set(2.2, 1.2, -2.0);
scene.add(fillLight);

const loader = new GLTFLoader();
const clock = new THREE.Clock();
const keys = new Set();
const inputDirection = new THREE.Vector3();
const movementDirection = new THREE.Vector3();
const targetVelocity = new THREE.Vector3();
const currentVelocity = new THREE.Vector3();
const nextPosition = new THREE.Vector3();
const cameraForward = new THREE.Vector3();
const cameraRight = new THREE.Vector3();

let character;
let controller;
let cameraFollow;
let collectibles;
let controlsEnabled = false;
let gameState = "loading";

const CHARACTER_FLOOR_OFFSET = 0.18;
const startPosition = new THREE.Vector3(-2.22, CHARACTER_FLOOR_OFFSET, 0.2);
const bounds = {
  minX: -2.42,
  maxX: 1.72,
  minZ: -1.72,
  maxZ: 1.84,
};
const PLAYER_SPEED = 0.86;
const LOOK_SENSITIVITY = 0.006;

function loadModel(url) {
  return loader.loadAsync(url);
}

function prepModel(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.frustumCulled = false;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material) continue;
      material.side = THREE.FrontSide;
      material.toneMapped = true;

      for (const key of ["map", "emissiveMap", "normalMap", "roughnessMap", "metalnessMap"]) {
        const texture = material[key];
        if (!texture) continue;
        texture.colorSpace = key === "map" || key === "emissiveMap"
          ? THREE.SRGBColorSpace
          : THREE.NoColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestMipmapNearestFilter;
        texture.generateMipmaps = true;
      }
    }
  });
}

function setupInput() {
  window.addEventListener("keydown", (event) => {
    if (isMovementKey(event.code)) {
      event.preventDefault();
    }
    keys.add(event.code);
  });

  window.addEventListener("keyup", (event) => {
    if (isMovementKey(event.code)) {
      event.preventDefault();
    }
    keys.delete(event.code);
  });
}

function isMovementKey(code) {
  return [
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowLeft",
    "ArrowDown",
    "ArrowRight",
  ].includes(code);
}

function readInput() {
  inputDirection.set(0, 0, 0);

  if (keys.has("KeyW") || keys.has("ArrowUp")) inputDirection.z -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) inputDirection.z += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) inputDirection.x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) inputDirection.x += 1;

  inputDirection.x += ui.joystickVector.x;
  inputDirection.z += ui.joystickVector.z;

  if (inputDirection.lengthSq() > 1) {
    inputDirection.normalize();
  }

  return inputDirection;
}

function getMoveDirection(input, target) {
  if (!cameraFollow || input.lengthSq() < 0.003) {
    return target.set(0, 0, 0);
  }

  cameraFollow.getForward(cameraForward);
  cameraRight.set(-cameraForward.z, 0, cameraForward.x).normalize();

  target
    .set(0, 0, 0)
    .addScaledVector(cameraForward, -input.z)
    .addScaledVector(cameraRight, input.x);

  if (target.lengthSq() > 0.0001) {
    target.normalize();
  }

  return target;
}

function dampAngle(current, target, smoothing, delta) {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-smoothing * delta));
}

function clampToLevel(position) {
  position.x = THREE.MathUtils.clamp(position.x, bounds.minX, bounds.maxX);
  position.z = THREE.MathUtils.clamp(position.z, bounds.minZ, bounds.maxZ);
  position.y = startPosition.y;
}

function startIntro() {
  ui.hideLoading();
  gameState = "intro_standup";
  window.__demoDebug.status = gameState;
  controller.playIntro(() => {
    controlsEnabled = true;
    gameState = "idle_ready";
    window.__demoDebug.status = gameState;
    ui.setMission("Collect all ice creams");
  });
}

function handleCollect(count, total) {
  ui.updateCounter(count);
  if (count >= total) {
    controlsEnabled = false;
    currentVelocity.set(0, 0, 0);
    targetVelocity.set(0, 0, 0);
    controller.setWalking(false);
    gameState = "win";
    window.__demoDebug.status = gameState;
    ui.showWin();
  }
}

async function init() {
  setupInput();
  ui.bindRestart(() => window.location.reload());

  ui.setLoading("Loading level");
  const [levelGltf, characterGltf, icecreamGltf] = await Promise.all([
    loadModel("./public/models/level.glb"),
    loadModel("./public/models/character.glb"),
    loadModel("./public/models/icecream.glb"),
  ]);

  ui.setLoading("Preparing scene");
  prepModel(levelGltf.scene);
  prepModel(characterGltf.scene);
  prepModel(icecreamGltf.scene);

  const level = levelGltf.scene;
  scene.add(level);

  character = characterGltf.scene;
  character.position.copy(startPosition);
  character.rotation.y = Math.PI;
  scene.add(character);

  controller = new CharacterController(character, characterGltf.animations);
  cameraFollow = new CameraFollow(camera, character);
  cameraFollow.snap();

  collectibles = new Collectibles(scene, icecreamGltf.scene);
  window.__demoDebug = {
    ...window.__demoDebug,
    status: "ready",
    animations: characterGltf.animations.map((clip) => clip.name),
    sceneChildren: scene.children.length,
    collectibles: TOTAL_COLLECTIBLES,
  };
  ui.updateCounter(0);
  ui.showReady(startIntro);
  gameState = "ready";
  animate();
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.04);
  const lookDelta = ui.consumeLookDelta();
  if (cameraFollow && controlsEnabled && Math.abs(lookDelta.x) > 0.01) {
    cameraFollow.rotateYaw(-lookDelta.x * LOOK_SENSITIVITY);
  }

  const input = readInput();
  const hasInput = controlsEnabled && input.lengthSq() > 0.003;
  const inputAmount = THREE.MathUtils.clamp(input.length(), 0, 1);

  getMoveDirection(input, movementDirection);
  targetVelocity
    .copy(movementDirection)
    .multiplyScalar(hasInput ? PLAYER_SPEED * inputAmount : 0);
  currentVelocity.lerp(targetVelocity, 1 - Math.exp(-10 * delta));

  const speed = currentVelocity.length();
  const isMoving = speed > 0.01;

  if (isMoving) {
    movementDirection.copy(currentVelocity).normalize();
    nextPosition.copy(character.position).addScaledVector(currentVelocity, delta);
    clampToLevel(nextPosition);
    character.position.copy(nextPosition);

    const targetYaw = Math.atan2(movementDirection.x, movementDirection.z);
    character.rotation.y = dampAngle(
      character.rotation.y,
      targetYaw,
      10,
      delta,
    );
  }

  if (controller) {
    controller.setMoveAmount(speed / PLAYER_SPEED);
    controller.update(delta);
  }

  if (collectibles && gameState !== "win") {
    collectibles.update(delta, character.position, handleCollect);
  }

  if (cameraFollow) {
    cameraFollow.update(delta);
  }

  renderer.render(scene, camera);
  window.__demoDebug.frames += 1;
  window.__demoDebug.triangles = renderer.info.render.triangles;
  window.__demoDebug.calls = renderer.info.render.calls;
  window.__demoDebug.position = character
    ? {
        x: Number(character.position.x.toFixed(3)),
        y: Number(character.position.y.toFixed(3)),
        z: Number(character.position.z.toFixed(3)),
      }
    : null;
  window.__demoDebug.speed = Number(speed.toFixed(3));
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init().catch((error) => {
  console.error(error);
  ui.setLoading("Scene failed to load");
});
