// PORT VERONA — keyboard + mouse input.
export const keys = {};
export const mouse = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };

let onKeyDown = null;
let onKeyUp = null;

export function initInput(canvas, callbacks = {}) {
  onKeyDown = callbacks.onKeyDown || null;
  onKeyUp = callbacks.onKeyUp || null;

  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!keys[k]) {
      keys[k] = true;
      if (onKeyDown) onKeyDown(k, e);
    } else {
      keys[k] = true;
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys[k] = false;
    if (onKeyUp) onKeyUp(k, e);
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function isDown(...names) {
  return names.some((n) => keys[n]);
}

export function consumeClick() {
  const c = mouse.clicked;
  mouse.clicked = false;
  return c;
}
