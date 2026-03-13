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
 * Resolve capsule (cylinder) vs AABB. Simplified: treat player as sphere at feet and at head.
 * Push the player circle out of wall AABBs using closest-point resolution.
 */
function resolveVsAABB(pos, radius, box) {
  const closestX = THREE.MathUtils.clamp(pos.x, box.min.x, box.max.x);
  const closestZ = THREE.MathUtils.clamp(pos.z, box.min.z, box.max.z);
  let dx = pos.x - closestX;
  let dz = pos.z - closestZ;
  const distanceSq = dx * dx + dz * dz;

  if (distanceSq > 0 && distanceSq < radius * radius) {
    const distance = Math.sqrt(distanceSq);
    const push = radius - distance + 0.001;
    pos.x += (dx / distance) * push;
    pos.z += (dz / distance) * push;
    return;
  }

  if (distanceSq !== 0) return;

  const pushLeft = Math.abs(pos.x - box.min.x);
  const pushRight = Math.abs(box.max.x - pos.x);
  const pushTop = Math.abs(pos.z - box.min.z);
  const pushBottom = Math.abs(box.max.z - pos.z);
  const minPush = Math.min(pushLeft, pushRight, pushTop, pushBottom);

  if (minPush === pushLeft) pos.x = box.min.x - radius - 0.001;
  else if (minPush === pushRight) pos.x = box.max.x + radius + 0.001;
  else if (minPush === pushTop) pos.z = box.min.z - radius - 0.001;
  else pos.z = box.max.z + radius + 0.001;
}

/**
 * Update: resolve player position against all wall AABBs.
 * @param {{ position: THREE.Vector3, radius: number }} body
 * @param {THREE.Group} mazeGroup
 */
export function updateCollision(body, mazeGroup) {
  if (!getMazeMeshes || !mazeGroup) return;

  for (let i = 0; i < 3; i++) {
    mazeGroup.traverse((obj) => {
      if (!obj.isMesh || !obj.userData.isWall || !obj.userData.collisionBox) return;
      resolveVsAABB(body.position, body.radius, obj.userData.collisionBox);
    });
  }
}
