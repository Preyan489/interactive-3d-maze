/**
 * main.js – Core application logic
 * Bootstraps the 3D scene (rendering context, scene graph) and main render loop.
 */

import * as THREE from 'three';
import { initMaze, getMazeMeshes, getMazeEntrancePosition, regenerateMaze } from './maze.js';
import { initControls, updateControls } from './controls.js';
import { initCollision, getPlayerBody, updateCollision, setPlayerPosition } from './collision.js';
import { initMinimap, updateMinimap } from './minimap.js';

// --- Scene setup ---
const canvas = document.getElementById('glCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1a2e);

// --- Enable shadows ---
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Small intensity
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
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
scene.add(directionalLight);

// --- Timing ---
const clock = new THREE.Clock();

// --- Bootstrap modules (maze → controls → collision → minimap) ---
initMaze(scene);
initCollision(getMazeMeshes);
initControls(camera, canvas, getPlayerBody, setPlayerPosition);
initMinimap(scene, camera);

// --- Position camera at maze entrance ---
const entrancePos = getMazeEntrancePosition();
camera.position.set(entrancePos.x, 1.6, entrancePos.z); // Eye height = 1.6
setPlayerPosition(entrancePos.x, 1.6, entrancePos.z);

// --- Main render loop ---
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta(); // Use clock for consistent movement
  updateControls(dt);
  updateCollision(getPlayerBody(), getMazeMeshes());
  updateMinimap(getPlayerBody());
  renderer.render(scene, camera);
}
animate();

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Regenerate maze on 'R' key press ---
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    const entrancePos = regenerateMaze();
    // Reposition camera and player at entrance
    camera.position.set(entrancePos.x, 1.6, entrancePos.z);
    setPlayerPosition(entrancePos.x, 1.6, entrancePos.z);
    // Reset player rotation
    const body = getPlayerBody();
    if (body) {
      body.yaw = 0;
      body.pitch = 0;
    }
  }
});
