export class SoundSynth {
  constructor() {
    this.ctx = null;
    this.lastHealTime = 0;
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  play(type) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'heal') {
      if (now - this.lastHealTime < 0.85) return;
      this.lastHealTime = now;
    }

    switch (type) {
      case 'pulse': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(135, now + 0.10);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.11);
        this._noiseBurst(now, 0.04, 2400, 0.10);
        break;
      }
      case 'rail': {
        const osc = ctx.createOscillator();
        const ring = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(175, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.26);
        ring.type = 'sine';
        ring.frequency.setValueAtTime(1680, now);
        const rg = ctx.createGain();
        rg.gain.setValueAtTime(0.08, now);
        rg.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        gain.gain.setValueAtTime(0.32, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain).connect(ctx.destination);
        ring.connect(rg).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.28);
        ring.start(now); ring.stop(now + 0.19);
        this._noiseBurst(now, 0.14, 1200, 0.22);
        break;
      }
      case 'katana': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(2200, now + 0.20);
        gain.gain.setValueAtTime(0.20, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.23);
        this._noiseBurst(now, 0.18, 3200, 0.16);
        break;
      }
      case 'hit': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2200, now);
        osc.frequency.setValueAtTime(2900, now + 0.02);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.055);
        break;
      }
      case 'down': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(640, now);
        osc.frequency.exponentialRampToValueAtTime(75, now + 0.28);
        gain.gain.setValueAtTime(0.20, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.31);
        break;
      }
      case 'hurt': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(58, now + 0.20);
        gain.gain.setValueAtTime(0.26, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.22);
        break;
      }
      case 'portal': {
        [220, 330, 440].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(freq * 2.0, now + 0.52);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.11, now + 0.16);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now); osc.stop(now + 0.56);
        });
        break;
      }
      case 'heal': {
        [528, 792].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.08, now + 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now); osc.stop(now + 0.38);
        });
        break;
      }
      case 'clear': {
        [587.33, 880.0].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t0 = now + idx * 0.16;
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t0);
          gain.gain.setValueAtTime(0.16, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.30);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t0); osc.stop(t0 + 0.31);
        });
        break;
      }
      case 'elevator': {
        [330.0, 495.0, 660.0].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t0 = now + idx * 0.08;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t0);
          gain.gain.setValueAtTime(0.11, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t0); osc.stop(t0 + 0.36);
        });
        break;
      }
    }
  }

  _noiseBurst(now, dur, filterFreq, vol) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
  }
}
