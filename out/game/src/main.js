// PORT VERONA — main game: loop, states, missions, camera, shot staging.
// Title: PORT VERONA. All names, city, characters and story are original.
import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y, LANDMARKS, PLAYER_START, START_MONEY, DEBT_TOTAL, SEA_Y } from './config.js';
import { buildCity, districtAt } from './world.js';
import { initInput, keys, mouse, consumeClick } from './input.js';
import { ensureAudio, setEngine, setSiren, sfx } from './audio.js';
import { drawWorld } from './render.js';
import { updateHUD, drawMinimap } from './hud.js';
import { saveGame, loadSave, hasSave, clearSave } from './save.js';
import { MISSIONS } from './missions.js';
import {
  makeCar, makePed, makePlayer, spawnParticles, updateParticles,
  updatePlayerOnFoot, updatePlayerDriving, raiseWanted, updateWanted,
  spawnPolice, updatePoliceCars, updateCops, spawnTraffic, updateTraffic,
  spawnPeds, updatePeds, shootAt, punch, updateBullets, updateAmbushers,
  damagePlayer, CAR_COLORS,
} from './entities.js';

// Error trap: surface load errors in the title so headless checks can see them.
window.addEventListener('error', (e) => { document.title = 'ERR:' + (e.message || 'unknown'); });

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shot = params.get('shot') || '';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');

const DISTRICT_NAMES = {
  harbor: 'Old Harbor', downtown: 'Downtown', littleVerona: 'Little Verona',
  industrial: 'Industrial Yard', beach: 'Beachfront',
};

const state = {
  time: 0,
  screen: 'title', // title | playing | paused | busted | ending
  city: buildCity(seed),
  player: makePlayer(PLAYER_START.x, PLAYER_START.y),
  cars: [],
  peds: [],
  cops: [],
  bullets: [],
  particles: [],
  skids: [],
  camera: { x: 0, y: 0 },
  missionIndex: 0,
  phase: 0,
  objectiveText: '',
  missionTitle: '',
  missionTimer: null,
  marker: null,
  message: '',
  messageT: 0,
  districtName: 'Downtown',
  input: { keys, mouse },
  engineFrac: 0,
  scaredT: -1,
  aimT: -1,
  aimAngle: 0,
  collected: 0,
  grabT: 0,
  ambushSpawned: false,
  saveT: 0,
  endStats: null,
  bustedInfo: null,
};

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ---- world population ----
function populateWorld() {
  state.cars = [];
  state.peds = [];
  state.cops = [];
  state.bullets = [];
  state.particles = [];
  state.skids = [];
  for (const pc of state.city.parkedCars) {
    state.cars.push(makeCar(pc.x, pc.y, pc.angle, pc.color, 'parked'));
  }
  spawnTraffic(state, 14);
  spawnPeds(state, 26);
}
populateWorld();

// ---- missions ----
function currentMission() {
  return MISSIONS[state.missionIndex] || null;
}

function setMission(i) {
  state.missionIndex = i;
  state.phase = 0;
  state.collected = 0;
  state.grabT = 0;
  state.ambushSpawned = false;
  state.missionTimer = null;
  const m = currentMission();
  if (!m) return;
  state.missionTitle = 'Mission ' + m.id + ' — ' + m.title;
  state.missionTimer = m.timeLimit || null;
  updateMarker();
  state.message = 'New mission: ' + m.title + ' — $' + m.reward.toLocaleString() + ' reward';
  state.messageT = 4;
  sfx.mission();
}

function updateMarker() {
  const m = currentMission();
  if (!m) { state.marker = null; return; }
  if (state.missionIndex === 2) { // The Collection: marker follows next debtor
    state.marker = state.collected < 3 ? LANDMARKS.debtors[state.collected] : null;
    return;
  }
  const ph = m.phases[state.phase];
  state.marker = ph ? ph.marker : null;
}

function missionObjectiveText() {
  const m = currentMission();
  if (!m) return '';
  if (state.missionIndex === 2) {
    return 'Collect from 3 debtors (' + state.collected + '/3)';
  }
  if (state.missionIndex === 5) {
    const need = DEBT_TOTAL - state.player.money;
    if (need > 0) return 'You need $' + need.toLocaleString() + ' more — grab cash pickups around the city';
    return m.phases[state.phase].text;
  }
  return m.phases[state.phase] ? m.phases[state.phase].text : '';
}

function completeMission() {
  const m = currentMission();
  if (!m) return;
  state.player.money += m.reward;
  state.message = 'Mission complete: ' + m.title + '  +$' + m.reward.toLocaleString();
  state.messageT = 4;
  sfx.mission();
  saveGame(state);
  if (state.missionIndex >= MISSIONS.length - 1) {
    // Mission 6 delivered the debt — ending.
    state.player.money -= DEBT_TOTAL;
    state.endStats = {
      money: state.player.money,
      missions: MISSIONS.length,
      time: state.time,
    };
    state.screen = 'ending';
    showOverlay('ending');
    return;
  }
  setMission(state.missionIndex + 1);
}

function failMission2() {
  state.message = 'Too slow — the package is late. Try again!';
  state.messageT = 4;
  state.phase = 0;
  state.missionTimer = 90;
  updateMarker();
}

function distTo(x, y) {
  return Math.hypot(state.player.x - x, state.player.y - y);
}

function updateMission(dt) {
  const m = currentMission();
  if (!m || state.screen !== 'playing') return;
  const p = state.player;

  if (m.timeLimit && state.missionTimer != null) {
    state.missionTimer -= dt;
    if (state.missionTimer <= 0) { failMission2(); return; }
  }

  switch (state.missionIndex) {
    case 0: { // Back on the Streets
      if (state.phase === 0 && distTo(LANDMARKS.salOffice.x, LANDMARKS.salOffice.y) < 80) {
        state.phase = 1; updateMarker();
        state.message = 'Sal: "Good. Now get yourself a car — any car."';
        state.messageT = 4;
      } else if (state.phase === 1 && !p.onFoot) {
        state.phase = 2; updateMarker();
        state.message = 'Now drive back to Sal\'s office.';
        state.messageT = 3;
      } else if (state.phase === 2 && !p.onFoot && distTo(LANDMARKS.salOffice.x, LANDMARKS.salOffice.y) < 100) {
        completeMission();
      }
      break;
    }
    case 1: { // Harbor Run
      if (distTo(LANDMARKS.docks.x, LANDMARKS.docks.y) < 100) completeMission();
      break;
    }
    case 2: { // The Collection
      if (state.collected < 3) {
        const d = LANDMARKS.debtors[state.collected];
        if (distTo(d.x, d.y) < 80) {
          state.collected += 1;
          p.money += 400;
          state.message = 'Collected $400 from ' + d.label.split(': ')[1] + ' (' + state.collected + '/3)';
          state.messageT = 3;
          sfx.cash();
          updateMarker();
          if (state.collected >= 3) completeMission();
        }
      }
      break;
    }
    case 3: { // Bank Job
      if (state.phase === 0) {
        if (p.onFoot && distTo(LANDMARKS.bank.x, LANDMARKS.bank.y) < 70) {
          state.grabT += dt;
          state.message = 'Grabbing the cash… ' + Math.ceil(2.5 - state.grabT) + 's';
          state.messageT = 0.3;
          if (state.grabT >= 2.5) {
            state.phase = 1; updateMarker();
            p.money += 2000;
            raiseWanted(state, 3);
            state.message = 'Alarms! Wanted level 3 — lose the cops!';
            state.messageT = 4;
            sfx.mission();
          }
        } else {
          state.grabT = 0;
        }
      } else if (state.phase === 1 && p.wanted === 0) {
        completeMission();
      }
      break;
    }
    case 4: { // Arms Deal
      if (state.phase === 0 && distTo(LANDMARKS.supplier.x, LANDMARKS.supplier.y) < 90) {
        state.phase = 1; updateMarker();
        state.message = 'Ambush! Rival crew — take them all down!';
        state.messageT = 4;
        // spawn 4 armed attackers
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          const ped = makePed(LANDMARKS.supplier.x + Math.cos(a) * 150, LANDMARKS.supplier.y + Math.sin(a) * 150);
          ped.armed = true; ped.hp = 80; ped.shirt = '#222'; ped.speed = 55;
          state.peds.push(ped);
        }
        state.ambushSpawned = true;
        raiseWanted(state, 1);
      } else if (state.phase === 1 && state.ambushSpawned) {
        const left = state.peds.filter((pd) => pd.armed && !pd.dead).length;
        if (left === 0) completeMission();
      }
      break;
    }
    case 5: { // Paying Sal Back
      if (p.money >= DEBT_TOTAL && distTo(LANDMARKS.salOffice.x, LANDMARKS.salOffice.y) < 90) {
        completeMission();
      }
      break;
    }
  }
  state.objectiveText = missionObjectiveText();
}

// ---- car enter / exit ----
function nearestCar(maxD) {
  const p = state.player;
  let best = null, bestD = maxD;
  for (const car of state.cars) {
    if (car.disabled) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar() {
  const p = state.player;
  if (!p.onFoot) return;
  const car = nearestCar(78);
  if (!car) return;
  const stolen = car.kind !== 'player';
  p.car = car;
  p.onFoot = false;
  car.kind = 'player';
  car.speed = 0;
  if (stolen) {
    raiseWanted(state, 1);
    state.message = 'You stole a car! Wanted up.';
    state.messageT = 2.5;
  }
}

function exitCar() {
  const p = state.player;
  if (p.onFoot || !p.car) return;
  const car = p.car;
  car.speed = 0;
  car.kind = 'player';
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  p.y = Math.min(p.y, SEA_Y - 20);
  p.onFoot = true;
  p.car = null;
  p.speed = 0;
}

// ---- pickups ----
function checkPickups() {
  const p = state.player;
  for (const pk of state.city.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 34) {
      pk.taken = true;
      if (pk.kind === 'health') {
        p.health = Math.min(100, p.health + 40);
        state.message = 'Health +40';
        sfx.pickup();
      } else if (pk.kind === 'cash') {
        p.money += pk.amount;
        state.message = 'Found $' + pk.amount + ' cash';
        sfx.cash();
      } else {
        p.ammo += 12;
        state.message = 'Ammo +12';
        sfx.pickup();
      }
      state.messageT = 2;
      spawnParticles(state.particles, pk.x, pk.y, 10, '#ffe27a', 140, 0.5, 3);
    }
  }
}

// ---- overlays / screens ----
const overlays = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  busted: document.getElementById('screen-busted'),
  ending: document.getElementById('screen-ending'),
};

function showOverlay(name) {
  for (const k of Object.keys(overlays)) {
    if (overlays[k]) overlays[k].style.display = k === name ? 'flex' : 'none';
  }
  document.getElementById('hud').style.display = (name === null && state.screen === 'playing') ? 'block' : 'none';
  if (name === 'busted' && state.bustedInfo) {
    const el = document.getElementById('busted-text');
    if (el) el.textContent = state.bustedInfo.reason + ' You lost $' + state.bustedInfo.lost.toLocaleString() + ' and woke up at Verona General Hospital.';
  }
  if (name === 'ending' && state.endStats) {
    const el = document.getElementById('ending-stats');
    if (el) el.textContent = 'All 6 missions complete • Debt to Sal: PAID • Cash left: $' + Math.floor(state.endStats.money).toLocaleString();
  }
}

function startGame(fromSave) {
  ensureAudio();
  const save = fromSave ? loadSave() : null;
  state.player = makePlayer(PLAYER_START.x, PLAYER_START.y);
  state.player.money = START_MONEY;
  populateWorld();
  state.missionIndex = 0;
  if (save) {
    state.player.money = save.money;
    state.player.x = save.x; state.player.y = save.y;
    state.player.health = save.health || 100;
    state.player.ammo = save.ammo || 12;
    setMission(Math.min(save.missionIndex, MISSIONS.length - 1));
    state.message = 'Welcome back, Vic. Save loaded.';
    state.messageT = 3;
  } else {
    clearSave();
    setMission(0);
  }
  state.screen = 'playing';
  showOverlay(null);
  document.getElementById('hud').style.display = 'block';
}

// ---- input wiring ----
initInput(canvas, {
  onKeyDown(k) {
    ensureAudio();
    if (k === 'escape' || k === 'p') {
      if (state.screen === 'playing') { state.screen = 'paused'; showOverlay('pause'); saveGame(state); }
      else if (state.screen === 'paused') { state.screen = 'playing'; showOverlay(null); document.getElementById('hud').style.display = 'block'; }
      return;
    }
    if (state.screen !== 'playing') return;
    if (k === 'e') { if (state.player.onFoot) enterCar(); else exitCar(); }
    if (k === 'f') punch(state);
  },
});

document.getElementById('btn-start').addEventListener('click', () => startGame(false));
const btnContinue = document.getElementById('btn-continue');
if (hasSave()) {
  btnContinue.style.display = 'inline-block';
  btnContinue.addEventListener('click', () => startGame(true));
}
document.getElementById('btn-resume').addEventListener('click', () => {
  state.screen = 'playing'; showOverlay(null); document.getElementById('hud').style.display = 'block';
});
document.getElementById('btn-restart').addEventListener('click', () => {
  state.screen = 'title'; showOverlay('title');
});
document.getElementById('btn-busted').addEventListener('click', () => {
  state.screen = 'playing'; showOverlay(null); document.getElementById('hud').style.display = 'block';
});
document.getElementById('btn-again').addEventListener('click', () => {
  startGame(false);
});

// ---- screenshot staging (?shot=...) ----
function stageShot() {
  if (shot === 'start') {
    state.screen = 'title';
    showOverlay('title');
    return;
  }
  if (shot === 'play') {
    startGame(false);
    // Stage a mid-gameplay scene: Vic driving downtown, wanted 2, police on his tail.
    // Mission 1 is at its driving phase so the objective matches the scene.
    state.phase = 2;
    updateMarker();
    const car = makeCar(1400, 1000, 0, '#c0392b', 'player');
    car.speed = 260;
    state.cars.push(car);
    state.player.car = car;
    state.player.onFoot = false;
    state.player.x = car.x; state.player.y = car.y; state.player.angle = 0;
    state.player.wanted = 2;
    state.player.money = 12500;
    state.player.ammo = 18;
    spawnPolice(state);
    // One patrol car close behind, in frame, lights flashing.
    const patrol = makeCar(1020, 1000, 0, '#e8e8e8', 'police');
    patrol.speed = 300;
    state.cars.push(patrol);
    // a couple of traffic cars right in frame
    const t1 = makeCar(1180, 1000, 0, '#2e6fb0', 'traffic');
    t1.road = { vertical: false, value: 1000, dir: 1 }; t1.speed = 130;
    const t2 = makeCar(1620, 978, Math.PI, '#e0a030', 'traffic');
    t2.road = { vertical: false, value: 1000, dir: -1 }; t2.speed = 120;
    state.cars.push(t1, t2);
    state.message = 'Mission 1 — Back on the Streets';
    state.messageT = 99;
    state.camera.x = state.player.x - canvas.width / 2;
    state.camera.y = state.player.y - canvas.height / 2;
    return;
  }
  if (shot === 'end') {
    state.endStats = { money: 2450, missions: 6, time: 1840 };
    state.screen = 'ending';
    showOverlay('ending');
    return;
  }
}

// ---- main loop ----
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.time += dt;

  if (state.screen === 'playing') {
    const p = state.player;
    // mouse aim (world coords)
    mouse.worldX = mouse.x + state.camera.x;
    mouse.worldY = mouse.y + state.camera.y;
    if (p.onFoot) {
      p.aimAngle = Math.atan2(mouse.worldY - p.y, mouse.worldX - p.x);
    } else if (p.car) {
      p.aimAngle = Math.atan2(mouse.worldY - p.car.y, mouse.worldX - p.car.x);
    }
    if (consumeClick()) {
      state.aimT = state.time;
      shootAt(state, mouse.worldX, mouse.worldY);
    }
    if (p.onFoot) updatePlayerOnFoot(state, dt);
    else updatePlayerDriving(state, dt);
    updateTraffic(state, dt);
    updatePeds(state, dt);
    updatePoliceCars(state, dt);
    updateCops(state, dt);
    updateBullets(state, dt);
    updateAmbushers(state, dt);
    updateWanted(state, dt);
    updateMission(dt);
    checkPickups();
    updateParticles(state.particles, dt);
    for (let i = state.skids.length - 1; i >= 0; i--) {
      state.skids[i].life -= dt;
      if (state.skids[i].life <= 0) state.skids.splice(i, 1);
    }
    if (state.messageT > 0) state.messageT -= dt;
    if (state.messageT <= 0) state.message = '';
    // camera follows smoothly
    const tx = Math.max(0, Math.min(WORLD_W - canvas.width, p.x - canvas.width / 2));
    const ty = Math.max(0, Math.min(WORLD_H - canvas.height, p.y - canvas.height / 2));
    state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);
    state.districtName = DISTRICT_NAMES[districtAt(p.x, p.y)] || 'Port Verona';
    // audio
    setEngine(p.onFoot ? 0 : state.engineFrac);
    setSiren(p.wanted > 0);
    // autosave
    state.saveT += dt;
    if (state.saveT > 12) { state.saveT = 0; saveGame(state); }
    updateHUD(state);
    drawMinimap(minimap, state);
  } else if (state.screen === 'title' || state.screen === 'ending' || state.screen === 'busted') {
    // keep the world alive behind overlays (ambient traffic)
    updateTraffic(state, dt);
    updatePeds(state, dt);
    updateParticles(state.particles, dt);
    const p = state.player;
    const tx = Math.max(0, Math.min(WORLD_W - canvas.width, p.x - canvas.width / 2));
    const ty = Math.max(0, Math.min(WORLD_H - canvas.height, p.y - canvas.height / 2));
    state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 2);
    state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 2);
  }

  // render (always, so screenshots capture the scene)
  ctx.fillStyle = '#cdb98f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawWorld(ctx, state);
  requestAnimationFrame(frame);
}

// Boot
setMission(0);
state.objectiveText = missionObjectiveText();
state.screen = 'title';
showOverlay('title');
if (shot) stageShot();
requestAnimationFrame(frame);
