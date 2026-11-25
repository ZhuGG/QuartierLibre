const NOTCH_DISTANCE = 26;

export function mountActivityDial(dial, onStep) {
  let drag;
  let moved = false;

  function endDrag() {
    drag = undefined;
    dial.classList.remove("turning");
    dial.style.removeProperty("--dial-drag");
  }

  dial.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || dial.disabled) return;
    moved = false;
    drag = { id: event.pointerId, x: event.clientX };
    dial.setPointerCapture(event.pointerId);
  });

  dial.addEventListener("pointermove", (event) => {
    if (drag?.id !== event.pointerId) return;
    const distance = event.clientX - drag.x;
    if (!moved && Math.abs(distance) < 10) return;
    moved = true;
    dial.classList.add("turning");
    const preview = Math.max(-108, Math.min(108, distance * 1.9));
    dial.style.setProperty("--dial-drag", `${preview}deg`);
  });

  dial.addEventListener("pointerup", (event) => {
    if (drag?.id !== event.pointerId) return;
    const distance = event.clientX - drag.x;
    if (moved && Math.abs(distance) >= NOTCH_DISTANCE / 2) {
      const notches = Math.min(3, Math.round(Math.abs(distance) / NOTCH_DISTANCE));
      onStep(Math.sign(distance) * notches);
    }
    endDrag();
  });

  for (const name of ["pointercancel", "lostpointercapture"]) {
    dial.addEventListener(name, (event) => {
      if (drag?.id === event.pointerId) endDrag();
    });
  }

  dial.addEventListener("click", (event) => {
    if (moved && event.detail > 0) {
      moved = false;
      return;
    }
    onStep(1);
  });
}
