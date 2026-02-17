/**
 * controls.js – Player input
 * WASD movement, mouse look, pointer lock.
 * Player view is the camera; movement updates the player body position (see collision.js).
 */

import * as THREE from 'three';

let camera = null;
let canvas = null;
let getPlayerBody = null;
let setPlayerPosition = null;

const keys = { w: false, a: false, s: false, d: false };
const moveSpeed = 5;
const lookSensitivity = 0.002;

/**
 * Initialize controls: pointer lock and input listeners.
 * @param {THREE.PerspectiveCamera} cam
 * @param {HTMLCanvasElement} can
 * @param {() => { position: THREE.Vector3, yaw: number, pitch: number }} getBody
 * @param {(x: number, y: number, z: number) => void} setPosition
 */
export function initControls(cam, can, getBody, setPosition) {
  camera = cam;
  canvas = can;
  getPlayerBody = getBody;
  setPlayerPosition = setPosition;

  canvas.addEventListener('click', () => canvas.requestPointerLock());
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas) return;
    document.addEventListener('mousemove', onMouseMove);
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) return;
    document.removeEventListener('mousemove', onMouseMove);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'w') keys.w = true;
    if (e.key === 'a') keys.a = true;
    if (e.key === 's') keys.s = true;
    if (e.key === 'd') keys.d = true;
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'w') keys.w = false;
    if (e.key === 'a') keys.a = false;
    if (e.key === 's') keys.s = false;
    if (e.key === 'd') keys.d = false;
  });
}

function onMouseMove(e) {
  const body = getPlayerBody();
  if (!body) return;
  body.yaw -= e.movementX * lookSensitivity;
  body.pitch -= e.movementY * lookSensitivity;
  body.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, body.pitch));
}

/**
 * Apply WASD to player position and sync camera to body.
 * @param {number} dt
 */
export function updateControls(dt) {
  const body = getPlayerBody();
  if (!body || !setPlayerPosition) return;

  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), body.yaw);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), body.yaw);
  forward.y = 0;
  right.y = 0;
  forward.normalize();
  right.normalize();

  const dx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const dz = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  const move = right.multiplyScalar(dx * moveSpeed * dt).add(forward.multiplyScalar(dz * moveSpeed * dt));
  const next = body.position.clone().add(move);

  setPlayerPosition(next.x, next.y, next.z);

  camera.position.copy(body.position);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = body.yaw;
  camera.rotation.x = body.pitch;
}
