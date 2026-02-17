/**
 * minimap.js – Top-down minimap render
 * Second camera + second viewport for top-down minimap visualization.
 */

import * as THREE from 'three';
import { getRows, getCols } from './maze.js';

const CELL_SIZE = 2; // Should match maze.js

let minimapCamera = null;
let minimapRenderer = null;
let minimapCanvas = null;
let scene = null;

/**
 * Initialize minimap: create second camera and viewport.
 * @param {THREE.Scene} scn
 * @param {THREE.PerspectiveCamera} mainCamera
 */
export function initMinimap(scn, mainCamera) {
  scene = scn;
  
  // Create a second canvas for the minimap
  minimapCanvas = document.createElement('canvas');
  minimapCanvas.id = 'minimapCanvas';
  minimapCanvas.style.position = 'absolute';
  minimapCanvas.style.top = '10px';
  minimapCanvas.style.right = '10px';
  minimapCanvas.style.width = '200px';
  minimapCanvas.style.height = '200px';
  minimapCanvas.style.border = '2px solid white';
  document.body.appendChild(minimapCanvas);

  // Create orthographic camera for top-down view
  // Calculate bounds to show full maze
  const rows = getRows();
  const cols = getCols();
  const mazeWidth = cols * CELL_SIZE;
  const mazeHeight = rows * CELL_SIZE;
  const margin = 2; // Small margin around maze
  
  minimapCamera = new THREE.OrthographicCamera(
    -margin, mazeWidth + margin,
    mazeHeight + margin, -margin,
    0.1, 100
  );
  minimapCamera.position.set(mazeWidth / 2, 20, mazeHeight / 2);
  minimapCamera.lookAt(mazeWidth / 2, 0, mazeHeight / 2);

  // Create renderer for minimap
  minimapRenderer = new THREE.WebGLRenderer({ canvas: minimapCanvas, antialias: true });
  minimapRenderer.setSize(200, 200);
  minimapRenderer.setClearColor(0x000000);
}

/**
 * Update minimap: render from top-down view.
 * @param {{ position: THREE.Vector3 }} playerBody
 */
export function updateMinimap(playerBody) {
  if (!minimapRenderer || !minimapCamera || !playerBody || !scene) return;
  
  // Update camera position to follow player (top-down)
  minimapCamera.position.set(playerBody.position.x, 20, playerBody.position.z);
  minimapCamera.lookAt(playerBody.position.x, 0, playerBody.position.z);
  
  // Render minimap
  minimapRenderer.render(scene, minimapCamera);
}
