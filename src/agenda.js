import { chooseIndex } from "./data.js";

const source = "https://agenda.villemorte.fr";
const zone = { timeZone: "Europe/Paris" };
const day = new Intl.DateTimeFormat("fr-FR", zone);
const hour = new Intl.DateTimeFormat("fr-FR", {
  ...zone,
  hour: "numeric",
  hourCycle: "h23",
});
const displayDate = new Intl.DateTimeFormat("fr-FR", {
  ...zone,
  dateStyle: "full",
  timeStyle: "short",
});

export function agendaPool(events, now = Date.now()) {
  const end = now + 7 * 24 * 60 * 60 * 1000;
  const upcoming = events.filter((event) => {
    const start = event?.start_datetime * 1000;
    return (
      start >= now &&
      start < end &&
      typeof event.title === "string" &&
      event.title.trim() &&
      typeof event.slug === "string" &&
      /^[\p{L}\d_-]+$/u.test(event.slug) &&
      typeof event.place?.name === "string" &&
      /\b69007\b/u.test(event.place?.address)
    );
  });
  const tonight = upcoming.filter(({ start_datetime }) => {
    const date = new Date(start_datetime * 1000);
    return day.format(date) === day.format(now) && Number(hour.format(date)) >= 17;
  });
  return { events: tonight.length ? tonight : upcoming, tonight: !!tonight.length };
}

export function mountAgenda(dialog) {
  const status = dialog.querySelector("#agenda-status");
  const card = dialog.querySelector("#agenda-card");
  const link = dialog.querySelector("#agenda-event-link");
  const again = dialog.querySelector("#agenda-again");
  let cached;
  let request;
  let pool = [];
  let seen = new Set();

  function draw() {
    let remaining = pool.filter(({ slug }) => !seen.has(slug));
    if (!remaining.length) {
      remaining = pool.filter(({ slug }) => slug !== link.dataset.slug);
      seen = new Set();
    }
    const event = remaining[chooseIndex(remaining.length)];
    seen.add(event.slug);
    dialog.querySelector("#agenda-event-name").textContent = event.title;
    dialog.querySelector("#agenda-event-date").textContent = displayDate.format(
      event.start_datetime * 1000,
    );
    dialog.querySelector("#agenda-event-place").textContent =
      `${event.place.name} · ${event.place.address.replace(/\s+/g, " ").trim()}`;
    link.href = `${source}/event/${encodeURIComponent(event.slug)}`;
    link.dataset.slug = event.slug;
    card.hidden = false;
    again.hidden = pool.length < 2;
  }

  async function open() {
    if (dialog.open) return;
    card.hidden = true;
    again.hidden = true;
    status.textContent = "Chargement de l’agenda…";
    dialog.showModal();
    const controller = new AbortController();
    request = controller;

    try {
      if (!cached || cached.expires <= Date.now()) {
        const response = await fetch(`${source}/api/events`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]),
        });
        if (!response.ok) throw new Error("Agenda indisponible");
        const events = await response.json();
        if (!Array.isArray(events)) throw new Error("Format d’agenda inattendu");
        cached = { events, expires: Date.now() + 5 * 60 * 1000 };
      }
      if (controller.signal.aborted) return;
      const selection = agendaPool(cached.events);
      pool = [...new Map(selection.events.map((event) => [event.slug, event])).values()];
      seen = new Set();
      if (!pool.length) {
        status.textContent = "Aucun événement à venir dans le 7e pour les sept prochains jours.";
        return;
      }
      status.textContent = selection.tonight ? "Ce soir" : "Dans les sept prochains jours";
      draw();
    } catch {
      if (!controller.signal.aborted)
        status.textContent = "Agenda indisponible. Tu peux consulter Ville Morte directement.";
    } finally {
      if (request === controller) request = undefined;
    }
  }

  dialog.addEventListener("close", () => request?.abort());
  dialog.querySelector("#close-agenda").onclick = () => dialog.close();
  again.onclick = draw;
  return open;
}
