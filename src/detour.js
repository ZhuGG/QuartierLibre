import { chooseIndex, normalize } from "./data.js";

export async function findDetour({ lat, lon }, placeName, signal) {
  const params = new URLSearchParams({
    action: "query",
    list: "geosearch",
    gscoord: `${lat}|${lon}`,
    gsradius: "650",
    gslimit: "20",
    origin: "*",
    format: "json",
  });
  const response = await fetch(`https://fr.wikipedia.org/w/api.php?${params}`, { signal });
  if (!response.ok) throw new Error("Wikipédia indisponible");
  const data = await response.json();
  if (!Array.isArray(data.query?.geosearch)) throw new Error("Recherche indisponible");
  const name = normalize(placeName);
  const nearby = data.query.geosearch
    .filter((page) =>
      Number.isSafeInteger(page.pageid) &&
      page.pageid > 0 &&
      typeof page.title === "string" &&
      Number.isFinite(page.dist) &&
      page.dist >= 80 &&
      !name.includes(normalize(page.title)) &&
      !normalize(page.title).includes(name),
    )
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5);
  return nearby.length ? nearby[chooseIndex(nearby.length)] : null;
}
