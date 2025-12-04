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
// For diamond grids (2-player rectangle maps)
export function isValidHex(hex, gridSize, mapShape = 'rectangle') {
  if (mapShape === 'square') {
    // For 4-player rectangular maps, use offset coordinate bounds
    const width = gridSize; // gridSize is sideLength for square maps
    const height = Math.floor(gridSize * 0.75);
    return isValidSquareHex(hex, width, height);
  } else if (mapShape === 'triangle') {
    // For 3-player triangle maps
    const sideLength = gridSize;
    // Check if hex is within the triangle bounds
    // Triangle has vertices at (0, -(sideLength-1)), (sideLength-1, 0), (-(sideLength-1), sideLength-1)
    const s = -hex.q - hex.r;
    return hex.r <= 0 &&
           hex.q >= -(sideLength - 1) &&
           hex.q <= (sideLength - 1) &&
           s >= -(sideLength - 1) &&
           s <= (sideLength - 1);
  } else {
    // Default diamond grid (2-player)
    return Math.abs(hex.q) <= gridSize &&
           Math.abs(hex.r) <= gridSize &&
           Math.abs(hex.q + hex.r) <= gridSize;
  }
}

// Get all valid hexes in movement range (with paths)
// Returns: { hex: HexCoord, path: HexCoord[] }[]
// blockedHexes: hexes you cannot path through (enemy units)
// cannotEndHexes: hexes you can path through but cannot end movement on (friendly units, eggs)
export function getMovementRangeWithPaths(startHex, range, gridSize, blockedHexes = [], cannotEndHexes = [], mapShape = 'rectangle') {
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
            isValidHex(neighbor, gridSize, mapShape) &&
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
export function getMovementRange(startHex, range, gridSize, blockedHexes = [], mapShape = 'rectangle') {
  const withPaths = getMovementRangeWithPaths(startHex, range, gridSize, blockedHexes, [], mapShape);
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

// Generate rectangular grid (4-player map)
// width: number of hexes wide (e.g., 16)
// height: number of hexes tall (e.g., 12)
// Returns: array of HexCoord objects forming a rectangle
export function generateSquareGrid(width, height) {
  const hexes = [];

  // Use odd-q offset coordinates to create a proper rectangle
  // Then convert to axial coordinates for game logic
  // This creates a grid that looks rectangular when rendered
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);

  for (let col = -halfWidth; col <= halfWidth; col++) {
    for (let row = -halfHeight; row <= halfHeight; row++) {
      // Convert odd-q offset to axial coordinates
      // For odd-q: q = col, r = row - floor((col - (col & 1)) / 2)
      const q = col;
      const r = row - Math.floor((col - (col & 1)) / 2);
      hexes.push(new HexCoord(q, r));
    }
  }

  return hexes;
}

// Check if a hex is within the rectangular grid bounds (for 4-player maps)
export function isValidSquareHex(hex, width, height) {
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);

  // Convert axial back to odd-q offset to check bounds
  const col = hex.q;
  const row = hex.r + Math.floor((hex.q - (hex.q & 1)) / 2);

  return col >= -halfWidth && col <= halfWidth &&
         row >= -halfHeight && row <= halfHeight;
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
export function getPlayerStartingPositions(mapShape, sideLength, playerCount = 2) {
  if (mapShape === 'triangle' || (mapShape === 'rectangle' && playerCount === 3)) {
    // 3 players on a hexagon map at 2 o'clock, 6 o'clock, and 10 o'clock positions
    // Using the same hexagon grid as 2-player but with 3 spawn points
    // The hexagon has 6 sides, we place players at sides 2, 4, and 6 (counting clockwise from top)
    const radius = sideLength - 1;

    // In axial coordinates for a pointy-top hexagon:
    // Top vertex: (0, -radius)
    // Top-right edge center (2 o'clock): roughly (radius, -radius) direction
    // Right vertex: (radius, 0) - but we want the edge between top-right and bottom-right
    // Bottom-right edge center (4 o'clock): roughly (radius, radius/2) direction
    // Bottom vertex: (0, radius)
    // Bottom-left edge center (6 o'clock): roughly (-radius, radius) direction
    // Left vertex: (-radius, radius)
    // Top-left edge center (10 o'clock): roughly (-radius, 0) direction

    // For 120° rotational symmetry on a hexagon:
    // Position 1 (2 o'clock): edge between top and bottom-right - around (radius-1, -(radius-1)/2)
    // Position 2 (6 o'clock): bottom - (0, radius-1)
    // Position 3 (10 o'clock): edge between left and top - around (-(radius-1), 0)

    // Using proper 120° rotation points on hexagon edges:
    // Player 1: 2 o'clock position
    // Player 2: 6 o'clock position (bottom)
    // Player 3: 10 o'clock position

    // Calculate positions at 120° intervals
    // Start with one position and rotate by 120° twice
    const pos1 = new HexCoord(radius - 1, -(radius - 1));  // 2 o'clock (top-right area)
    const pos2 = new HexCoord(0, radius - 1);               // 6 o'clock (bottom)
    const pos3 = new HexCoord(-(radius - 1), 0);            // 10 o'clock (left)

    return [pos1, pos2, pos3];
  } else if (mapShape === 'square') {
    // 4 players at cardinal directions of the rectangular grid
    // width=sideLength, height=sideLength*0.75
    const width = sideLength;
    const height = Math.floor(sideLength * 0.75);
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);

    // Convert offset positions to axial coordinates
    // Player positions in offset coords: top center, right center, bottom center, left center
    // Top: col=0, row=-halfHeight
    // Right: col=halfWidth, row=0
    // Bottom: col=0, row=halfHeight
    // Left: col=-halfWidth, row=0

    // Convert each offset position to axial
    const offsetToAxial = (col, row) => {
      const q = col;
      const r = row - Math.floor((col - (col & 1)) / 2);
      return new HexCoord(q, r);
    };

    return [
      offsetToAxial(0, -halfHeight + 1),     // Player 1: Top (north) - 1 hex from edge
      offsetToAxial(halfWidth - 1, 0),       // Player 2: Right (east) - 1 hex from edge
      offsetToAxial(0, halfHeight - 1),      // Player 3: Bottom (south) - 1 hex from edge
      offsetToAxial(-halfWidth + 1, 0)       // Player 4: Left (west) - 1 hex from edge
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
