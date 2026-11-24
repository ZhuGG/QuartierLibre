import { findDetour } from "./detour.js";

const osm = "https://www.openstreetmap.org";

async function locate(address, signal) {
  const params = new URLSearchParams({
    q: address,
    index: "address",
    postcode: "69007",
    limit: "1",
  });
  const response = await fetch(
    `https://data.geopf.fr/geocodage/search?${params}`,
    { signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]) },
  );
  if (!response.ok) throw new Error("Géocodage indisponible");
  const { features } = await response.json();
  const match = features?.[0];
  const [lon, lat] = match?.geometry?.coordinates ?? [];
  if (
    match?.properties?.postcode !== "69007" ||
    !(match.properties.score >= 0.75) ||
    !Number.isFinite(lon) ||
    !Number.isFinite(lat)
  ) throw new Error("Adresse introuvable");
  return { lon, lat };
}

export function mountTicketMap(container) {
  const status = container.querySelector("#map-status");
  const frame = container.querySelector("#map-frame");
  const link = container.querySelector("#osm-link");
  const detourButton = container.querySelector("#detour-button");
  const detourStatus = container.querySelector("#detour-status");
  const detourLink = container.querySelector("#detour-link");
  const coordinates = new Map();
  let destination;
  let detourRequest;
  let request;

  function clear() {
    request?.abort();
    request = undefined;
    frame.replaceChildren();
    status.textContent = "";
    detourRequest?.abort();
    detourRequest = undefined;
    destination = undefined;
    detourButton.disabled = false;
    detourStatus.textContent = "";
    detourLink.hidden = true;
  }

  async function setPlace({ address, name }) {
    clear();
    link.href = `${osm}/search?query=${encodeURIComponent(address)}`;
    const controller = new AbortController();
    request = controller;
    status.textContent = "Recherche de l’adresse…";
    const pointRequest = coordinates.has(address)
      ? Promise.resolve(coordinates.get(address))
      : locate(address, controller.signal);
    destination = { pointRequest, name };
    try {
      const point = await pointRequest;
      if (controller.signal.aborted) return;
      coordinates.set(address, point);
      const { lon, lat } = point;
      const params = new URLSearchParams({
        bbox: [lon - 0.003, lat - 0.002, lon + 0.003, lat + 0.002].join(","),
        layer: "mapnik",
        marker: `${lat},${lon}`,
      });
      const iframe = document.createElement("iframe");
      iframe.title = `Carte OpenStreetMap · ${name}`;
      iframe.src = `${osm}/export/embed.html?${params}`;
      frame.replaceChildren(iframe);
      link.href = `${osm}/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
      status.textContent = "";
    } catch {
      if (!controller.signal.aborted)
        status.textContent = "Carte indisponible. Essaie le lien OpenStreetMap.";
    } finally {
      if (request === controller) request = undefined;
    }
  }

  detourButton.addEventListener("click", async () => {
    if (!destination || detourRequest) return;
    const controller = new AbortController();
    detourRequest = controller;
    detourButton.disabled = true;
    detourLink.hidden = true;
    detourStatus.textContent = "Recherche autour du lieu…";
    const { pointRequest, name } = destination;
    try {
      const point = await pointRequest;
      if (controller.signal.aborted) return;
      const nearby = await findDetour(
        point,
        name,
        AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
      );
      if (controller.signal.aborted) return;
      if (!nearby) {
        detourStatus.textContent = "Aucun détour trouvé dans les environs.";
        return;
      }
      detourStatus.textContent = `À ${Math.round(nearby.dist / 10) * 10} m à vol d’oiseau`;
      detourLink.href = `https://fr.wikipedia.org/?curid=${nearby.pageid}`;
      detourLink.textContent = `${nearby.title} · Wikipédia`;
      detourLink.hidden = false;
    } catch {
      if (!controller.signal.aborted)
        detourStatus.textContent = "Les détours sont indisponibles pour le moment.";
    } finally {
      if (detourRequest === controller) {
        detourRequest = undefined;
        detourButton.disabled = false;
      }
    }
  });

  return { clear, setPlace };
}
