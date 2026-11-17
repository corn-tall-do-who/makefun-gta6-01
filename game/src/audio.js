// PORT VERONA — synthesized WebAudio sounds. No audio files.
let ctx = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = null;
let sirenHigh = false;

export function ensureAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // Engine hum: low sawtooth through a gain node.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 320;
      engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(ctx.destination);
      engineOsc.start();
      // Siren: square wave, toggled between two pitches.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(ctx.destination);
      sirenOsc.start();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return true;
  } catch (e) { return false; }
}

export function setEngine(speedFrac) {
  if (!ctx || !engineOsc) return;
  engineOsc.frequency.value = 46 + speedFrac * 130;
  engineGain.gain.value = speedFrac > 0.02 ? 0.028 + speedFrac * 0.03 : 0;
}

export function setSiren(on) {
  if (!ctx || !sirenOsc) return;
  sirenGain.gain.value = on ? 0.018 : 0;
  if (on && !sirenTimer) {
    sirenTimer = setInterval(() => {
      sirenHigh = !sirenHigh;
      sirenOsc.frequency.value = sirenHigh ? 920 : 660;
    }, 420);
  } else if (!on && sirenTimer) {
    clearInterval(sirenTimer); sirenTimer = null;
  }
}

function noiseBurst(dur, freq, vol) {
  if (!ctx) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(filt); filt.connect(g); g.connect(ctx.destination);
  src.start();
}

function tone(freq, dur, vol, type = 'sine', slideTo = null) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = type; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + dur);
}

export const sfx = {
  shot() { noiseBurst(0.12, 1800, 0.5); tone(160, 0.08, 0.25, 'square', 60); },
  dryClick() { tone(1200, 0.04, 0.12, 'square'); },
  punch() { noiseBurst(0.08, 700, 0.35); },
  crash() { noiseBurst(0.25, 420, 0.6); tone(90, 0.2, 0.4, 'sine', 40); },
  pickup() { tone(660, 0.09, 0.22); setTimeout(() => tone(990, 0.12, 0.22), 80); },
  cash() { tone(880, 0.07, 0.2); setTimeout(() => tone(1174, 0.07, 0.2), 70); setTimeout(() => tone(1568, 0.12, 0.2), 140); },
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 0.22), i * 110)); },
  busted() { tone(392, 0.3, 0.25, 'sawtooth', 196); setTimeout(() => tone(311, 0.4, 0.25, 'sawtooth', 155), 300); },
  hurt() { tone(220, 0.12, 0.25, 'sawtooth', 110); },
};
