// PORT VERONA — city generation: districts, roads, buildings, trees,
// parked cars, pickups. Pure data built from a seeded RNG.
import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y, ROAD_W, DISTRICT_COLORS, SAND_Y, SEA_Y } from './config.js';
import { pick, randRange, randInt } from './random.js';

export function districtAt(x, y) {
  if (y >= SAND_Y) return 'beach';
  if (x < 700) return 'harbor';
  if (x >= 2500) return 'industrial';
  if (x >= 1100 && x <= 2100 && y >= 300 && y <= 1300) return 'downtown';
  return 'littleVerona';
}

function pointInBuilding(b, x, y, pad = 0) {
  return x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad;
}

function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2 + 14) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2 + 14) return true;
  return false;
}

export function buildCity(seed) {
  const rng = (function () {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();

  const buildings = [];
  const trees = [];
  const parkedCars = [];
  const pickups = [];

  // Buildings: one or two per block between roads.
  for (let i = 0; i < ROADS_X.length - 1; i++) {
    for (let j = 0; j < ROADS_Y.length - 1; j++) {
      const bx0 = ROADS_X[i] + ROAD_W / 2 + 18;
      const bx1 = ROADS_X[i + 1] - ROAD_W / 2 - 18;
      const by0 = ROADS_Y[j] + ROAD_W / 2 + 18;
      const by1 = ROADS_Y[j + 1] - ROAD_W / 2 - 18;
      if (by0 > SAND_Y - 60) continue; // beach blocks stay open
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      const district = districtAt(cx, cy);
      const palette = DISTRICT_COLORS[district] || DISTRICT_COLORS.littleVerona;
      const tall = district === 'downtown';
      const bw = bx1 - bx0, bh = by1 - by0;
      const n = rng() < 0.55 ? 2 : 1;
      if (n === 1) {
        const w = bw * randRange(rng, 0.55, 0.85);
        const h = bh * randRange(rng, 0.55, 0.85);
        buildings.push({
          x: cx - w / 2, y: cy - h / 2, w, h,
          color: pick(rng, palette), tall, district,
          windows: randInt(rng, 2, 5),
        });
      } else {
        // split block vertically into two buildings
        const gap = randRange(rng, 14, 30);
        const w1 = (bw - gap) * randRange(rng, 0.42, 0.55);
        const w2 = bw - gap - w1;
        const h1 = bh * randRange(rng, 0.5, 0.85);
        const h2 = bh * randRange(rng, 0.5, 0.85);
        buildings.push({ x: bx0, y: cy - h1 / 2, w: w1, h: h1, color: pick(rng, palette), tall, district, windows: randInt(rng, 2, 4) });
        buildings.push({ x: bx0 + w1 + gap, y: cy - h2 / 2, w: w2, h: h2, color: pick(rng, palette), tall, district, windows: randInt(rng, 2, 4) });
      }
    }
  }

  // Trees along sidewalks (just outside the road edge)
  for (let t = 0; t < 130; t++) {
    const vertical = rng() < 0.5;
    let x, y;
    if (vertical) {
      x = pick(rng, ROADS_X) + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 14);
      y = randRange(rng, 120, WORLD_H - 260);
    } else {
      y = pick(rng, ROADS_Y) + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 14);
      x = randRange(rng, 120, WORLD_W - 120);
    }
    if (buildings.some((b) => pointInBuilding(b, x, y, 12))) continue;
    if (y > SAND_Y) continue;
    trees.push({ x, y, r: randRange(rng, 9, 15) });
  }

  // Parked cars along road edges
  const carColors = ['#c0392b', '#2e6fb0', '#e0a030', '#5a8a4a', '#7a4a8a', '#c0c0c8', '#30343a', '#d96a2e'];
  for (let t = 0; t < 46; t++) {
    const vertical = rng() < 0.5;
    let x, y, angle;
    if (vertical) {
      x = pick(rng, ROADS_X) + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 16);
      y = randRange(rng, 260, WORLD_H - 320);
      angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      y = pick(rng, ROADS_Y) + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 16);
      x = randRange(rng, 260, WORLD_W - 160);
      angle = rng() < 0.5 ? 0 : Math.PI;
    }
    if (buildings.some((b) => pointInBuilding(b, x, y, 24))) continue;
    parkedCars.push({ x, y, angle, color: pick(rng, carColors) });
  }

  // Pickups: health (green cross), cash ($), ammo (yellow box)
  function freeSpot() {
    for (let tries = 0; tries < 40; tries++) {
      const x = randRange(rng, 150, WORLD_W - 150);
      const y = randRange(rng, 150, SAND_Y - 80);
      if (!onRoad(x, y) && !buildings.some((b) => pointInBuilding(b, x, y, 20))) return { x, y };
    }
    return { x: 1400, y: 800 };
  }
  for (let i = 0; i < 9; i++) pickups.push({ ...freeSpot(), kind: 'health', taken: false });
  for (let i = 0; i < 12; i++) pickups.push({ ...freeSpot(), kind: 'cash', taken: false, amount: randInt(rng, 150, 450) });
  for (let i = 0; i < 7; i++) pickups.push({ ...freeSpot(), kind: 'ammo', taken: false });

  return { buildings, trees, parkedCars, pickups, seed };
}

// Collision: push a circle out of building AABBs (slide along walls).
export function collideBuildings(city, x, y, r) {
  let nx = x, ny = y;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx, dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * r;
      ny = cy + (dy / d) * r;
    } else if (d2 <= 0.0001) {
      // centre inside the building: push out along the smallest axis
      const left = nx - b.x, right = b.x + b.w - nx;
      const top = ny - b.y, bottom = b.y + b.h - ny;
      const m = Math.min(left, right, top, bottom);
      if (m === left) nx = b.x - r;
      else if (m === right) nx = b.x + b.w + r;
      else if (m === top) ny = b.y - r;
      else ny = b.y + b.h + r;
    }
  }
  // World bounds + sea
  nx = Math.max(30, Math.min(WORLD_W - 30, nx));
  ny = Math.max(30, Math.min(SEA_Y - 14, ny));
  return { x: nx, y: ny };
}

export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}
