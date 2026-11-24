const palettes = {
  choose: ["#d9a982", "#86c3d3"],
  sun: ["#efb77f", "#97bcc1"],
  moon: ["#a2b9d1", "#80d0e9"],
};

function smokeBrush(color) {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const ctx = sprite.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.43, `${color}a0`);
  gradient.addColorStop(0.72, `${color}35`);
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return sprite;
}

export function mountBaySmoke(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const brushes = Object.fromEntries(
    Object.entries(palettes).map(([mode, colors]) => [mode, colors.map(smokeBrush)]),
  );
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  // Low resolution and blending give the edges of the smoke a soft silhouette.
  const resolution = 0.46;
  const lanes = [
    { side: 0, x: 0.12, y: 0.91, offset: 0.08, period: 9.8 },
    { side: 1, x: 0.87, y: 0.88, offset: 0.51, period: 11.5 },
    { side: 0, x: 0.23, y: 0.78, offset: 0.67, period: 13.5 },
    { side: 1, x: 0.77, y: 0.74, offset: 0.28, period: 12.1 },
  ];
  let frame = 0;
  let lastPaint = 0;
  let narrow;
  let viewportHeight;

  function resize() {
    viewportHeight = canvas.clientHeight;
    narrow = canvas.clientWidth <= 600;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * resolution));
    canvas.height = Math.max(1, Math.round(viewportHeight * resolution));
    ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
  }

  function paint(time) {
    frame = requestAnimationFrame(paint);
    if (time - lastPaint < 1000 / 30) return;
    lastPaint = time;
    const width = canvas.width / resolution;
    const height = canvas.height / resolution;
    const t = time / 1000;
    const smoke = brushes[document.body.dataset.mode] ?? brushes.choose;
    ctx.clearRect(0, 0, width, height);

    for (const [index, lane] of lanes.entries()) {
      if (narrow && index >= 2) break;
      const direction = lane.side === 0 ? 1 : -1;
      const anchor = narrow ? (lane.side === 0 ? 0.025 : 0.975) : lane.x;
      const reach = narrow ? 54 : Math.min(168, width * 0.16);
      for (let bead = 0; bead < 30; bead++) {
        const age = (t / lane.period + lane.offset + bead / 30) % 1;
        const envelope = Math.sin(Math.PI * age) ** 1.7;
        const puff = 0.62 + 0.38 * Math.cos((age - t / lane.period) * Math.PI * 6 + index);
        const curl = Math.sin(age * Math.PI * 4.2 + t * 0.51 + index);
        const smallerCurl = Math.sin(age * Math.PI * 9.5 - t * 0.63 + index);
        const x = width * anchor + direction *
          (age * reach * 0.25 + curl * reach * (0.13 + age * 0.42) + smallerCurl * reach * 0.07);
        const y = height * (lane.y - age * (index < 2 ? 0.54 : 0.32));
        const radius = (narrow ? 12 : 19) + age * (narrow ? 31 : 60);
        ctx.globalAlpha = envelope * puff * (index < 2 ? 0.16 : 0.085);
        ctx.drawImage(smoke[lane.side], x - radius, y - radius * 0.6, radius * 2, radius * 1.44);
      }
    }
    ctx.globalAlpha = 1;
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!reduced.matches && !document.hidden) {
      resize();
      if (viewportHeight) frame = requestAnimationFrame(paint);
    }
  }

  const size = new ResizeObserver(() => {
    if (!document.hidden && !reduced.matches) resize();
  });
  size.observe(canvas);
  reduced.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  sync();

  return () => {
    cancelAnimationFrame(frame);
    size.disconnect();
    reduced.removeEventListener("change", sync);
    document.removeEventListener("visibilitychange", sync);
  };
}
