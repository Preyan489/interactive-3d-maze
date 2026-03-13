/**
 * maze.js – Maze structure and 3D geometry
 * 1) Generate the maze (2D grid by rows × columns).
 * 2) Build 3D meshes for walls and floors from that grid.
 * Maze is represented and managed as a 2D grid; 3D geometry is built deterministically from it.
 */

import * as THREE from 'three';

const ROWS = 11;
const COLS = 11;
const CELL_SIZE = 2;
const MINIMAP_LAYER = 2;
const THEME_DEFINITIONS = {
  jungle: {
    id: 'jungle',
    name: 'Jungle',
    background: 0x0b1c14,
    fog: 0x13261d,
    ambient: 0x7bc995,
    hemisphereSky: 0x9fe1a6,
    hemisphereGround: 0x1e2e1f,
    sun: 0xe1f7c8,
    wallBase: '#385a31',
    wallShade: '#243a22',
    wallAccent: '#6faa5d',
    floorBase: '#43582f',
    floorShade: '#2c3b21',
    floorAccent: '#7d6a3f',
    exit: 0xc5ff7a,
    minimapFloor: 0x050708,
    minimapWall: 0xf8fff4,
    minimapExit: 0xb7ff3c,
    wallRoughness: 0.95,
    floorRoughness: 1
  },
  ruins: {
    id: 'ruins',
    name: 'Desert Ruins',
    background: 0x2f2418,
    fog: 0x443324,
    ambient: 0xffd9a3,
    hemisphereSky: 0xf4d3a1,
    hemisphereGround: 0x5b3d24,
    sun: 0xfff1cc,
    wallBase: '#b68f5d',
    wallShade: '#8f6c42',
    wallAccent: '#e5c28b',
    floorBase: '#8a6a45',
    floorShade: '#6b5031',
    floorAccent: '#d5b47f',
    exit: 0x6fe5ff,
    minimapFloor: 0x050708,
    minimapWall: 0xfff6e8,
    minimapExit: 0x57e7ff,
    wallRoughness: 0.88,
    floorRoughness: 0.93
  },
  ice: {
    id: 'ice',
    name: 'Ice Cavern',
    background: 0x071520,
    fog: 0x102739,
    ambient: 0x9fdfff,
    hemisphereSky: 0xc8f0ff,
    hemisphereGround: 0x163447,
    sun: 0xf1fbff,
    wallBase: '#7fb4d3',
    wallShade: '#527996',
    wallAccent: '#d2f4ff',
    floorBase: '#5f8ea8',
    floorShade: '#3d6077',
    floorAccent: '#bce9ff',
    exit: 0x7affc6,
    minimapFloor: 0x050708,
    minimapWall: 0xf4fcff,
    minimapExit: 0x43ffb1,
    wallRoughness: 0.35,
    floorRoughness: 0.28
  }
};
let currentThemeId = 'jungle';

/** @type {Array<Array<{visited: boolean, walls: {N: boolean, E: boolean, S: boolean, W: boolean}}>>} */
let cells = [];
/** @type {THREE.Group} Group containing all wall and floor meshes */
let mazeGroup = null;
let scene = null;
let currentMazeStats = null;

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

function getCurrentThemeDefinition() {
  return THEME_DEFINITIONS[currentThemeId];
}

function getOpenNeighbors(r, c, grid) {
  const neighbors = [];
  const cell = grid[r][c];
  if (!cell.walls.N && r > 0) neighbors.push({ r: r - 1, c });
  if (!cell.walls.E && c < COLS - 1) neighbors.push({ r, c: c + 1 });
  if (!cell.walls.S && r < ROWS - 1) neighbors.push({ r: r + 1, c });
  if (!cell.walls.W && c > 0) neighbors.push({ r, c: c - 1 });
  return neighbors;
}

function computeMazeStats(grid) {
  const start = { r: 0, c: 0 };
  const exit = { r: ROWS - 1, c: COLS - 1 };
  const queue = [{ ...start, distance: 0 }];
  const visited = new Set(['0,0']);
  let solutionLength = 0;
  let branchCells = 0;
  let deadEnds = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const openings = getOpenNeighbors(r, c, grid).length;
      if (openings === 1) deadEnds += 1;
      if (openings >= 3) branchCells += 1;
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.r === exit.r && current.c === exit.c) {
      solutionLength = current.distance;
      break;
    }

    for (const neighbor of getOpenNeighbors(current.r, current.c, grid)) {
      const key = `${neighbor.r},${neighbor.c}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ ...neighbor, distance: current.distance + 1 });
    }
  }

  const complexity = Math.round(
    solutionLength * 12 +
    branchCells * 18 +
    deadEnds * 9 +
    (ROWS * COLS) / 2
  );

  return {
    rows: ROWS,
    cols: COLS,
    solutionLength,
    branchCells,
    deadEnds,
    complexity
  };
}

function createPatternTexture(type, theme) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = type === 'wall' ? theme.wallBase : theme.floorBase;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (type === 'wall') {
    for (let y = 0; y < canvas.height; y += 32) {
      ctx.strokeStyle = theme.wallShade;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    for (let x = 0; x < canvas.width; x += 42) {
      ctx.strokeStyle = theme.wallAccent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 10, canvas.height);
      ctx.stroke();
    }

    if (theme.id === 'jungle') {
      ctx.strokeStyle = 'rgba(188, 238, 143, 0.65)';
      ctx.lineWidth = 4;
      for (let i = 0; i < 9; i++) {
        const startX = 16 + i * 28;
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.bezierCurveTo(startX - 18, 54, startX + 22, 118, startX - 8, 190);
        ctx.stroke();
      }
    } else if (theme.id === 'ruins') {
      ctx.strokeStyle = 'rgba(90, 55, 26, 0.4)';
      ctx.lineWidth = 2;
      for (let y = 18; y < canvas.height; y += 48) {
        for (let x = ((y / 48) % 2) * 20; x < canvas.width; x += 40) {
          ctx.strokeRect(x, y, 36, 24);
        }
      }
    } else {
      ctx.strokeStyle = 'rgba(240, 252, 255, 0.75)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 11; i++) {
        const startX = 14 + i * 22;
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX + 16, 86);
        ctx.lineTo(startX - 12, 182);
        ctx.lineTo(startX + 10, 256);
        ctx.stroke();
      }
    }
  } else {
    for (let y = 0; y < canvas.height; y += 24) {
      for (let x = 0; x < canvas.width; x += 24) {
        const noise = (Math.sin(x * 0.17) + Math.cos(y * 0.11)) * 0.5 + 0.5;
        ctx.fillStyle = noise > 0.55 ? theme.floorAccent : theme.floorShade;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(x, y, 24, 24);
      }
    }
    ctx.globalAlpha = 1;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(type === 'wall' ? 1.3 : 2.2, type === 'wall' ? 1.8 : 2.2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createMazeMaterials(theme) {
  const wallMap = createPatternTexture('wall', theme);
  const floorMap = createPatternTexture('floor', theme);

  return {
    wallMat: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: wallMap,
      roughness: theme.wallRoughness,
      metalness: theme.id === 'ice' ? 0.12 : 0.02
    }),
    floorMat: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: floorMap,
      roughness: theme.floorRoughness,
      metalness: theme.id === 'ice' ? 0.08 : 0
    }),
    floorInsetMat: new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.floorAccent).multiplyScalar(0.9),
      roughness: theme.floorRoughness,
      metalness: 0
    }),
    wallCapMat: new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.wallAccent).multiplyScalar(1.1),
      roughness: Math.min(theme.wallRoughness + 0.05, 1),
      metalness: theme.id === 'ice' ? 0.05 : 0
    }),
    groundMat: new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.floorShade).multiplyScalar(0.55),
      roughness: 1,
      metalness: 0
    }),
    exitMat: new THREE.MeshStandardMaterial({
      color: theme.exit,
      emissive: theme.exit,
      emissiveIntensity: theme.id === 'ice' ? 0.75 : 0.5,
      roughness: 0.35,
      metalness: 0.05
    }),
    minimapFloorMat: new THREE.MeshBasicMaterial({ color: theme.minimapFloor }),
    minimapWallMat: new THREE.MeshBasicMaterial({ color: theme.minimapWall }),
    minimapExitMat: new THREE.MeshBasicMaterial({ color: theme.minimapExit })
  };
}

function addMinimapCell(group, x, z, cellSize, isExit, materials) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(cellSize, cellSize),
    isExit ? materials.minimapExitMat : materials.minimapFloorMat
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x + cellSize / 2, 0.06, z + cellSize / 2);
  floor.layers.set(MINIMAP_LAYER);
  group.add(floor);
}

function addWallSegment(group, orientation, center, size, wallHeight, materials) {
  const mainWall = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, wallHeight, size.z),
    materials.wallMat
  );
  mainWall.position.copy(center);
  mainWall.userData.isWall = true;
  mainWall.userData.collisionBox = new THREE.Box3().setFromCenterAndSize(center.clone(), new THREE.Vector3(size.x, wallHeight, size.z));
  mainWall.castShadow = true;
  mainWall.receiveShadow = true;
  group.add(mainWall);

  const capHeight = 0.14;
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(size.x + 0.05, capHeight, size.z + 0.05),
    materials.wallCapMat
  );
  cap.position.set(center.x, wallHeight + capHeight / 2 - 0.04, center.z);
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  const minimapWallHeight = 0.3;
  const minimapThickness = 0.34;
  const minimapWall = new THREE.Mesh(
    new THREE.BoxGeometry(
      orientation === 'horizontal' ? size.x : Math.max(size.x, minimapThickness),
      minimapWallHeight,
      orientation === 'horizontal' ? Math.max(size.z, minimapThickness) : size.z
    ),
    materials.minimapWallMat
  );
  minimapWall.position.set(center.x, 0.24, center.z);
  minimapWall.layers.set(MINIMAP_LAYER);
  group.add(minimapWall);
}

function addPillar(group, x, z, wallHeight, materials) {
  const pillar = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, wallHeight + 0.1, 0.18),
    materials.wallCapMat
  );
  pillar.position.set(x, wallHeight / 2, z);
  pillar.castShadow = true;
  pillar.receiveShadow = true;
  group.add(pillar);
}

function hasAnyWallAtIntersection(r, c) {
  if (r > 0 && c > 0 && cells[r - 1][c - 1].walls.S && cells[r - 1][c - 1].walls.E) return true;
  if (r > 0 && c < COLS && cells[r - 1][Math.max(0, c - 1)]?.walls.S) return true;
  if (c > 0 && r < ROWS && cells[Math.max(0, r - 1)]?.[c - 1]?.walls.E) return true;
  if (r < ROWS && c < COLS) {
    const cell = cells[Math.min(r, ROWS - 1)][Math.min(c, COLS - 1)];
    if (cell.walls.N || cell.walls.W) return true;
  }
  return false;
}

function addFloorDetail(group, x, z, cellSize, isExit, materials) {
  const floorBorder = new THREE.Mesh(
    new THREE.PlaneGeometry(cellSize, cellSize),
    isExit ? materials.exitMat : materials.floorMat
  );
  floorBorder.rotation.x = -Math.PI / 2;
  floorBorder.position.set(x + cellSize / 2, 0, z + cellSize / 2);
  floorBorder.receiveShadow = true;
  group.add(floorBorder);

  const inset = new THREE.Mesh(
    new THREE.PlaneGeometry(cellSize * 0.82, cellSize * 0.82),
    isExit ? materials.exitMat : materials.floorInsetMat
  );
  inset.rotation.x = -Math.PI / 2;
  inset.position.set(x + cellSize / 2, 0.015, z + cellSize / 2);
  inset.receiveShadow = true;
  group.add(inset);
}

function disposeMazeGroup() {
  if (!mazeGroup) return;
  mazeGroup.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.geometry?.dispose();
    if (Array.isArray(obj.material)) {
      obj.material.forEach(disposeMaterial);
      return;
    }
    disposeMaterial(obj.material);
  });
}

function disposeMaterial(material) {
  if (!material) return;
  if (material.map) material.map.dispose();
  material.dispose();
}

/**
 * Generate maze using DFS recursive backtracker algorithm.
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @param {number} seed - Optional seed for random number generation
 * @returns {Array<Array>} Generated cell grid
 */
export function generateMaze(rows = ROWS, cols = COLS, seed = null) {
  const resolvedSeed = seed ?? Math.floor(Math.random() * 1000000);
  const rng = new SeededRandom(resolvedSeed);
  
  // Initialize all cells with all walls
  const cellGrid = initializeCells();
  
  // Pick start cell (0,0) or random
  const startR = 0;
  const startC = 0;
  
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

  // Open the exit on the far corner so the goal is visible and reachable.
  cellGrid[rows - 1][cols - 1].walls.E = false;
  
  return cellGrid;
}

/**
 * Build 3D meshes from the current cell grid and add to scene.
 * Coordinate mapping: cell (r, c) maps to world position (x = c * cellSize, z = r * cellSize).
 */
function buildMeshes(scene) {
  if (mazeGroup) {
    scene.remove(mazeGroup);
    disposeMazeGroup();
  }
  mazeGroup = new THREE.Group();

  const cellSize = CELL_SIZE;
  const wallHeight = 2;
  const wallThickness = 0.14;
  const theme = getCurrentThemeDefinition();
  const materials = createMazeMaterials(theme);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS * cellSize + 6, ROWS * cellSize + 6),
    materials.groundMat
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((COLS * cellSize) / 2, -0.02, (ROWS * cellSize) / 2);
  ground.receiveShadow = true;
  mazeGroup.add(ground);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = cells[r][c];
      // Coordinate mapping: x = c * cellSize, z = r * cellSize
      const x = c * cellSize;
      const z = r * cellSize;

      // Add floor for every cell
      const isExit = r === ROWS - 1 && c === COLS - 1;
      addFloorDetail(mazeGroup, x, z, cellSize, isExit, materials);
      addMinimapCell(mazeGroup, x, z, cellSize, isExit, materials);

      // Add walls based on cell wall flags
      // North wall (top edge of cell)
      if (cell.walls.N) {
        addWallSegment(
          mazeGroup,
          'horizontal',
          new THREE.Vector3(x + cellSize / 2, wallHeight / 2, z),
          new THREE.Vector3(cellSize, wallHeight, wallThickness),
          wallHeight,
          materials
        );
      }

      // East wall (right edge of cell)
      if (cell.walls.E) {
        addWallSegment(
          mazeGroup,
          'vertical',
          new THREE.Vector3(x + cellSize, wallHeight / 2, z + cellSize / 2),
          new THREE.Vector3(wallThickness, wallHeight, cellSize),
          wallHeight,
          materials
        );
      }

      // South wall (bottom edge of cell)
      if (cell.walls.S) {
        addWallSegment(
          mazeGroup,
          'horizontal',
          new THREE.Vector3(x + cellSize / 2, wallHeight / 2, z + cellSize),
          new THREE.Vector3(cellSize, wallHeight, wallThickness),
          wallHeight,
          materials
        );
      }

      // West wall (left edge of cell)
      if (cell.walls.W) {
        addWallSegment(
          mazeGroup,
          'vertical',
          new THREE.Vector3(x, wallHeight / 2, z + cellSize / 2),
          new THREE.Vector3(wallThickness, wallHeight, cellSize),
          wallHeight,
          materials
        );
      }
    }
  }

  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      if (!hasAnyWallAtIntersection(r, c)) continue;
      addPillar(mazeGroup, c * cellSize, r * cellSize, wallHeight, materials);
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
  cells = generateMaze(ROWS, COLS);
  currentMazeStats = computeMazeStats(cells);
  buildMeshes(scene);
}

/**
 * Regenerate the maze with optional seed.
 * @param {number} seed - Optional seed for random generation
 */
export function regenerateMaze(seed = null) {
  cells = generateMaze(ROWS, COLS, seed);
  currentMazeStats = computeMazeStats(cells);
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

export function getMazeExitPosition() {
  const x = (COLS - 1) * CELL_SIZE + CELL_SIZE / 2;
  const z = (ROWS - 1) * CELL_SIZE + CELL_SIZE / 2;
  return { x, z };
}

export function getCellSize() {
  return CELL_SIZE;
}

export function getMazeStats() {
  return currentMazeStats;
}

export function getThemeOptions() {
  return Object.values(THEME_DEFINITIONS).map(({ id, name }) => ({ id, name }));
}

export function getCurrentTheme() {
  return { ...getCurrentThemeDefinition() };
}

export function setMazeTheme(themeId) {
  if (!THEME_DEFINITIONS[themeId]) return false;
  currentThemeId = themeId;
  if (scene && cells.length > 0) buildMeshes(scene);
  return true;
}

export function getMinimapLayer() {
  return MINIMAP_LAYER;
}
