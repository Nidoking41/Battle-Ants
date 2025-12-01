// Hexagonal grid utilities using axial coordinates

export class HexCoord {
  constructor(q, r) {
    this.q = q; // column
    this.r = r; // row
  }

  toString() {
    return `${this.q},${this.r}`;
  }

  static fromString(str) {
    const [q, r] = str.split(',').map(Number);
    return new HexCoord(q, r);
  }

  equals(other) {
    return this.q === other.q && this.r === other.r;
  }
}

// Get all 6 neighbors of a hex
export function getNeighbors(hex) {
  const directions = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 }
  ];

  return directions.map(dir => new HexCoord(hex.q + dir.q, hex.r + dir.r));
}

// Calculate distance between two hexes
export function hexDistance(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

// Get all hexes within a certain range
export function hexesInRange(center, range) {
  const results = [];
  for (let q = -range; q <= range; q++) {
    for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
      const hex = new HexCoord(center.q + q, center.r + r);
      results.push(hex);
    }
  }
  return results;
}

// Convert hex coordinates to pixel position
export function hexToPixel(hex, hexSize) {
  const x = hexSize * (3/2 * hex.q);
  const y = hexSize * (Math.sqrt(3)/2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}

// Convert pixel position to hex coordinates
export function pixelToHex(x, y, hexSize) {
  const q = (2/3 * x) / hexSize;
  const r = (-1/3 * x + Math.sqrt(3)/3 * y) / hexSize;
  return hexRound(q, r);
}

// Round fractional hex coordinates to nearest hex
function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }

  return new HexCoord(rq, rr);
}

// Check if hex is valid on the board
export function isValidHex(hex, gridSize) {
  return Math.abs(hex.q) <= gridSize &&
         Math.abs(hex.r) <= gridSize &&
         Math.abs(hex.q + hex.r) <= gridSize;
}

// Get all valid hexes in movement range (with paths)
// Returns: { hex: HexCoord, path: HexCoord[] }[]
// blockedHexes: hexes you cannot path through (enemy units)
// cannotEndHexes: hexes you can path through but cannot end movement on (friendly units, eggs)
export function getMovementRangeWithPaths(startHex, range, gridSize, blockedHexes = [], cannotEndHexes = []) {
  const visited = new Set();
  const frontier = [[startHex, 0, []]]; // [hex, distance, path]
  visited.add(startHex.toString());

  const reachable = [];

  while (frontier.length > 0) {
    const [current, distance, path] = frontier.shift();

    // Only add to reachable if it's not a hex we cannot end on
    if (distance > 0 && !cannotEndHexes.some(blocked => blocked.equals(current))) {
      reachable.push({ hex: current, path: [...path, current] });
    }

    if (distance < range) {
      const neighbors = getNeighbors(current);
      for (const neighbor of neighbors) {
        const key = neighbor.toString();
        // Can path through cannotEndHexes, just can't pathfind through blockedHexes
        if (!visited.has(key) &&
            isValidHex(neighbor, gridSize) &&
            !blockedHexes.some(blocked => blocked.equals(neighbor))) {
          visited.add(key);
          frontier.push([neighbor, distance + 1, [...path, current]]);
        }
      }
    }
  }

  return reachable;
}

// Get all valid hexes in movement range (backwards compatible)
export function getMovementRange(startHex, range, gridSize, blockedHexes = []) {
  const withPaths = getMovementRangeWithPaths(startHex, range, gridSize, blockedHexes);
  return withPaths.map(item => item.hex);
}

// Generate equilateral triangle grid (3-player map)
// sideLength: number of hexes per side (e.g., 15)
// Returns: array of HexCoord objects forming a triangle
export function generateTriangleGrid(sideLength) {
  const hexes = [];

  // Triangle with vertices at:
  // Top: (0, -(sideLength-1))
  // Bottom-right: (sideLength-1, 0)
  // Bottom-left: (-(sideLength-1), sideLength-1)

  for (let q = -(sideLength - 1); q <= (sideLength - 1); q++) {
    const r1 = Math.max(-(sideLength - 1), -q - (sideLength - 1));
    const r2 = Math.min(0, -q + (sideLength - 1));

    for (let r = r1; r <= r2; r++) {
      hexes.push(new HexCoord(q, r));
    }
  }

  return hexes;
}

// Generate square/diamond grid (4-player map)
// width: number of hexes wide (e.g., 12)
// height: number of hexes tall (e.g., 8)
// Returns: array of HexCoord objects forming a square/diamond
export function generateSquareGrid(width, height) {
  const hexes = [];

  // Create a diamond shape that appears as a square when rendered
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);

  for (let q = -halfWidth; q <= halfWidth; q++) {
    const r1 = Math.max(-halfHeight, -q - halfHeight);
    const r2 = Math.min(halfHeight, -q + halfHeight);

    for (let r = r1; r <= r2; r++) {
      hexes.push(new HexCoord(q, r));
    }
  }

  return hexes;
}

// Rotate hex coordinates by 120 degrees clockwise around origin
// Used for 3-player resource/tree mirroring
export function rotateHex120(hex) {
  // 120° clockwise rotation: (q, r) -> (-r, -q-r) -> (q+r, q)
  return new HexCoord(-hex.r, -hex.q - hex.r);
}

// Rotate hex coordinates by 90 degrees clockwise around origin
// Used for 4-player resource/tree mirroring
export function rotateHex90(hex) {
  // 90° clockwise rotation in axial coordinates
  // (q, r) -> (-r, q+r)
  return new HexCoord(-hex.r, hex.q + hex.r);
}

// Get starting positions for players based on map shape
export function getPlayerStartingPositions(mapShape, sideLength) {
  if (mapShape === 'triangle') {
    // 3 players at triangle corners
    return [
      new HexCoord(0, -(sideLength - 1)),           // Player 1: Top
      new HexCoord(sideLength - 1, 0),              // Player 2: Bottom-right
      new HexCoord(-(sideLength - 1), sideLength - 1) // Player 3: Bottom-left
    ];
  } else if (mapShape === 'square') {
    // 4 players at cardinal directions
    // For square grid: width=sideLength, height=sideLength*0.75
    const halfWidth = Math.floor(sideLength / 2);
    const halfHeight = Math.floor(sideLength * 0.75 / 2);
    return [
      new HexCoord(0, -halfHeight),           // Player 1: Top (north)
      new HexCoord(halfWidth, 0),             // Player 2: Right (east)
      new HexCoord(0, halfHeight),            // Player 3: Bottom (south)
      new HexCoord(-halfWidth, 0)             // Player 4: Left (west)
    ];
  } else {
    // Rectangle (2-player)
    const radius = sideLength - 1;
    return [
      new HexCoord(0, radius),          // Player 1: South
      new HexCoord(0, -radius)          // Player 2: North
    ];
  }
}

// Mirror resources/trees with rotational symmetry
export function mirrorPositions(basePositions, playerCount) {
  if (playerCount === 2) {
    // 180° rotation for 2-player
    return basePositions.map(pos => new HexCoord(-pos.q, -pos.r));
  } else if (playerCount === 3) {
    // 120° rotations for 3-player
    const mirrored = [...basePositions];
    basePositions.forEach(pos => {
      const rotated1 = rotateHex120(pos);
      const rotated2 = rotateHex120(rotated1);
      mirrored.push(rotated1, rotated2);
    });
    return mirrored;
  } else if (playerCount === 4) {
    // 90° rotations for 4-player
    const mirrored = [...basePositions];
    basePositions.forEach(pos => {
      const rotated1 = rotateHex90(pos);
      const rotated2 = rotateHex90(rotated1);
      const rotated3 = rotateHex90(rotated2);
      mirrored.push(rotated1, rotated2, rotated3);
    });
    return mirrored;
  }
  return basePositions;
}
