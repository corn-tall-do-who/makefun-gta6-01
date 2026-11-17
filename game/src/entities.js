// PORT VERONA — entities: player, cars, traffic, pedestrians, police,
// combat (shooting/punching), particles & skid marks.
import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y, ROAD_W, SAND_Y, SEA_Y } from './config.js';
import { collideBuildings, hitsBuilding } from './world.js';
import { sfx } from './audio.js';

export const CAR_COLORS = ['#c0392b', '#2e6fb0', '#e0a030', '#5a8a4a', '#7a4a8a', '#c0c0c8', '#30343a', '#d96a2e', '#3a9a8a'];

let nextId = 1;

export function makeCar(x, y, angle, color, kind = 'traffic') {
  return {
    id: nextId++, kind, x, y, angle, speed: 0,
    color, w: 44, h: 22, hp: 100, disabled: false,
    // traffic AI
    road: null, dir: 1, targetSpeed: 110 + Math.random() * 60,
    stuck: 0,
  };
}

export function makePed(x, y) {
  const shirts = ['#d96a2e', '#3a7bd9', '#e0c030', '#7a4a8a', '#4a9a5a', '#c0507a', '#e8e8e8'];
  return {
    id: nextId++, x, y, angle: Math.random() * Math.PI * 2,
    speed: 28 + Math.random() * 22, shirt: shirts[Math.floor(Math.random() * shirts.length)],
    hp: 50, fleeing: false, fleeT: 0, dead: false, armed: false,
    walkPhase: Math.random() * 10, road: null, dir: 1,
  };
}

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    health: 100, money: 1500, ammo: 12, wanted: 0,
    onFoot: true, car: null, lastHurt: -99, regenDelay: 0,
    punchCd: 0, shootCd: 0, bustTimer: 0, lastSeenT: 0,
  };
}

// ---------- particles & skid marks ----------
export function spawnParticles(list, x, y, n, color, speed = 160, life = 0.5, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.7), maxLife: life, color, size: size * (0.7 + Math.random() * 0.6) });
  }
}

export function updateParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    p.life -= dt;
    if (p.life <= 0) list.splice(i, 1);
  }
}

// ---------- movement helpers ----------
function moveCircle(city, ent, dx, dy, r) {
  const nx = ent.x + dx, ny = ent.y + dy;
  const res = collideBuildings(city, nx, ny, r);
  // sea blocks movement
  res.y = Math.min(res.y, SEA_Y - 14);
  ent.x = res.x; ent.y = res.y;
  return res;
}

export function updatePlayerOnFoot(state, dt) {
  const p = state.player;
  const { keys } = state.input;
  let mx = 0, my = 0;
  if (keys['w'] || keys['arrowup']) my -= 1;
  if (keys['s'] || keys['arrowdown']) my += 1;
  if (keys['a'] || keys['arrowleft']) mx -= 1;
  if (keys['d'] || keys['arrowright']) mx += 1;
  const running = keys['shift'];
  const speed = running ? 235 : 145;
  if (mx || my) {
    const len = Math.hypot(mx, my);
    mx /= len; my /= len;
    p.angle = Math.atan2(my, mx);
    moveCircle(state.city, p, mx * speed * dt, my * speed * dt, 14);
  }
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  // health regen after 5s without damage
  if (state.time - p.lastHurt > 5 && p.health > 0 && p.health < 100) {
    p.health = Math.min(100, p.health + 2.2 * dt);
  }
}

export function updatePlayerDriving(state, dt) {
  const p = state.player;
  const car = p.car;
  if (!car) { p.onFoot = true; return; }
  const { keys } = state.input;
  const accel = (keys['w'] || keys['arrowup']) ? 300 : 0;
  const brake = (keys['s'] || keys['arrowdown']) ? 1 : 0;
  const steer = ((keys['a'] || keys['arrowleft']) ? -1 : 0) + ((keys['d'] || keys['arrowright']) ? 1 : 0);

  if (accel) car.speed += accel * dt;
  if (brake) {
    if (car.speed > 5) car.speed -= 420 * dt;
    else car.speed = Math.max(-150, car.speed - 200 * dt);
  }
  // drag + rolling resistance
  car.speed -= car.speed * 0.55 * dt;
  if (Math.abs(car.speed) < 4 && !accel && !brake) car.speed = 0;
  car.speed = Math.max(-160, Math.min(430, car.speed));

  const spd = car.speed;
  if (Math.abs(spd) > 8) {
    const turnRate = 2.6 * Math.min(1, Math.abs(spd) / 160);
    car.angle += steer * turnRate * dt * Math.sign(spd);
    // skid marks on hard turns at speed
    if (Math.abs(steer) > 0 && Math.abs(spd) > 240 && Math.random() < 0.6) {
      state.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 6 });
    }
  }

  const nx = car.x + Math.cos(car.angle) * spd * dt;
  const ny = car.y + Math.sin(car.angle) * spd * dt;
  const res = collideBuildings(state.city, nx, ny, 20);
  const hitWall = Math.hypot(res.x - nx, res.y - ny) > 1;
  car.x = res.x; car.y = res.y;
  if (hitWall) {
    if (Math.abs(spd) > 120) {
      spawnParticles(state.particles, car.x, car.y, 10, '#ffcf4a', 200, 0.5, 3);
      sfx.crash();
      damagePlayer(state, 4);
    }
    car.speed *= 0.35;
  }
  // car vs car collisions (simple circles)
  for (const other of state.cars) {
    if (other === car || other.disabled) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 46 && d > 0.01) {
      const push = (46 - d) / 2;
      const ux = dx / d, uy = dy / d;
      car.x -= ux * push; car.y -= uy * push;
      other.x += ux * push; other.y += uy * push;
      const rel = Math.abs(car.speed - other.speed);
      if (rel > 60) {
        spawnParticles(state.particles, (car.x + other.x) / 2, (car.y + other.y) / 2, 8, '#ffd24a', 180, 0.4, 3);
        sfx.crash();
        car.speed *= 0.6; other.speed *= 0.5;
        if (other.kind === 'police') damagePlayer(state, 3);
      }
    }
  }
  // running over pedestrians
  if (Math.abs(spd) > 40) {
    for (const ped of state.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 30) {
        ped.dead = true;
        spawnParticles(state.particles, ped.x, ped.y, 12, '#c0392b', 200, 0.6, 4);
        raiseWanted(state, 1);
        state.message = 'You hit a pedestrian! Wanted up.';
        state.messageT = 2.5;
      }
    }
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
  state.engineFrac = Math.min(1, Math.abs(spd) / 430);
}

// ---------- wanted ----------
export function raiseWanted(state, n) {
  const p = state.player;
  const before = p.wanted;
  p.wanted = Math.min(5, p.wanted + n);
  if (p.wanted > before) {
    p.lastSeenT = state.time;
    spawnPolice(state);
  }
}

export function updateWanted(state, dt) {
  const p = state.player;
  if (p.wanted <= 0) return;
  // police in sight?
  let seen = false;
  for (const c of state.cars) {
    if (c.kind !== 'police') continue;
    if (Math.hypot(c.x - p.x, c.y - p.y) < 520) { seen = true; break; }
  }
  if (!seen) {
    for (const c of state.cops) {
      if (Math.hypot(c.x - p.x, c.y - p.y) < 420) { seen = true; break; }
    }
  }
  if (seen) { p.lastSeenT = state.time; p.decayT = 0; }
  else {
    p.decayT = (p.decayT || 0) + dt;
    if (p.decayT > 6) {
      p.decayT = 2; // then -1 star every 4s
      p.wanted = Math.max(0, p.wanted - 1);
      if (p.wanted === 0) clearPolice(state);
    }
  }
}

export function spawnPolice(state) {
  const p = state.player;
  const want = Math.min(p.wanted, 3);
  const existing = state.cars.filter((c) => c.kind === 'police').length;
  for (let i = existing; i < want; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 620 + Math.random() * 220;
    let x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    x = Math.max(80, Math.min(WORLD_W - 80, x));
    y = Math.max(80, Math.min(SEA_Y - 60, y));
    const car = makeCar(x, y, 0, '#e8e8e8', 'police');
    car.hp = 120;
    state.cars.push(car);
  }
  // foot cops when on foot and wanted >= 2
  if (!p.onFoot || p.wanted < 2) return;
  const wantCops = Math.min(p.wanted - 1, 2);
  for (let i = state.cops.length; i < wantCops; i++) {
    const a = Math.random() * Math.PI * 2;
    const cop = makePed(p.x + Math.cos(a) * 420, p.y + Math.sin(a) * 420);
    cop.shirt = '#1d3f8a'; cop.speed = 150; cop.hp = 100; cop.isCop = true;
    state.cops.push(cop);
  }
}

export function clearPolice(state) {
  // Remove police cars (unless the player is driving one) and foot cops.
  state.cars = state.cars.filter((c) => c.kind !== 'police' || c === state.player.car);
  state.cops = [];
}

export function updatePoliceCars(state, dt) {
  const p = state.player;
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.disabled) continue;
    const dx = p.x - car.x, dy = p.y - car.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
    car.speed = Math.min(car.speed + 320 * dt, dist < 60 ? 180 : 400);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const res = collideBuildings(state.city, nx, ny, 20);
    car.x = res.x; car.y = res.y;
    if (Math.hypot(res.x - nx, res.y - ny) > 1) car.speed *= 0.5;
    // ram the player
    if (dist < 48) {
      if (p.onFoot) {
        damagePlayer(state, 12 * dt * 4);
      } else if (p.car) {
        p.car.speed *= 0.94;
        if (Math.random() < dt * 2) { damagePlayer(state, 2); spawnParticles(state.particles, car.x, car.y, 5, '#ffd24a', 150, 0.4, 3); }
      }
    }
  }
}

export function updateCops(state, dt) {
  const p = state.player;
  for (const cop of state.cops) {
    if (cop.dead) continue;
    const dx = p.x - cop.x, dy = p.y - cop.y;
    const d = Math.hypot(dx, dy);
    if (d < 30) {
      // grabbing the player
      p.bustTimer += dt;
      if (p.bustTimer > 1.4) bustPlayer(state, 'Busted by the Verona PD!');
      continue;
    }
    p.bustTimer = Math.max(0, p.bustTimer - dt * 2);
    if (d > 900) { cop.dead = true; continue; }
    cop.angle = Math.atan2(dy, dx);
    moveCircle(state.city, cop, (dx / d) * cop.speed * dt, (dy / d) * cop.speed * dt, 13);
  }
  state.cops = state.cops.filter((c) => !c.dead);
}

// ---------- traffic ----------
export function spawnTraffic(state, n) {
  for (let i = 0; i < n; i++) {
    const vertical = Math.random() < 0.5;
    let x, y, road, dir;
    if (vertical) {
      road = ROADS_X[Math.floor(Math.random() * ROADS_X.length)];
      x = road + (Math.random() < 0.5 ? -22 : 22);
      y = 150 + Math.random() * (WORLD_H - 500);
      dir = Math.random() < 0.5 ? 1 : -1;
    } else {
      road = ROADS_Y[Math.floor(Math.random() * ROADS_Y.length)];
      y = road + (Math.random() < 0.5 ? -22 : 22);
      x = 150 + Math.random() * (WORLD_W - 300);
      dir = Math.random() < 0.5 ? 1 : -1;
    }
    const car = makeCar(x, y, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)], 'traffic');
    car.road = { vertical, value: road, dir };
    car.speed = car.targetSpeed;
    state.cars.push(car);
  }
}

export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.kind !== 'traffic' || car.disabled) continue;
    const r = car.road;
    if (!r) continue;
    // slow down if a car is right ahead
    let slow = false;
    for (const o of state.cars) {
      if (o === car) continue;
      const dx = o.x - car.x, dy = o.y - car.y;
      const ahead = r.vertical ? dy * r.dir : dx * r.dir;
      const lateral = r.vertical ? Math.abs(dx) : Math.abs(dy);
      if (ahead > 0 && ahead < 70 && lateral < 26) { slow = true; break; }
    }
    const target = slow ? 0 : car.targetSpeed;
    car.speed += Math.max(-260 * dt, Math.min(160 * dt, target - car.speed));
    if (r.vertical) {
      car.angle = r.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.y += r.dir * car.speed * dt;
      car.x = r.value + (r.dir > 0 ? 22 : -22);
      if (car.y < 120 || car.y > WORLD_H - 320) {
        // turn onto a horizontal road at a random intersection
        const ny = ROADS_Y[Math.floor(Math.random() * ROADS_Y.length)];
        car.road = { vertical: false, value: ny, dir: Math.random() < 0.5 ? 1 : -1 };
        car.y = ny + (car.road.dir > 0 ? 22 : -22);
      }
    } else {
      car.angle = r.dir > 0 ? 0 : Math.PI;
      car.x += r.dir * car.speed * dt;
      car.y = r.value + (r.dir > 0 ? 22 : -22);
      if (car.x < 120 || car.x > WORLD_W - 120) {
        const nx = ROADS_X[Math.floor(Math.random() * ROADS_X.length)];
        car.road = { vertical: true, value: nx, dir: Math.random() < 0.5 ? 1 : -1 };
        car.x = nx + (car.road.dir > 0 ? 22 : -22);
      }
    }
  }
}

// ---------- pedestrians ----------
export function spawnPeds(state, n) {
  for (let i = 0; i < n; i++) {
    const vertical = Math.random() < 0.5;
    let x, y;
    if (vertical) {
      const rx = ROADS_X[Math.floor(Math.random() * ROADS_X.length)];
      x = rx + (Math.random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
      y = 150 + Math.random() * (SAND_Y - 300);
    } else {
      const ry = ROADS_Y[Math.floor(Math.random() * ROADS_Y.length)];
      y = ry + (Math.random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
      x = 150 + Math.random() * (WORLD_W - 300);
    }
    if (hitsBuilding(state.city, x, y, 16)) continue;
    const ped = makePed(x, y);
    ped.road = { vertical, value: vertical ? x : y, dir: Math.random() < 0.5 ? 1 : -1 };
    state.peds.push(ped);
  }
}

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    ped.walkPhase += dt * 6;
    // flee from the player's car, gunshots, or armed player nearby
    const dPlayer = Math.hypot(ped.x - p.x, ped.y - p.y);
    const carNear = !p.onFoot && p.car && Math.abs(p.car.speed) > 120 && dPlayer < 160;
    if (carNear || (state.scaredT > state.time && dPlayer < 260)) {
      ped.fleeing = true; ped.fleeT = 1.5;
    }
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      moveCircle(state.city, ped, Math.cos(a) * 130 * dt, Math.sin(a) * 130 * dt, 12);
      continue;
    }
    ped.fleeing = false;
    // stroll along the sidewalk
    const r = ped.road;
    if (!r) continue;
    if (r.vertical) {
      ped.angle = r.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      ped.y += r.dir * ped.speed * dt;
      if (ped.y < 130 || ped.y > SAND_Y - 40) r.dir *= -1;
    } else {
      ped.angle = r.dir > 0 ? 0 : Math.PI;
      ped.x += r.dir * ped.speed * dt;
      if (ped.x < 130 || ped.x > WORLD_W - 130) r.dir *= -1;
    }
  }
  // remove the dead (bodies are cleared once the dust settles)
  state.peds = state.peds.filter((pd) => !pd.dead);
}

// ---------- combat ----------
export function shootAt(state, wx, wy) {
  const p = state.player;
  if (p.shootCd > 0) return;
  p.shootCd = 0.22;
  if (p.ammo <= 0) { sfx.dryClick(); return; }
  p.ammo -= 1;
  const ox = p.onFoot ? p.x : p.car.x;
  const oy = p.onFoot ? p.y : p.car.y;
  const a = Math.atan2(wy - oy, wx - ox);
  const bx = ox + Math.cos(a) * 22, by = oy + Math.sin(a) * 22;
  state.bullets.push({ x: bx, y: by, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, life: 0.9, from: 'player' });
  spawnParticles(state.particles, bx, by, 4, '#ffe27a', 120, 0.12, 3);
  sfx.shot();
  state.scaredT = state.time + 2;
  // Shooting in public draws police attention if a patrol is nearby.
  for (const c of state.cars) {
    if (c.kind === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 500) { raiseWanted(state, 1); break; }
  }
}

export function punch(state) {
  const p = state.player;
  if (!p.onFoot || p.punchCd > 0) return;
  p.punchCd = 0.45;
  sfx.punch();
  const range = 46;
  const tx = p.x + Math.cos(p.angle) * range;
  const ty = p.y + Math.sin(p.angle) * range;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    if (Math.hypot(ped.x - tx, ped.y - ty) < 30) {
      ped.hp -= 25;
      ped.fleeing = true; ped.fleeT = 2;
      spawnParticles(state.particles, ped.x, ped.y, 6, '#ffffff', 140, 0.3, 3);
      if (ped.hp <= 0) { ped.dead = true; raiseWanted(state, 1); }
    }
  }
  for (const cop of state.cops) {
    if (cop.dead) continue;
    if (Math.hypot(cop.x - tx, cop.y - ty) < 30) {
      cop.hp -= 25;
      spawnParticles(state.particles, cop.x, cop.y, 6, '#ffffff', 140, 0.3, 3);
      if (cop.hp <= 0) { cop.dead = true; raiseWanted(state, 1); }
    }
  }
}

export function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || hitsBuilding(state.city, b.x, b.y, 2);
    if (!dead && b.from === 'player') {
      for (const ped of state.peds) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          ped.hp -= 34;
          spawnParticles(state.particles, ped.x, ped.y, 8, '#c0392b', 160, 0.4, 3);
          if (ped.hp <= 0) { ped.dead = true; raiseWanted(state, 1); }
          dead = true; break;
        }
      }
      if (!dead) {
        for (const cop of state.cops) {
          if (cop.dead) continue;
          if (Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
            cop.hp -= 34;
            spawnParticles(state.particles, cop.x, cop.y, 8, '#c0392b', 160, 0.4, 3);
            if (cop.hp <= 0) { cop.dead = true; raiseWanted(state, 1); }
            dead = true; break;
          }
        }
      }
      if (!dead) {
        for (const car of state.cars) {
          if (car === state.player.car || car.disabled) continue;
          const dx = b.x - car.x, dy = b.y - car.y;
          const ca = Math.cos(-car.angle), sa = Math.sin(-car.angle);
          const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
          if (Math.abs(lx) < 24 && Math.abs(ly) < 13) {
            car.hp -= 20;
            spawnParticles(state.particles, b.x, b.y, 6, '#ffd24a', 160, 0.35, 3);
            if (car.hp <= 0) {
              car.disabled = true; car.speed = 0;
              spawnParticles(state.particles, car.x, car.y, 22, '#888888', 220, 0.8, 4);
              spawnParticles(state.particles, car.x, car.y, 14, '#ff8a2a', 200, 0.5, 4);
              sfx.crash();
              if (car.kind === 'police') raiseWanted(state, 1);
            }
            dead = true; break;
          }
        }
      }
    }
    if (!dead && b.from === 'enemy') {
      const p = state.player;
      if (Math.hypot(p.x - b.x, p.y - b.y) < 14) {
        damagePlayer(state, 9);
        dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

// Enemy (ambush) shooters
export function updateAmbushers(state, dt) {
  for (const ped of state.peds) {
    if (!ped.armed || ped.dead) continue;
    const p = state.player;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    ped.shootCd = (ped.shootCd || 0) - dt;
    if (d < 420 && ped.shootCd <= 0) {
      ped.shootCd = 0.9 + Math.random() * 0.7;
      const a = Math.atan2(p.y - ped.y, p.x - ped.x) + (Math.random() - 0.5) * 0.3;
      state.bullets.push({ x: ped.x + Math.cos(a) * 20, y: ped.y + Math.sin(a) * 20, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, life: 1.1, from: 'enemy' });
      spawnParticles(state.particles, ped.x + Math.cos(a) * 20, ped.y + Math.sin(a) * 20, 3, '#ffe27a', 100, 0.1, 3);
      sfx.shot();
    }
    // strafe slowly toward the player
    if (d > 180) {
      const a = Math.atan2(p.y - ped.y, p.x - ped.x);
      moveCircle(state.city, ped, Math.cos(a) * 55 * dt, Math.sin(a) * 55 * dt, 12);
    }
  }
}

// ---------- damage / busted ----------
export function damagePlayer(state, n) {
  const p = state.player;
  if (p.health <= 0) return;
  p.health -= n;
  p.lastHurt = state.time;
  if (n >= 4) sfx.hurt();
  if (p.health <= 0) {
    p.health = 0;
    bustPlayer(state, 'You got busted!');
  }
}

export function bustPlayer(state, reason) {
  const p = state.player;
  if (state.screen === 'busted') return;
  sfx.busted();
  const lost = Math.min(p.money, Math.max(100, Math.floor(p.money * 0.1)));
  p.money -= lost;
  p.wanted = 0;
  p.health = 100;
  p.bustTimer = 0;
  clearPolice(state);
  // respawn at the hospital, on foot
  if (p.car) { p.car = null; p.onFoot = true; }
  p.x = 1000; p.y = 1700; p.angle = -Math.PI / 2;
  state.screen = 'busted';
  state.bustedInfo = { reason, lost };
  state.message = '';
}
