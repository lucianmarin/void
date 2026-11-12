export class SoundSynth {
  constructor() {
    this.ctx = null;
    this.lastHealTime = 0;

    // Soundtrack state
    this.musicStarted = false;
    this.musicMuted = false;
    this.musicMaster = null;
    this.padFilter = null;
    this.subOsc = null;
    this.padOsc1 = null;
    this.padOsc2 = null;
    this.shimmerOsc = null;
    this.shimmerGain = null;
    this.delaySend = null;
    this.nextNoteTime = 0;
    this.stepIndex = 0;
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.musicStarted) {
      this._initSoundtrack();
    }
    return this.ctx;
  }

  toggleMute() {
    this.ensureContext();
    this.musicMuted = !this.musicMuted;
    if (this.musicMaster && this.ctx) {
      this.musicMaster.gain.setTargetAtTime(
        this.musicMuted ? 0.0001 : 0.24,
        this.ctx.currentTime,
        0.15
      );
    }
    return this.musicMuted;
  }

  _initSoundtrack() {
    const ctx = this.ctx;
    if (!ctx || this.musicStarted) return;
    this.musicStarted = true;
    const now = ctx.currentTime;

    // Master bus for the haunting soundtrack
    this.musicMaster = ctx.createGain();
    this.musicMaster.gain.setValueAtTime(0.0001, now);
    this.musicMaster.gain.linearRampToValueAtTime(this.musicMuted ? 0.0001 : 0.24, now + 2.5);
    this.musicMaster.connect(ctx.destination);

    // Abyssal feedback delay + damping lowpass (synthetic haunting space)
    const delay = ctx.createDelay(2.0);
    delay.delayTime.setValueAtTime(0.46, now);
    const feedback = ctx.createGain();
    feedback.gain.setValueAtTime(0.52, now);
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.setValueAtTime(1350, now);

    this.delaySend = ctx.createGain();
    this.delaySend.gain.setValueAtTime(0.38, now);

    this.delaySend.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(this.musicMaster);

    // Breathing lowpass filter for dark Vangelis/brutalist pad drones
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.setValueAtTime(190, now);
    this.padFilter.Q.setValueAtTime(2.4, now);
    this.padFilter.connect(this.musicMaster);
    this.padFilter.connect(this.delaySend);

    // Slow LFO modulating the pad filter cutoff
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.09, now);
    lfoGain.gain.setValueAtTime(65, now);
    lfo.connect(lfoGain).connect(this.padFilter.frequency);
    lfo.start(now);

    // Deep sub-bass drone (A1 = 55 Hz)
    this.subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    this.subOsc.type = 'triangle';
    this.subOsc.frequency.setValueAtTime(55.0, now);
    subGain.gain.setValueAtTime(0.28, now);
    this.subOsc.connect(subGain).connect(this.padFilter);
    this.subOsc.start(now);

    // Detuned haunting minor/fifth pad oscillators (A2 = 110 Hz, E3 = 164.81 Hz)
    this.padOsc1 = ctx.createOscillator();
    this.padOsc2 = ctx.createOscillator();
    const padGain1 = ctx.createGain();
    const padGain2 = ctx.createGain();

    this.padOsc1.type = 'sawtooth';
    this.padOsc2.type = 'sawtooth';
    this.padOsc1.frequency.setValueAtTime(110.0, now);
    this.padOsc2.frequency.setValueAtTime(164.81, now);
    this.padOsc1.detune.setValueAtTime(-11, now);
    this.padOsc2.detune.setValueAtTime(13, now);

    padGain1.gain.setValueAtTime(0.11, now);
    padGain2.gain.setValueAtTime(0.09, now);

    this.padOsc1.connect(padGain1).connect(this.padFilter);
    this.padOsc2.connect(padGain2).connect(this.padFilter);
    this.padOsc1.start(now);
    this.padOsc2.start(now);

    // High ethereal sanctuary shimmer (active on Void Planet)
    this.shimmerOsc = ctx.createOscillator();
    this.shimmerGain = ctx.createGain();
    this.shimmerOsc.type = 'sine';
    this.shimmerOsc.frequency.setValueAtTime(440.0, now);
    this.shimmerGain.gain.setValueAtTime(0.0001, now);
    this.shimmerOsc.connect(this.shimmerGain).connect(this.delaySend);
    this.shimmerOsc.start(now);

    this.nextNoteTime = now + 0.4;
  }

  updateMusic({ inSkyTower = true, combatCount = 0, bossActive = false, lowHealth = false, paused = false } = {}) {
    if (!this.ctx || !this.musicStarted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // Duck master volume slightly on pause modal, mute if toggled
    const targetMaster = this.musicMuted ? 0.0001 : (paused ? 0.11 : 0.25);
    this.musicMaster.gain.setTargetAtTime(targetMaster, now, 0.25);

    // Shift harmonic root & filter tension based on realm and combat state
    const rootFreq = bossActive ? 49.0 : (inSkyTower ? 55.0 : 65.41); // G1 (boss), A1 (Sky Tower), C2 (Void Planet)
    const fifthFreq = rootFreq * 3.0; // Octave + fifth
    this.subOsc.frequency.setTargetAtTime(rootFreq, now, 0.8);
    this.padOsc1.frequency.setTargetAtTime(rootFreq * 2.0, now, 0.8);
    this.padOsc2.frequency.setTargetAtTime(fifthFreq, now, 0.8);

    const baseCutoff = !inSkyTower
      ? 310
      : bossActive
        ? 460
        : combatCount > 0
          ? 240 + Math.min(140, combatCount * 22)
          : 155;
    this.padFilter.frequency.setTargetAtTime(baseCutoff, now, 0.5);

    // Ethereal shimmer swells in Void Planet Sanctuary
    this.shimmerOsc.frequency.setTargetAtTime(inSkyTower ? 440.0 : 523.25, now, 0.6);
    this.shimmerGain.gain.setTargetAtTime(inSkyTower ? 0.002 : 0.045, now, 0.7);

    // Schedule sparse haunting Phrygian / minor arpeggio & sub-pulse notes
    if (now >= this.nextNoteTime) {
      this._triggerHauntingNote(now, { inSkyTower, combatCount, bossActive, lowHealth, paused });
      const stepDur = bossActive ? 0.36 : (!inSkyTower ? 1.15 : (combatCount > 0 ? 0.58 : 0.92));
      this.nextNoteTime = now + stepDur;
      this.stepIndex = (this.stepIndex + 1) % 16;
    }
  }

  _triggerHauntingNote(now, { inSkyTower, combatCount, bossActive, lowHealth, paused }) {
    const ctx = this.ctx;
    // A Phrygian / Aeolian haunting intervals in Hz (A3, Bb3, C4, E4, F4, A4, C5, E5)
    const skyNotes = [220.0, 233.08, 261.63, 329.63, 349.23, 440.0, 523.25, 659.25];
    // Void Planet Lydian/suspended sanctuary intervals (C4, D4, E4, G4, B4, D5)
    const voidNotes = [261.63, 293.66, 329.63, 392.0, 493.88, 587.33];

    // Dark industrial sub-heartbeat on quarter steps during active combat or low HP
    if (inSkyTower && !paused && (combatCount > 0 || lowHealth) && this.stepIndex % 2 === 0) {
      const kick = ctx.createOscillator();
      const kGain = ctx.createGain();
      kick.type = 'sine';
      const startF = bossActive ? 98 : 78;
      kick.frequency.setValueAtTime(startF, now);
      kick.frequency.exponentialRampToValueAtTime(28, now + 0.22);
      const pulseVol = lowHealth ? 0.22 : (bossActive ? 0.19 : 0.13);
      kGain.gain.setValueAtTime(pulseVol, now);
      kGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);
      kick.connect(kGain).connect(this.musicMaster);
      kick.start(now);
      kick.stop(now + 0.25);
    }

    // Sparse melodic plucks / ghostly bell tones (skip some steps for breathing room)
    const playMelody = (this.stepIndex % 3 === 0) || (bossActive && this.stepIndex % 2 === 1);
    if (!playMelody) return;

    const scale = inSkyTower ? skyNotes : voidNotes;
    const pattern = [0, 3, 1, 4, 2, 5, 3, 6];
    const noteIdx = pattern[(this.stepIndex + (bossActive ? 2 : 0)) % pattern.length] % scale.length;
    const freq = scale[noteIdx];

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = inSkyTower ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now);
    // Subtle ghostly pitch drift
    osc.frequency.linearRampToValueAtTime(freq * (inSkyTower ? 0.996 : 1.002), now + 1.1);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(inSkyTower ? 1400 : 2100, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 1.15);

    const attack = inSkyTower ? 0.04 : 0.18;
    const release = inSkyTower ? 1.15 : 1.85;
    const peak = paused ? 0.05 : (inSkyTower ? 0.09 : 0.11);

    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + release);

    osc.connect(filter).connect(gain);
    gain.connect(this.musicMaster);
    gain.connect(this.delaySend);

    osc.start(now);
    osc.stop(now + release + 0.05);
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
