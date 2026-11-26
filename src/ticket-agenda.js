import { displayDate, eventUrl, eventsForPlace, loadAgenda } from "./agenda.js";

function eventRow(event) {
  const row = document.createElement("div");
  row.className = "ticket-event";
  const title = document.createElement("strong");
  title.textContent = event.title;
  const time = document.createElement("time");
  const start = new Date(event.start_datetime * 1000);
  time.dateTime = start.toISOString();
  time.textContent = displayDate.format(start);
  const link = document.createElement("a");
  link.textContent = "Voir sur Ville Morte";
  link.href = eventUrl(event);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  row.append(title, time, link);
  return row;
}

export function mountTicketAgenda(section) {
  let revision = 0;

  function clear() {
    revision++;
    section.hidden = true;
    section.replaceChildren();
  }

  async function setPlace(place) {
    clear();
    const current = revision;
    try {
      const events = await loadAgenda();
      if (current !== revision) return;
      const [next, ...rest] = eventsForPlace(events, place);
      if (!next) return;
      section.append(eventRow(next));
      if (rest.length) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = "Autres dates";
        details.append(summary, ...rest.map(eventRow));
        section.append(details);
      }
      section.hidden = false;
    } catch {
      // The venue ticket is usable even when the agenda is offline.
    }
  }

  return { setPlace, clear };
}
