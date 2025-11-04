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

// Get all valid hexes in movement range
export function getMovementRange(startHex, range, gridSize, blockedHexes = []) {
  const visited = new Set();
  const frontier = [[startHex, 0]];
  visited.add(startHex.toString());

  const reachable = [];

  while (frontier.length > 0) {
    const [current, distance] = frontier.shift();

    if (distance > 0) {
      reachable.push(current);
    }

    if (distance < range) {
      const neighbors = getNeighbors(current);
      for (const neighbor of neighbors) {
        const key = neighbor.toString();
        if (!visited.has(key) &&
            isValidHex(neighbor, gridSize) &&
            !blockedHexes.some(blocked => blocked.equals(neighbor))) {
          visited.add(key);
          frontier.push([neighbor, distance + 1]);
        }
      }
    }
  }

  return reachable;
}
