/**
 * collision.js – Collision detection
 * Player = capsule (position + radius). Walls = AABBs.
 * Resolves player position against wall AABBs.
 */

import * as THREE from 'three';

const PLAYER_RADIUS = 0.3;
const PLAYER_HEIGHT = 1.6;

/** @type {{ position: THREE.Vector3, radius: number, yaw: number, pitch: number }} */
const playerBody = {
  position: new THREE.Vector3(0, PLAYER_HEIGHT / 2, 0),
  radius: PLAYER_RADIUS,
  yaw: 0,
  pitch: 0
};

let getMazeMeshes = null;

/**
 * Initialize collision: store reference to maze meshes.
 * @param {() => THREE.Group} getMeshes
 */
export function initCollision(getMeshes) {
  getMazeMeshes = getMeshes;
}

/**
 * Get the player body (position, radius, yaw, pitch). Mutable.
 * @returns {{ position: THREE.Vector3, radius: number, yaw: number, pitch: number }}
 */
export function getPlayerBody() {
  return playerBody;
}

/**
 * Set resolved player position (called by collision after resolving vs walls).
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
export function setPlayerPosition(x, y, z) {
  playerBody.position.set(x, y, z);
}

/**
 * Get AABB for a wall mesh (Box3 from geometry).
 * @param {THREE.Mesh} mesh
 * @returns {THREE.Box3}
 */
function getAABB(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  return box;
}

/**
 * Resolve capsule (cylinder) vs AABB. Simplified: treat player as sphere at feet and at head.
 * Stub: push position out of each wall AABB.
 */
function resolveVsAABB(pos, radius, box) {
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const hx = (box.max.x - box.min.x) / 2 + radius;
  const hz = (box.max.z - box.min.z) / 2 + radius;
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) return;
  const ax = hx - Math.abs(dx);
  const az = hz - Math.abs(dz);
  if (ax < az) pos.x += dx > 0 ? ax : -ax;
  else pos.z += dz > 0 ? az : -az;
}

/**
 * Update: resolve player position against all wall AABBs.
 * @param {{ position: THREE.Vector3, radius: number }} body
 * @param {THREE.Group} mazeGroup
 */
export function updateCollision(body, mazeGroup) {
  if (!getMazeMeshes || !mazeGroup) return;
  const group = mazeGroup;
  group.traverse((obj) => {
    if (obj.isMesh && obj.geometry?.type === 'BoxGeometry') {
      const box = getAABB(obj);
      resolveVsAABB(body.position, body.radius, box);
    }
  });
}
