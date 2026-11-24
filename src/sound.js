const PALETTES = {
  sun: { click: 720, chime: [392, 494, 587, 784], wave: "triangle" },
  moon: { click: 510, chime: [294, 349, 440, 523], wave: "sine" },
};

export class Sound {
  constructor() {
    this.enabled = false;
    this.palette = PALETTES.sun;
    this.lastTick = -Infinity;
  }

  setMode(mode) {
    this.palette = PALETTES[mode] ?? PALETTES.sun;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) this.master.gain.value = enabled ? 0.66 : 0;
  }

  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        const Audio = window.AudioContext ?? window.webkitAudioContext;
        const context = new Audio();
        const master = context.createGain();
        master.gain.value = 0.66;
        master.connect(context.destination);

        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.12), context.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

        this.context = context;
        this.master = master;
        this.noiseBuffer = buffer;
      }
      if (this.context.state !== "running") this.context.resume().catch(() => {});
    } catch {
      // Audio can be unavailable. The controls still work in silence.
    }
  }

  play(source, t, duration, volume, filter = null) {
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.linearRampToValueAtTime(volume, t + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    if (filter) {
      source.connect(filter);
      filter.connect(envelope);
    } else source.connect(envelope);
    envelope.connect(this.master);
    source.start(t);
    source.stop(t + duration);
  }

  tone(frequency, duration, volume, { delay = 0, end = frequency, wave = this.palette.wave } = {}) {
    if (!this.enabled || !this.context) return;
    const t = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, t);
    oscillator.frequency.exponentialRampToValueAtTime(end, t + duration);
    this.play(oscillator, t, duration, volume);
  }

  noise(frequency, duration, volume, delay = 0) {
    if (!this.enabled || !this.context) return;
    const t = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 1.1;
    this.play(source, t, duration, volume, filter);
  }

  grab() {
    this.unlock();
    this.noise(430, 0.032, 0.12);
    this.tone(165, 0.048, 0.055, { end: 102 });
  }

  launch(power) {
    this.unlock();
    this.lastTick = -Infinity;
    this.noise(750 + 450 * power, 0.085, 0.22);
    this.tone(148 + 55 * power, 0.14, 0.16, { end: 58, wave: "triangle" });
  }

  tick(progress) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    if (now - this.lastTick < 0.037) return;
    this.lastTick = now;
    const pitch = this.palette.click * (1.22 - 0.32 * progress);
    this.noise(pitch * 2, 0.026, 0.10 + 0.04 * progress);
    this.tone(pitch, 0.033, 0.055, { end: pitch * 0.7 });
  }

  win() {
    for (const delay of [0, 0.065, 0.13]) {
      this.noise(980, 0.055, 0.12, delay);
    }
    this.noise(1600, 0.028, 0.10, 0.19);
    this.palette.chime.forEach((note, index) => {
      const delay = 0.22 + index * 0.09;
      this.tone(note, index === 3 ? 0.42 : 0.25, 0.105, { delay });
      this.tone(note * 2, 0.105, 0.025, { delay, wave: "sine" });
    });
  }

  select() {
    this.unlock();
    this.noise(this.palette.click * 1.5, 0.023, 0.09);
    this.tone(this.palette.chime[1], 0.075, 0.06);
  }
}
