/**
 * minimap.js – Top-down minimap render
 * Second camera + second viewport for top-down minimap visualization.
 */

import * as THREE from 'three';
import { getRows, getCols, getCellSize, getMinimapLayer } from './maze.js';

let minimapCamera = null;
let minimapRenderer = null;
let minimapCanvas = null;
let minimapContainer = null;
let scene = null;
let mazeWidth = 0;
let mazeHeight = 0;
let playerMarker = null;
let minimapBounds = null;

/**
 * Initialize minimap: create second camera and viewport.
 * @param {THREE.Scene} scn
 * @param {THREE.PerspectiveCamera} mainCamera
 */
export function initMinimap(scn, mainCamera) {
  scene = scn;

  minimapContainer = document.createElement('div');
  minimapContainer.style.position = 'absolute';
  minimapContainer.style.top = '10px';
  minimapContainer.style.right = '10px';
  minimapContainer.style.width = '200px';
  minimapContainer.style.height = '200px';
  minimapContainer.style.border = '2px solid rgba(255, 255, 255, 0.92)';
  minimapContainer.style.background = '#020304';
  minimapContainer.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.48), inset 0 0 0 1px rgba(255, 255, 255, 0.08)';
  minimapContainer.style.borderRadius = '12px';
  minimapContainer.style.boxSizing = 'border-box';
  minimapContainer.style.overflow = 'hidden';
  document.body.appendChild(minimapContainer);

  // Create a second canvas for the minimap
  minimapCanvas = document.createElement('canvas');
  minimapCanvas.id = 'minimapCanvas';
  minimapCanvas.style.display = 'block';
  minimapCanvas.style.width = '100%';
  minimapCanvas.style.height = '100%';
  minimapContainer.appendChild(minimapCanvas);

  playerMarker = document.createElement('div');
  playerMarker.style.position = 'absolute';
  playerMarker.style.width = '11px';
  playerMarker.style.height = '11px';
  playerMarker.style.left = '0';
  playerMarker.style.top = '0';
  playerMarker.style.transform = 'translate(-50%, -50%)';
  playerMarker.style.pointerEvents = 'none';
  playerMarker.style.zIndex = '3';

  const markerOuter = document.createElement('div');
  markerOuter.style.position = 'absolute';
  markerOuter.style.inset = '0';
  markerOuter.style.borderRadius = '50%';
  markerOuter.style.background = '#000';
  playerMarker.appendChild(markerOuter);

  const markerInner = document.createElement('div');
  markerInner.style.position = 'absolute';
  markerInner.style.inset = '1px';
  markerInner.style.borderRadius = '50%';
  markerInner.style.background = '#fff';
  playerMarker.appendChild(markerInner);

  const markerDot = document.createElement('div');
  markerDot.style.position = 'absolute';
  markerDot.style.inset = '2px';
  markerDot.style.borderRadius = '50%';
  markerDot.style.background = '#ff0000';
  markerDot.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.8)';
  playerMarker.appendChild(markerDot);

  minimapContainer.appendChild(playerMarker);

  // Create orthographic camera for top-down view
  // Calculate bounds to show full maze
  const rows = getRows();
  const cols = getCols();
  const cellSize = getCellSize();
  mazeWidth = cols * cellSize;
  mazeHeight = rows * cellSize;
  const margin = 2; // Small margin around maze
  const halfSpan = Math.max(mazeWidth, mazeHeight) / 2 + margin;
  const centerX = mazeWidth / 2;
  const centerZ = mazeHeight / 2;
  minimapBounds = {
    minX: centerX - halfSpan,
    maxX: centerX + halfSpan,
    minZ: centerZ - halfSpan,
    maxZ: centerZ + halfSpan
  };

  minimapCamera = new THREE.OrthographicCamera(
    -halfSpan, halfSpan,
    halfSpan, -halfSpan,
    0.1, 100
  );
  minimapCamera.position.set(centerX, 30, centerZ);
  minimapCamera.lookAt(centerX, 0, centerZ);
  minimapCamera.layers.disable(0);
  minimapCamera.layers.enable(1);
  minimapCamera.layers.enable(getMinimapLayer());

  // Create renderer for minimap
  minimapRenderer = new THREE.WebGLRenderer({ canvas: minimapCanvas, antialias: true });
  minimapRenderer.setSize(200, 200);
  minimapRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  minimapRenderer.setClearColor(0x020304);

}

/**
 * Update minimap: render from top-down view.
 * @param {{ position: THREE.Vector3 }} playerBody
 */
export function updateMinimap(playerBody) {
  if (!minimapRenderer || !minimapCamera || !playerBody || !scene) return;

  updatePlayerMarker(playerBody);

  // Render minimap
  minimapRenderer.render(scene, minimapCamera);
}

function updatePlayerMarker(playerBody) {
  if (!playerMarker || !playerBody || !minimapContainer || !minimapBounds) return;

  const markerRadius = 5;
  const containerWidth = minimapContainer.clientWidth;
  const containerHeight = minimapContainer.clientHeight;
  const normalizedX =
    (playerBody.position.x - minimapBounds.minX) /
    (minimapBounds.maxX - minimapBounds.minX);
  const normalizedZ =
    (playerBody.position.z - minimapBounds.minZ) /
    (minimapBounds.maxZ - minimapBounds.minZ);
  const rawX = normalizedX * containerWidth;
  const rawZ = normalizedZ * containerHeight;
  const clampedX = THREE.MathUtils.clamp(rawX, markerRadius, containerWidth - markerRadius);
  const clampedZ = THREE.MathUtils.clamp(rawZ, markerRadius, containerHeight - markerRadius);

  playerMarker.style.left = `${clampedX}px`;
  playerMarker.style.top = `${clampedZ}px`;
  playerMarker.style.transform = 'translate(-50%, -50%)';
}
