// PORT VERONA — HUD (DOM) + minimap (small canvas).
import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y } from './config.js';

export function updateHUD(state) {
  const p = state.player;
  const $ = (id) => document.getElementById(id);
  const moneyEl = $('hud-money');
  if (moneyEl) moneyEl.textContent = '$' + Math.floor(p.money).toLocaleString();
  const debtEl = $('hud-debt');
  if (debtEl) debtEl.textContent = 'Debt to Sal: $50,000';
  const healthFill = $('hud-health-fill');
  if (healthFill) {
    healthFill.style.width = Math.max(0, p.health) + '%';
    healthFill.style.background = p.health > 50 ? '#2fae4e' : p.health > 25 ? '#e8a030' : '#c0392b';
  }
  const healthText = $('hud-health-text');
  if (healthText) healthText.textContent = Math.ceil(p.health) + ' HP';
  const ammoEl = $('hud-ammo');
  if (ammoEl) ammoEl.textContent = p.onFoot ? ('Ammo: ' + p.ammo + '  •  F punch  •  Click shoot') : 'Driving — W/S gas & brake, A/D steer, E exit';
  const starsEl = $('hud-stars');
  if (starsEl) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < p.wanted ? '★' : '☆';
    starsEl.textContent = s;
    starsEl.style.color = p.wanted > 0 ? '#ffd24a' : 'rgba(255,255,255,0.55)';
  }
  const objEl = $('hud-objective');
  if (objEl) objEl.textContent = state.objectiveText || '';
  const missionEl = $('hud-mission');
  if (missionEl) missionEl.textContent = state.missionTitle || '';
  const timerEl = $('hud-timer');
  if (timerEl) {
    if (state.missionTimer != null && state.missionTimer > 0) {
      timerEl.style.display = 'block';
      timerEl.textContent = '⏱ ' + Math.ceil(state.missionTimer) + 's';
      timerEl.style.color = state.missionTimer < 20 ? '#ff5a5a' : '#fff';
    } else {
      timerEl.style.display = 'none';
    }
  }
  const msgEl = $('hud-message');
  if (msgEl) {
    msgEl.textContent = state.message || '';
    msgEl.style.opacity = state.message ? '1' : '0';
  }
  const districtEl = $('hud-district');
  if (districtEl) districtEl.textContent = state.districtName || '';
}

export function drawMinimap(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const sx = W / WORLD_W, sy = H / WORLD_H;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(20,26,34,0.85)';
  ctx.fillRect(0, 0, W, H);
  // sea
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(0, 2320 * sy, W, H - 2320 * sy);
  // roads
  ctx.strokeStyle = '#8a8a92';
  ctx.lineWidth = 1.5;
  for (const rx of ROADS_X) {
    ctx.beginPath(); ctx.moveTo(rx * sx, 0); ctx.lineTo(rx * sx, H); ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath(); ctx.moveTo(0, ry * sy); ctx.lineTo(W, ry * sy); ctx.stroke();
  }
  // buildings
  ctx.fillStyle = '#c9c2b2';
  for (const b of state.city.buildings) {
    ctx.fillRect(b.x * sx, b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  }
  // mission marker
  if (state.marker) {
    const pr = 4 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(state.marker.x * sx, state.marker.y * sy, pr, 0, Math.PI * 2); ctx.fill();
  }
  // police dots
  ctx.fillStyle = '#4a9aff';
  for (const car of state.cars) {
    if (car.kind === 'police') {
      ctx.beginPath(); ctx.arc(car.x * sx, car.y * sy, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = '#ff5a5a';
  for (const cop of state.cops) {
    ctx.beginPath(); ctx.arc(cop.x * sx, cop.y * sy, 2, 0, Math.PI * 2); ctx.fill();
  }
  // player dot (with heading tick)
  const p = state.player;
  ctx.fillStyle = '#2fae4e';
  ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x * sx, p.y * sy);
  ctx.lineTo((p.x + Math.cos(p.angle) * 90) * sx, (p.y + Math.sin(p.angle) * 90) * sy);
  ctx.stroke();
  // border
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
}
