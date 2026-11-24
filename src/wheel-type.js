// Names follow the sector arcs. A single high-resolution texture keeps the
// lettering attached to the wheel without six overlapping floating plaques.
export function createWheelLettering(places, mode) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1536;
  const ctx = canvas.getContext("2d");
  const center = 768,
    scale = 1536 / 5.4;
  const font = (size) => `800 ${size}px "Trebuchet MS", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const ink = mode === "sun" ? "#fff0d2" : "#e5f6ff";

  function writeArc(text, angle, radius, maxArc, preferredSize) {
    const r = radius * scale;
    let size = preferredSize;
    ctx.font = font(size);
    const measure = () =>
      [...text].map((char) => ctx.measureText(char).width + size * 0.025);
    let widths = measure();
    const available = r * maxArc;
    const sum = () => widths.reduce((a, b) => a + b, 0);
    if (sum() > available) {
      size *= available / sum();
      ctx.font = font(size);
      widths = measure();
    }
    let cursor = -sum() / 2;
    [...text].forEach((char, index) => {
      const a = angle - (cursor + widths[index] / 2) / r;
      ctx.save();
      ctx.translate(center + Math.cos(a) * r, center - Math.sin(a) * r);
      ctx.rotate(Math.PI / 2 - a);
      ctx.strokeStyle = "#101820";
      ctx.lineWidth = size * 0.065;
      ctx.strokeText(char, 0, 0);
      ctx.fillStyle = ink;
      ctx.fillText(char, 0, 0);
      ctx.restore();
      cursor += widths[index];
    });
  }

  places.forEach((place, index) => {
    const angle = ((index + 0.5) * Math.PI * 2) / places.length;
    const maxArc = Math.min((Math.PI * 2) / places.length - 0.15, 1.5);
    const name = place.shortName || place.name;
    ctx.font = font(100);
    const fits = ctx.measureText(name).width <= 1.9 * scale * maxArc;
    const words = name.split(" ");
    if (fits || words.length === 1) {
      writeArc(name, angle, 1.85, maxArc, 100);
    } else {
      let split = 1,
        best = Infinity;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(" "),
          b = words.slice(i).join(" ");
        const score = Math.max(
          ctx.measureText(a).width / 2.02,
          ctx.measureText(b).width / 1.52,
        );
        if (score < best) {
          split = i;
          best = score;
        }
      }
      writeArc(words.slice(0, split).join(" "), angle, 2.02, maxArc, 100);
      writeArc(words.slice(split).join(" "), angle, 1.52, maxArc, 96);
    }
    const x = center + Math.cos(angle) * 0.87 * scale;
    const y = center - Math.sin(angle) * 0.87 * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 2 - angle);
    ctx.fillStyle = "#142b36";
    ctx.beginPath();
    ctx.rect(-0.135 * scale, -0.105 * scale, 0.27 * scale, 0.21 * scale);
    ctx.fill();
    ctx.fillStyle = mode === "sun" ? "#ffe2a0" : "#dcf4f5";
    ctx.font = "700 43px ui-monospace, monospace";
    ctx.fillText(String(index + 1), 0, 1);
    ctx.restore();
  });
  return canvas;
}
