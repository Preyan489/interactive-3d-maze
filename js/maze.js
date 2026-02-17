/**
 * maze.js – Maze structure and 3D geometry
 * 1) Generate the maze (2D grid by rows × columns).
 * 2) Build 3D meshes for walls and floors from that grid.
 * Maze is represented and managed as a 2D grid; 3D geometry is built deterministically from it.
 */

import * as THREE from 'three';

const ROWS = 15;
const COLS = 15;
const CELL_SIZE = 2;

/** @type {Array<Array<{visited: boolean, walls: {N: boolean, E: boolean, S: boolean, W: boolean}}>>} */
let cells = [];
/** @type {THREE.Group} Group containing all wall and floor meshes */
let mazeGroup = null;
let scene = null;

// Simple seeded random number generator
class SeededRandom {
  constructor(seed = Date.now()) {
    this.seed = seed;
  }

  random() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  randomInt(min, max) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }
}

/**
 * Initialize all cells with all walls and unvisited.
 */
function initializeCells() {
  const cellGrid = [];
  for (let r = 0; r < ROWS; r++) {
    cellGrid.push([]);
    for (let c = 0; c < COLS; c++) {
      cellGrid[r].push({
        visited: false,
        walls: {
          N: true,  // North wall
          E: true,  // East wall
          S: true,  // South wall
          W: true   // West wall
        }
      });
    }
  }
  return cellGrid;
}

/**
 * Get unvisited neighbors of a cell.
 * @param {number} r - Row
 * @param {number} c - Column
 * @param {Array<Array>} grid - Cell grid
 * @returns {Array<{r: number, c: number, dir: string}>} Array of neighbor info
 */
function getUnvisitedNeighbors(r, c, grid) {
  const neighbors = [];
  
  // North neighbor
  if (r > 0 && !grid[r - 1][c].visited) {
    neighbors.push({ r: r - 1, c: c, dir: 'N' });
  }
  // East neighbor
  if (c < COLS - 1 && !grid[r][c + 1].visited) {
    neighbors.push({ r: r, c: c + 1, dir: 'E' });
  }
  // South neighbor
  if (r < ROWS - 1 && !grid[r + 1][c].visited) {
    neighbors.push({ r: r + 1, c: c, dir: 'S' });
  }
  // West neighbor
  if (c > 0 && !grid[r][c - 1].visited) {
    neighbors.push({ r: r, c: c - 1, dir: 'W' });
  }
  
  return neighbors;
}

/**
 * Remove wall between two adjacent cells.
 * @param {number} r1 - Row of first cell
 * @param {number} c1 - Column of first cell
 * @param {number} r2 - Row of second cell
 * @param {number} c2 - Column of second cell
 * @param {Array<Array>} grid - Cell grid
 */
function removeWallBetween(r1, c1, r2, c2, grid) {
  const cell1 = grid[r1][c1];
  const cell2 = grid[r2][c2];
  
  // Determine direction from cell1 to cell2
  if (r2 < r1) {
    // cell2 is north of cell1
    cell1.walls.N = false;
    cell2.walls.S = false;
  } else if (r2 > r1) {
    // cell2 is south of cell1
    cell1.walls.S = false;
    cell2.walls.N = false;
  } else if (c2 > c1) {
    // cell2 is east of cell1
    cell1.walls.E = false;
    cell2.walls.W = false;
  } else if (c2 < c1) {
    // cell2 is west of cell1
    cell1.walls.W = false;
    cell2.walls.E = false;
  }
}

/**
 * Generate maze using DFS recursive backtracker algorithm.
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @param {number} seed - Optional seed for random number generation
 * @returns {Array<Array>} Generated cell grid
 */
export function generateMaze(rows = ROWS, cols = COLS, seed = null) {
  const rng = new SeededRandom(seed);
  
  // Initialize all cells with all walls
  const cellGrid = initializeCells();
  
  // Pick start cell (0,0) or random
  const startR = seed !== null ? rng.randomInt(0, rows - 1) : 0;
  const startC = seed !== null ? rng.randomInt(0, cols - 1) : 0;
  
  // Mark start cell as visited
  cellGrid[startR][startC].visited = true;
  
  // Stack for backtracking
  const stack = [{ r: startR, c: startC }];
  
  // DFS algorithm
  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = getUnvisitedNeighbors(current.r, current.c, cellGrid);
    
    if (neighbors.length > 0) {
      // Choose a random unvisited neighbor
      const randomIndex = rng.randomInt(0, neighbors.length - 1);
      const neighbor = neighbors[randomIndex];
      
      // Remove the wall between current and neighbor
      removeWallBetween(current.r, current.c, neighbor.r, neighbor.c, cellGrid);
      
      // Mark neighbor as visited
      cellGrid[neighbor.r][neighbor.c].visited = true;
      
      // Push current cell to stack
      stack.push({ r: neighbor.r, c: neighbor.c });
    } else {
      // No unvisited neighbors: pop from stack and continue
      stack.pop();
    }
  }
  
  // Ensure border walls are always kept
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cellGrid[r][c];
      // North border
      if (r === 0) cell.walls.N = true;
      // South border
      if (r === rows - 1) cell.walls.S = true;
      // West border
      if (c === 0) cell.walls.W = true;
      // East border
      if (c === cols - 1) cell.walls.E = true;
      
      // Reset visited flags for future use
      cell.visited = false;
    }
  }
  
  return cellGrid;
}

/**
 * Build 3D meshes from the current cell grid and add to scene.
 * Coordinate mapping: cell (r, c) maps to world position (x = c * cellSize, z = r * cellSize).
 */
function buildMeshes(scene) {
  if (mazeGroup) scene.remove(mazeGroup);
  mazeGroup = new THREE.Group();

  const cellSize = CELL_SIZE;
  const wallHeight = 2;
  const wallThickness = 0.1;

  // Material for walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF }); // White for walls
  // Material for floor
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x333355 }); // Dark blue-gray for floor

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = cells[r][c];
      // Coordinate mapping: x = c * cellSize, z = r * cellSize
      const x = c * cellSize;
      const z = r * cellSize;

      // Add floor for every cell
      const floorGeo = new THREE.PlaneGeometry(cellSize, cellSize);
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(x + cellSize / 2, 0, z + cellSize / 2);
      floor.receiveShadow = true;
      mazeGroup.add(floor);

      // Add walls based on cell wall flags
      // North wall (top edge of cell)
      if (cell.walls.N) {
        const northWall = new THREE.Mesh(
          new THREE.BoxGeometry(cellSize, wallHeight, wallThickness),
          wallMat
        );
        northWall.position.set(x + cellSize / 2, wallHeight / 2, z);
        northWall.castShadow = true;
        northWall.receiveShadow = true;
        mazeGroup.add(northWall);
      }

      // East wall (right edge of cell)
      if (cell.walls.E) {
        const eastWall = new THREE.Mesh(
          new THREE.BoxGeometry(wallThickness, wallHeight, cellSize),
          wallMat
        );
        eastWall.position.set(x + cellSize, wallHeight / 2, z + cellSize / 2);
        eastWall.castShadow = true;
        eastWall.receiveShadow = true;
        mazeGroup.add(eastWall);
      }

      // South wall (bottom edge of cell)
      if (cell.walls.S) {
        const southWall = new THREE.Mesh(
          new THREE.BoxGeometry(cellSize, wallHeight, wallThickness),
          wallMat
        );
        southWall.position.set(x + cellSize / 2, wallHeight / 2, z + cellSize);
        southWall.castShadow = true;
        southWall.receiveShadow = true;
        mazeGroup.add(southWall);
      }

      // West wall (left edge of cell)
      if (cell.walls.W) {
        const westWall = new THREE.Mesh(
          new THREE.BoxGeometry(wallThickness, wallHeight, cellSize),
          wallMat
        );
        westWall.position.set(x, wallHeight / 2, z + cellSize / 2);
        westWall.castShadow = true;
        westWall.receiveShadow = true;
        mazeGroup.add(westWall);
      }
    }
  }

  scene.add(mazeGroup);
}

/**
 * Initialize maze: generate cell grid and build meshes.
 * @param {THREE.Scene} scn
 */
export function initMaze(scn) {
  scene = scn;
  cells = generateMaze();
  buildMeshes(scene);
}

/**
 * Regenerate the maze with optional seed.
 * @param {number} seed - Optional seed for random generation
 */
export function regenerateMaze(seed = null) {
  cells = generateMaze(ROWS, COLS, seed);
  buildMeshes(scene);
  
  // Reposition player at entrance
  const entrancePos = getMazeEntrancePosition();
  return entrancePos;
}

/**
 * Return the group of wall/floor meshes (for collision and rendering).
 * @returns {THREE.Group}
 */
export function getMazeMeshes() {
  return mazeGroup;
}

/**
 * Return the current cell grid (rows × columns).
 * @returns {Array<Array<{visited: boolean, walls: {N: boolean, E: boolean, S: boolean, W: boolean}}>>}
 */
export function getGrid() {
  return cells;
}

export function getRows() {
  return ROWS;
}
export function getCols() {
  return COLS;
}

/**
 * Find the maze entrance (first cell with at least one open wall, typically top-left).
 * Returns the 3D world position of the cell center.
 * Coordinate mapping: x = c * cellSize, z = r * cellSize
 * @returns {{ x: number, z: number }}
 */
export function getMazeEntrancePosition() {
  // Return position of cell (0,0) - the start cell
  // Return center of cell: x = c * cellSize + cellSize/2, z = r * cellSize + cellSize/2
  const x = 0 * CELL_SIZE + CELL_SIZE / 2;
  const z = 0 * CELL_SIZE + CELL_SIZE / 2;
  return { x, z };
}
