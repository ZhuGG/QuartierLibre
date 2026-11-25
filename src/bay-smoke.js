const palettes = {
  choose: ["#e7b18a", "#89cddc"],
  sun: ["#f3b478", "#a9c5be"],
  moon: ["#a4b8e4", "#73d4ef"],
};

const lanes = [
  { side: 0, x: 0.12, y: 0.91, reach: 0.28, period: 15, offset: 0.13 },
  { side: 1, x: 0.13, y: 0.92, reach: 0.28, period: 17, offset: 0.43 },
  { side: 0, x: 0.16, y: 0.85, reach: 0.22, period: 19, offset: 0.69 },
  { side: 1, x: 0.17, y: 0.84, reach: 0.22, period: 21, offset: 0.28 },
];

const TAU = Math.PI * 2;
const part = (value) => value - Math.floor(value);
const smooth = (value) => value * value * (3 - 2 * value);
const mix = (a, b, weight) => a + (b - a) * weight;
const random = (seed) => part(Math.sin(seed * 78.233 + 12.9898) * 43758.5453);

function noise(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const wx = smooth(part(x));
  const wy = smooth(part(y));
  const key = ix * 39.21 + iy * 82.43 + seed * 17.7;
  return mix(
    mix(random(key), random(key + 39.21), wx),
    mix(random(key + 82.43), random(key + 121.64), wx),
    wy,
  );
}

function smokeSprite(seed) {
  const size = 112;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const pixels = ctx.createImageData(size, size);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const x = col / size * 2 - 1;
      const y = row / size * 2 - 1;
      const curl = noise(x * 2.5, y * 4, seed) - 0.5;
      const ridges = noise(x * 3.1 + curl, y * 7 + curl * 1.8, seed + 4);
      const folds = noise(x * 9, y * 12 + curl, seed + 5);
      const edge = Math.max(0, 1 - Math.hypot(x, y));
      const density = Math.max(0, (ridges * 0.75 + folds * 0.25 - 0.26) * 1.85);
      const offset = (row * size + col) * 4;
      pixels.data.fill(255, offset, offset + 3);
      pixels.data[offset + 3] = Math.round(255 * edge ** 0.78 * density);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function tint(sprite, color) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = sprite.width;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(sprite, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function dustGrains() {
  return Array.from({ length: 83 }, (_, i) => ({
    side: i % 2,
    depth: random(i * 2 + 1),
    x: random(i * 4 + 2),
    y: 0.13 + random(i * 8 + 3) * 0.95,
    speed: 11 + random(i * 7 + 4) * 17,
    phase: random(i * 5 + 5),
    glint: random(i * 6 + 6),
  }));
}

export function mountBaySmoke(canvas, cabinet) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const sprites = Array.from({ length: 4 }, (_, i) => smokeSprite(i + 1));
  const smoke = Object.fromEntries(
    Object.entries(palettes).map(([mode, colors]) => [
      mode, colors.map((color) => sprites.map((sprite) => tint(sprite, color))),
    ]),
  );
  const grains = dustGrains();
  let width = 0;
  let height = 0;
  let edge = 0;
  let scale = 0.65;
  let frame = 0;
  let last = 0;
  let time = 0;
  let excitation = 0;
  let narrow = false;

  function draw(t, light) {
    const mode = document.body.dataset.mode || "choose";
    const colors = palettes[mode];
    ctx.clearRect(0, 0, width, height);
    const driftWidth = Math.min(edge * 0.9, 370);

    // Behind the rising wisps, a second current spreads along the floor.
    for (let side = 0; side < 2; side++) {
      const direction = side ? -1 : 1;
      for (let i = 0; i < 3; i++) {
        const progress = part(t / (22 + i * 4) + (i + side) * 0.36);
        const radius = driftWidth * (0.4 + progress * 0.86);
        const x = (side ? width : 0) + direction * edge * (0.11 + 0.89 * progress);
        const y = height * (0.96 - i * 0.042) + Math.sin(t * 0.34 + i) * 10;
        ctx.globalAlpha = Math.sin(progress * Math.PI) * (0.28 + light * 0.18);
        ctx.drawImage(smoke[mode][side][i], x - radius, y - radius * 0.29, radius * 2, radius * 0.58);
      }
    }

    lanes.forEach((lane, index) => {
      const direction = lane.side ? -1 : 1;
      const offset = narrow ? edge * 0.26 : Math.min(edge * 0.68, width * lane.x);
      const anchor = lane.side ? width - offset : offset;
      const reach = Math.min(edge * 0.91, width * lane.reach, 260);
      const smokeSide = smoke[mode][lane.side];
      for (let i = 0; i < 12; i++) {
        const age = part(t / lane.period + lane.offset + i / 12);
        const envelope = Math.sin(age * Math.PI) ** 1.55;
        const bend = Math.sin(age * TAU * 1.24 - t * 0.39 + index);
        const twist = Math.sin(age * TAU * 2.8 + t * 0.41);
        const x = anchor + direction * reach * (age * 0.14 + bend * (0.1 + age * 0.42) + twist * 0.1);
        const y = height * (lane.y - age * (index < 2 ? 0.7 : 0.51));
        const radius = (narrow ? 17 : 24) + age * (narrow ? 36 : 116);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(direction * (bend * 0.85 + twist * 0.24));
        ctx.globalAlpha = envelope * (index < 2 ? 0.37 : 0.23) * (1 + light * 0.8);
        ctx.drawImage(smokeSide[(i + index) % 4], -radius, -radius * 0.59, 2 * radius, radius * 1.18);
        ctx.restore();
      }
    });

    grains.forEach((grain) => {
      const { side, depth, speed, phase, glint } = grain;
      if (narrow && depth < 0.38) return;
      const direction = side ? -1 : 1;
      const age = part(t / speed + phase);
      const drift = Math.sin(t * (0.48 + depth * 0.35) + phase * TAU);
      const x = (side ? width : 0) + direction * edge * (0.08 + grain.x * 0.94 + drift * 0.075);
      const y = height * (grain.y + 0.08 - age * 0.28) + drift * 13;
      const beam = Math.max(0, 1 - Math.abs(grain.x - 0.48 - 0.20 * Math.sin(y / height * Math.PI + side)) * 4.7);
      const wink = 0.54 + 0.46 * Math.sin(t * (0.9 + glint * 1.5) + glint * TAU);
      const alpha = Math.sin(age * Math.PI) * (0.15 + beam * 0.58) * (0.46 + wink * 0.54);
      const size = depth > 0.87 ? 3.5 : 1.35 + depth * 1.48;
      const glow = beam > 0.5 && depth > 0.66;
      if (glow) {
        const radius = size * 2.2;
        ctx.globalAlpha = alpha * (0.16 + light * 0.27);
        ctx.fillStyle = colors[side];
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = Math.min(0.94, alpha * (1 + light * 0.75));
      ctx.fillStyle = glow && wink > 0.56 ? "#eef5df" : colors[side];
      ctx.fillRect(Math.round(x), Math.round(y), size, size * (depth > 0.87 ? 0.66 : 1));
    });
    ctx.globalAlpha = 1;
  }

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    narrow = width < 650;
    edge = narrow ? Math.max(37, width * 0.13) : Math.max(64, (width - 510) / 2);
    scale = Math.min(0.8, 1440 / Math.max(1, width));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (width && height) draw(4.8, 0);
  }

  function paint(now) {
    frame = requestAnimationFrame(paint);
    if (!width || !height || now - last < 1000 / 30) return;
    const delta = last ? Math.min(90, now - last) : 0;
    last = now;
    const classes = cabinet.classList;
    const target = classes.contains("printing") ? 0.94
      : classes.contains("spinning") ? (classes.contains("braking") ? 0.35 : 0.73)
        : classes.contains("charging") ? 0.51 : 0;
    excitation = mix(excitation, target, 1 - Math.exp(-delta / 310));
    time += delta / 1000 * (1 + excitation * 0.65);
    draw(time + 4.8, excitation);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    if (document.hidden) return;
    resize();
    if (!reduced.matches) frame = requestAnimationFrame(paint);
  }

  const size = new ResizeObserver(resize);
  size.observe(canvas);
  const modeChanges = new MutationObserver(() => {
    if (reduced.matches && width && height) draw(4.8, 0);
  });
  modeChanges.observe(document.body, { attributes: true, attributeFilter: ["data-mode"] });
  reduced.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  sync();

  return () => {
    cancelAnimationFrame(frame);
    modeChanges.disconnect();
    size.disconnect();
    reduced.removeEventListener("change", sync);
    document.removeEventListener("visibilitychange", sync);
  };
}
