// PORT VERONA — canvas rendering: city, cars, people, effects, markers.
import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y, ROAD_W, PALETTE, SAND_Y, SEA_Y, LANDMARKS } from './config.js';
import { districtAt } from './world.js';

const DISTRICT_TINT = {
  harbor: '#b0a89a',
  downtown: '#b5b0a0',
  littleVerona: '#cbb489',
  industrial: '#a8a294',
  beach: '#e8d5a0',
};

export function drawWorld(ctx, state) {
  const cam = state.camera;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // Ground: district-tinted base
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // district tint blocks (grid cells)
  for (let i = 0; i < ROADS_X.length - 1; i++) {
    for (let j = 0; j < ROADS_Y.length - 1; j++) {
      const cx = (ROADS_X[i] + ROADS_X[i + 1]) / 2;
      const cy = (ROADS_Y[j] + ROADS_Y[j + 1]) / 2;
      ctx.fillStyle = DISTRICT_TINT[districtAt(cx, cy)] || '#cbb489';
      ctx.globalAlpha = 0.35;
      ctx.fillRect(ROADS_X[i] + ROAD_W / 2, ROADS_Y[j] + ROAD_W / 2, 400 - ROAD_W, 400 - ROAD_W);
      ctx.globalAlpha = 1;
    }
  }

  // Beach sand + sea at the south edge
  ctx.fillStyle = PALETTE.beach;
  ctx.fillRect(0, SAND_Y, WORLD_W, SEA_Y - SAND_Y);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(0, SEA_Y, WORLD_W, WORLD_H - SEA_Y);
  ctx.fillStyle = PALETTE.seaDeep;
  for (let x = 40; x < WORLD_W; x += 160) {
    ctx.fillRect(x, SEA_Y + 18 + ((x / 160) % 2) * 14, 70, 4);
  }
  // umbrellas on the sand
  ctx.fillStyle = '#e05a5a';
  for (let x = 200; x < WORLD_W; x += 420) {
    ctx.beginPath(); ctx.arc(x, SAND_Y + 34, 16, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#e0a030';
    ctx.beginPath(); ctx.arc(x + 210, SAND_Y + 52, 16, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#e05a5a';
  }

  // Sidewalks (light strips along every road)
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2 - 16, 0, ROAD_W + 32, WORLD_H);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2 - 16, WORLD_W, ROAD_W + 32);

  // Roads
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);

  // Lane markings (dashed centre lines)
  ctx.fillStyle = PALETTE.lane;
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  for (const rx of ROADS_X) {
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD_H); ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings
  for (const b of state.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // windows
    ctx.fillStyle = 'rgba(30,40,60,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        ctx.fillRect(b.x + 10 + c * 34, b.y + 12 + r * 34, 16, 12);
      }
    }
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    }
  }

  // Landmark labels
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    if (key === 'debtors') continue;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const w = ctx.measureText(lm.label).width + 14;
    ctx.fillRect(lm.x - w / 2, lm.y - 34, w, 22);
    ctx.fillStyle = '#fff';
    ctx.fillText(lm.label, lm.x, lm.y - 18);
  }

  // Trees
  for (const t of state.city.trees) {
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(t.x - 2, t.y - 2, 4, 8);
    ctx.fillStyle = '#3f7a34';
    ctx.beginPath(); ctx.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#55a047';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 7, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }

  // Pickups
  const pulse = 1 + Math.sin(state.time * 4) * 0.12;
  for (const pk of state.city.pickups) {
    if (pk.taken) continue;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.scale(pulse, pulse);
    if (pk.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#2fae4e';
      ctx.fillRect(-3, -9, 6, 18);
      ctx.fillRect(-9, -3, 18, 6);
    } else if (pk.kind === 'cash') {
      ctx.fillStyle = '#2fae4e';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('$', 0, 5);
    } else {
      ctx.fillStyle = '#e8c84a';
      ctx.fillRect(-10, -7, 20, 14);
      ctx.fillStyle = '#333';
      ctx.fillRect(-6, -3, 12, 6);
    }
    ctx.restore();
  }

  // Skid marks
  ctx.strokeStyle = 'rgba(20,20,20,0.35)';
  ctx.lineWidth = 5;
  for (const s of state.skids) {
    ctx.globalAlpha = Math.min(0.5, s.life / 6);
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 16, s.y - Math.sin(s.angle) * 16);
    ctx.lineTo(s.x + Math.cos(s.angle) * 16, s.y + Math.sin(s.angle) * 16);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Cars
  for (const car of state.cars) drawCar(ctx, car, state.time);

  // Pedestrians
  for (const ped of state.peds) {
    if (ped.dead) continue;
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.walkPhase, ped.armed);
  }
  for (const cop of state.cops) {
    if (cop.dead) continue;
    drawPerson(ctx, cop.x, cop.y, cop.angle, '#1d3f8a', state.time * 8, false, true);
  }

  // Player
  const p = state.player;
  if (p.onFoot) {
    drawPerson(ctx, p.x, p.y, p.angle, '#c0392b', state.time * 8, false, false, true);
    // aim line when mouse is down / recently shot
    if (state.aimT > state.time - 0.2) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.aimAngle) * 60, p.y + Math.sin(p.aimAngle) * 60);
      ctx.stroke();
    }
  }

  // Bullets
  ctx.fillStyle = '#ffe27a';
  for (const b of state.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Particles
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Mission marker beacon
  const marker = state.marker;
  if (marker) {
    const r = 26 + Math.sin(state.time * 5) * 6;
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,74,0.25)';
    ctx.beginPath(); ctx.arc(marker.x, marker.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(marker.x, marker.y, 6, 0, Math.PI * 2); ctx.fill();
    // beam
    ctx.fillStyle = 'rgba(255,210,74,0.18)';
    ctx.fillRect(marker.x - 8, marker.y - 160, 16, 160);
  }

  ctx.restore();
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  if (car.disabled) {
    ctx.globalAlpha = 0.85;
    // smoke
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath(); ctx.arc(-8 + Math.sin(time * 3) * 3, -4, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-22, -11, 46, 26);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-23, -12, 46, 24, 7);
  ctx.fill();
  // windshield + roof
  ctx.fillStyle = 'rgba(180,220,240,0.85)';
  ctx.fillRect(4, -9, 9, 18);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-8, -9, 8, 18);
  // headlights
  ctx.fillStyle = '#fff2a0';
  ctx.fillRect(21, -10, 3, 5);
  ctx.fillRect(21, 5, 3, 5);
  if (car.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-23, -12, 46, 6);
    ctx.fillStyle = '#1d3f8a';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, -15);
    // flashing light bar
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
    ctx.fillRect(-4, -13, 8, 4);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, walkPhase, armed, isCop = false, isPlayer = false) {
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(0, 6, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  const bob = Math.sin(walkPhase) * 1.5;
  ctx.rotate(angle);
  // body
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.roundRect(-7, -6 + bob * 0.3, 15, 13, 5); ctx.fill();
  // head
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(10, 0, 6, 0, Math.PI * 2); ctx.fill();
  if (isCop) {
    ctx.fillStyle = '#12264f';
    ctx.fillRect(6, -6, 6, 4);
  }
  if (isPlayer) {
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -6, 7, 3); // cap brim
  }
  if (armed) {
    ctx.fillStyle = '#222';
    ctx.fillRect(12, -2, 10, 3);
  }
  ctx.restore();
}
