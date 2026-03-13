/**
 * main.js – Core application logic
 * Bootstraps the 3D scene (rendering context, scene graph) and main render loop.
 */

import * as THREE from 'three';
import {
  initMaze,
  getMazeMeshes,
  getMazeEntrancePosition,
  getMazeExitPosition,
  getCellSize,
  getCurrentTheme,
  getMazeStats,
  getThemeOptions,
  regenerateMaze,
  setMazeTheme
} from './maze.js';
import { initControls, updateControls } from './controls.js';
import { initCollision, getPlayerBody, updateCollision, setPlayerPosition } from './collision.js';
import { initMinimap, updateMinimap } from './minimap.js';

// --- Scene setup ---
const canvas = document.getElementById('glCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(95, window.innerWidth / window.innerHeight, 0.1, 1000);
const winDistance = getCellSize() * 0.35;
let hasWon = false;
let directionalLight = null;
let hemisphereLight = null;
let elapsedTime = 0;
let lastScore = 0;

const status = document.createElement('div');
status.style.position = 'absolute';
status.style.left = '50%';
status.style.top = '24px';
status.style.transform = 'translateX(-50%)';
status.style.padding = '10px 14px';
status.style.fontFamily = 'monospace';
status.style.fontSize = '14px';
status.style.color = '#ffffff';
status.style.background = 'rgba(0, 0, 0, 0.55)';
status.style.border = '1px solid rgba(255, 255, 255, 0.3)';
status.style.borderRadius = '8px';
status.style.backdropFilter = 'blur(6px)';
status.textContent = 'Reach the green exit tile';
document.body.appendChild(status);

const scorePanel = document.createElement('div');
scorePanel.style.position = 'absolute';
scorePanel.style.right = '16px';
scorePanel.style.bottom = '16px';
scorePanel.style.minWidth = '220px';
scorePanel.style.padding = '12px';
scorePanel.style.background = 'rgba(0, 0, 0, 0.52)';
scorePanel.style.border = '1px solid rgba(255, 255, 255, 0.18)';
scorePanel.style.borderRadius = '10px';
scorePanel.style.fontFamily = 'monospace';
scorePanel.style.color = '#ffffff';
scorePanel.style.lineHeight = '1.45';

const timerLine = document.createElement('div');
const difficultyLine = document.createElement('div');
const scoreLine = document.createElement('div');
scorePanel.appendChild(timerLine);
scorePanel.appendChild(difficultyLine);
scorePanel.appendChild(scoreLine);
document.body.appendChild(scorePanel);

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x1a1a2e);

// --- Enable shadows ---
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x1c1c1c, 0.7);
scene.add(hemisphereLight);

directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
// Configure shadow camera
directionalLight.shadow.camera.left = -20;
directionalLight.shadow.camera.right = 20;
directionalLight.shadow.camera.top = 20;
directionalLight.shadow.camera.bottom = -20;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.bias = -0.0003;
scene.add(directionalLight);

const themePanel = document.createElement('div');
themePanel.style.position = 'absolute';
themePanel.style.left = '16px';
themePanel.style.top = '16px';
themePanel.style.padding = '12px';
themePanel.style.background = 'rgba(0, 0, 0, 0.48)';
themePanel.style.border = '1px solid rgba(255, 255, 255, 0.18)';
themePanel.style.borderRadius = '10px';
themePanel.style.fontFamily = 'monospace';
themePanel.style.color = '#ffffff';

const themeLabel = document.createElement('label');
themeLabel.textContent = 'Theme';
themeLabel.style.display = 'block';
themeLabel.style.marginBottom = '6px';

const themeSelect = document.createElement('select');
themeSelect.style.width = '180px';
themeSelect.style.padding = '8px 10px';
themeSelect.style.borderRadius = '8px';
themeSelect.style.border = '1px solid rgba(255, 255, 255, 0.2)';
themeSelect.style.background = 'rgba(18, 18, 18, 0.92)';
themeSelect.style.color = '#ffffff';

for (const option of getThemeOptions()) {
  const element = document.createElement('option');
  element.value = option.id;
  element.textContent = option.name;
  themeSelect.appendChild(element);
}

themeSelect.value = getCurrentTheme().id;
themeSelect.addEventListener('change', () => {
  if (!setMazeTheme(themeSelect.value)) return;
  applyThemeVisuals();
  status.textContent = `Theme: ${themeSelect.options[themeSelect.selectedIndex].text}. Press R for a new maze.`;
});

const themeHint = document.createElement('div');
themeHint.style.marginTop = '8px';
themeHint.style.fontSize = '12px';
themeHint.style.opacity = '0.8';
themeHint.textContent = 'Themes update instantly. Press R for a new layout.';

themePanel.appendChild(themeLabel);
themePanel.appendChild(themeSelect);
themePanel.appendChild(themeHint);
document.body.appendChild(themePanel);

// --- Timing ---
const clock = new THREE.Clock();

// --- Bootstrap modules (maze → controls → collision → minimap) ---
initMaze(scene);
initCollision(getMazeMeshes);
initControls(camera, canvas, getPlayerBody, setPlayerPosition);
initMinimap(scene, camera);
applyThemeVisuals();

// --- Position camera at maze entrance ---
const entrancePos = getMazeEntrancePosition();
camera.position.set(entrancePos.x, 1.6, entrancePos.z); // Eye height = 1.6
setPlayerPosition(entrancePos.x, 1.6, entrancePos.z);

// --- Main render loop ---
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta(); // Use clock for consistent movement
  if (!hasWon) elapsedTime += dt;
  updateControls(dt);
  const playerBody = getPlayerBody();
  updateCollision(playerBody, getMazeMeshes());
  camera.position.copy(playerBody.position);
  updateMinimap(playerBody);
  updateScorePanel();
  checkForWin(playerBody);
  renderer.render(scene, camera);
}
animate();

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// --- Regenerate maze on 'R' key press ---
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    const entrancePos = regenerateMaze();
    // Reposition camera and player at entrance
    camera.position.set(entrancePos.x, 1.6, entrancePos.z);
    setPlayerPosition(entrancePos.x, 1.6, entrancePos.z);
    resetRunState();
    // Reset player rotation
    const body = getPlayerBody();
    if (body) {
      body.yaw = 0;
      body.pitch = 0;
    }
  }
});

function checkForWin(playerBody) {
  if (!playerBody || hasWon) return;

  const exitPos = getMazeExitPosition();
  const distanceToExit = Math.hypot(
    playerBody.position.x - exitPos.x,
    playerBody.position.z - exitPos.z
  );

  if (distanceToExit <= winDistance) {
    hasWon = true;
    lastScore = calculateScore();
    status.textContent = `Escaped in ${formatTime(elapsedTime)}. Score ${lastScore}. Press R to restart.`;
  }
}

function applyThemeVisuals() {
  const theme = getCurrentTheme();
  scene.background = new THREE.Color(theme.background);
  scene.fog = new THREE.Fog(theme.fog, 8, 32);
  ambientLight.color.setHex(theme.ambient);
  hemisphereLight.color.setHex(theme.hemisphereSky);
  hemisphereLight.groundColor.setHex(theme.hemisphereGround);
  directionalLight.color.setHex(theme.sun);
}

function resetRunState() {
  hasWon = false;
  elapsedTime = 0;
  lastScore = 0;
  status.textContent = 'Reach the green exit tile';
  updateScorePanel();
}

function updateScorePanel() {
  const stats = getMazeStats();
  const liveScore = hasWon ? lastScore : calculateScore();
  timerLine.textContent = `Time: ${formatTime(elapsedTime)}`;
  difficultyLine.textContent = stats
    ? `Difficulty: ${stats.complexity} | Path ${stats.solutionLength}`
    : 'Difficulty: calculating';
  scoreLine.textContent = `Score: ${liveScore}`;
}

function calculateScore() {
  const stats = getMazeStats();
  if (!stats) return 0;

  const timePenalty = Math.floor(elapsedTime * 7);
  const rawScore =
    stats.complexity * 10 +
    stats.solutionLength * 30 +
    stats.branchCells * 45 +
    stats.deadEnds * 20 -
    timePenalty;

  return Math.max(100, rawScore);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((totalSeconds % 1) * 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}
