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

export function mountTicketMap(details) {
  const status = details.querySelector("#map-status");
  const frame = details.querySelector("#map-frame");
  const link = details.querySelector("#osm-link");
  const coordinates = new Map();
  let place;
  let request;

  function clear() {
    request?.abort();
    request = undefined;
    details.open = false;
    frame.replaceChildren();
    status.textContent = "";
    place = undefined;
  }

  details.addEventListener("toggle", async () => {
    if (!details.open || !place || request || frame.childElementCount) return;
    const { address, name } = place;
    const controller = new AbortController();
    request = controller;
    status.textContent = "Recherche de l’adresse…";
    try {
      const point = coordinates.get(address) ?? await locate(address, controller.signal);
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
  });

  return {
    clear,
    setPlace(next) {
      clear();
      place = next;
      link.href = `${osm}/search?query=${encodeURIComponent(next.address)}`;
    },
  };
}
