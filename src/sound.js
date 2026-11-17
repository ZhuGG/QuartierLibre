export class Sound {
  constructor() {
    this.enabled = false;
  }
  unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      this.context.resume().catch(() => {});
    } catch {
      this.enabled = false;
    }
  }
  tone(
    frequency,
    duration = 0.04,
    volume = 0.035,
    delay = 0,
    type = "triangle",
  ) {
    if (!this.enabled || !this.context) return;
    const t = this.context.currentTime + delay,
      o = this.context.createOscillator(),
      g = this.context.createGain();
    o.type = type;
    o.frequency.setValueAtTime(frequency, t);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(this.context.destination);
    o.start(t);
    o.stop(t + duration);
  }
  tick(p) {
    this.tone(260 + 180 * (1 - p), 0.025, 0.025, 0, "square");
  }
  win() {
    [330, 440, 554, 660].forEach((n, i) => this.tone(n, 0.22, 0.045, i * 0.09));
  }
  select() {
    this.unlock();
    this.tone(440, 0.06, 0.025);
    this.tone(660, 0.08, 0.025, 0.06);
  }
}
