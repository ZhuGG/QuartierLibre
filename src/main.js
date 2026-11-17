import "./style.css";
import "./cabinet.css";
import "./arcade.css";
import {
  places,
  filterPlaces,
  chooseIndex,
  makeWheelPool,
  renewWheelPool,
} from "./data.js";
import { ArcadeWheel } from "./wheel.js";
import { Sound } from "./sound.js";

const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const storage = {
  get(k, f) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? f;
    } catch {
      return f;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};
let mode = null,
  category = "Tout",
  district = "Tout le 7e",
  query = "",
  favoritesOnly = false,
  spinning = false,
  charging = false,
  chargeStart = 0,
  chargeFrame,
  activePool = [],
  lastResult = null,
  previousFocus = null,
  poolDirty = false;
let favorites = storage
    .get("sl-favorites", [])
    .filter((x) => typeof x === "string"),
  recent = storage
    .get("sl-recent", [])
    .filter((x) => typeof x === "string")
    .slice(-3),
  count = Number(storage.get("sl-count", 0)) || 0;
const sound = new Sound();
sound.enabled = storage.get("sl-sound", false) === true;

$("#app").innerHTML = `
 <div class="room" aria-hidden="true"></div><div class="room-shade" aria-hidden="true"></div>
 <header class="site-header"><a href="#" id="home" aria-label="Revenir au choix de la borne"><span class="brand-symbol">7<span>e</span></span><span>QUARTIER<br><b>LIBRE</b></span></a><span class="header-caption">SORTIES À LYON 7e · JOUR / NUIT</span><div class="header-actions"><span class="local-label"><i></i> LYON 7e</span><button id="sound" class="plain-button" aria-pressed="${sound.enabled}" aria-label="${sound.enabled ? "Couper" : "Activer"} le son">SON ${sound.enabled ? "ON" : "OFF"}</button><button id="help" class="plain-button" aria-label="Comment jouer">?</button></div></header>
 <main>
  <section id="choose" class="choose" aria-labelledby="welcome-title"><p class="eyebrow">LYON 7e / SOLEIL & LUNE</p><h1 id="welcome-title">En journée ou en soirée ?</h1><p class="intro">Choisis une borne, puis tire le levier pour obtenir une adresse.</p>
   <div class="choices"><button class="choice sun-choice" data-mode="sun"><span class="choice-top">SERVICE DE JOUR <span>01 / S</span></span><span class="choice-art" aria-hidden="true"></span><span class="pixel-sun" aria-hidden="true"></span><strong>SOLEIL</strong><span class="choice-copy">Cafés, restaurants, parcs et culture.</span><span class="choice-bottom">CHOISIR SOLEIL <b>↗</b></span></button><span class="choice-divider" aria-hidden="true">OU</span><button class="choice moon-choice" data-mode="moon"><span class="choice-top">SERVICE DE NUIT <span>02 / L</span></span><span class="choice-art" aria-hidden="true"></span><span class="pixel-moon" aria-hidden="true"></span><strong>LUNE</strong><span class="choice-copy">Bars, concerts, restaurants et club.</span><span class="choice-bottom">CHOISIR LUNE <b>↗</b></span></button></div>
   <p class="welcome-bottom"><span>GUILLOTIÈRE / JEAN MACÉ / GERLAND</span><span>${places.length} ADRESSES · SANS INSCRIPTION</span></p>
  </section>
  <section id="play" class="play" hidden aria-label="La borne de sorties"><div class="play-top"><button id="back" class="text-button">← CHANGER DE BORNE</button><span class="play-top-note">GUILLOTIÈRE · JEAN MACÉ · GERLAND</span></div>
   <div class="game-layout"><aside class="left-panel"><p class="eyebrow">COMMENT JOUER</p><h2>Tire le levier.</h2><ol><li>Choisis ton envie.</li><li>Tire le levier vers le bas.</li><li>Relâche pour lancer.</li></ol><p class="side-note">Six lieux au maximum par tour.<br>Les derniers tirages sont écartés.</p><div class="session-stamp"><span>TIRAGES</span><strong id="session-count">${String(count).padStart(2, "0")}</strong></div></aside>
   <article id="cabinet" class="cabinet" aria-labelledby="machine-title"><div class="cabinet-roof"><span class="roof-serial">QL–07 / <span id="serial-mode">S</span></span><span class="roof-lights" aria-hidden="true">▪ ▪ ▪ ▪ ▪</span></div><div class="marquee"><i class="screw" aria-hidden="true"></i><div><span id="machine-kicker">JOURNÉE / LYON 7e</span><h2 id="machine-title">SOLEIL</h2></div><span id="machine-icon" class="marquee-icon" aria-hidden="true">☀</span><i class="screw" aria-hidden="true"></i></div>
    <div class="screen-bezel"><div class="screen"><div class="screen-top"><span><i class="status-led"></i><span id="screen-status">PRÊT À SORTIR</span></span><span id="pool-count"></span></div><div id="wheel" class="wheel" aria-label="Roue 3D des lieux de sortie"></div><div class="screen-bottom"><span id="screen-hint">TIRE LE LEVIER POUR LANCER.</span><span class="blink" aria-hidden="true">▮</span></div><div class="scanlines" aria-hidden="true"></div><div id="confetti" class="confetti" aria-hidden="true"></div></div></div>
    <ol id="wheel-legend" class="wheel-legend" aria-label="Les lieux de la roue"></ol><div class="control-deck"><div class="activity-control"><button id="joystick" class="activity-dial" aria-label="Changer d’activité"><span class="dial-face" aria-hidden="true"></span></button><span id="activity-label" aria-live="polite">Tout</span></div><div class="launch-area"><div class="power-track" role="meter" aria-label="Puissance du lancer" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="power"></span></div><button id="launch" class="slot-lever" aria-label="Tirer le levier pour lancer la roue"><span class="lever-mount" aria-hidden="true"></span><span class="lever-arm" aria-hidden="true"><span class="lever-ball"></span></span></button><span id="lever-caption" class="lever-caption">TIRE LE LEVIER →</span><span class="button-caption">OU MAINTIENS ESPACE</span></div><button id="reroll" class="reroll-button" aria-label="Changer les lieux de la roue"><span aria-hidden="true">↻</span><b>AUTRES<br>LIEUX</b></button><button id="reset-filter" class="small-arcade" aria-label="Réinitialiser les filtres"><span></span>RESET</button></div>
    <div class="neighborhood-strip" aria-hidden="true"></div><div class="cabinet-front"><div class="speaker" aria-hidden="true"></div><div class="ticket-slot" aria-hidden="true"><span></span></div><div class="cabinet-sticker">GUILLO<br>69007</div><div class="front-bottom"><span>QUARTIER LIBRE · LYON 7e</span><span>FREE PLAY</span></div></div><div class="cabinet-foot" aria-hidden="true"></div>
   </article>
   <aside class="right-panel"><p class="eyebrow">CHOISIR LES LIEUX</p><label class="field-label" for="district">TON QUARTIER</label><select id="district"><option>Tout le 7e</option><option>Guillotière</option><option>Jean Macé</option><option>Gerland</option><option>Blandan</option></select><span class="field-label">TON ENVIE</span><div id="categories" class="category-list"></div><button id="favorites-only" class="favorite-filter" aria-pressed="false">☆ Mes favoris</button><div class="next-ticket"><span>DERNIER TICKET</span><p id="last-ticket">Aucun tirage pour le moment.</p><button id="show-last" class="text-button" hidden>REVOIR LE LIEU ↗</button></div></aside></div>
   <p class="keyboard-note">CLAVIER : <kbd>ESPACE</kbd> ABAISSER / RELÂCHER <span>·</span> <kbd>←</kbd> <kbd>→</kbd> CHANGER D’ENVIE</p>
   <section class="directory" aria-labelledby="directory-title"><div class="directory-heading"><div><p class="eyebrow">LE CARNET DU 7e</p><h2 id="directory-title">Les lieux de la sélection.</h2></div><label class="search"><span class="sr-only">Chercher un lieu</span><input id="search" type="search" placeholder="Un nom, une rue…" maxlength="100"><span aria-hidden="true">⌕</span></label></div><p id="directory-count" aria-live="polite"></p><div id="place-list" class="place-list"></div><p class="source-note">Sélection initiale, non exhaustive · sources consultées le 17 novembre 2026. Jour / nuit indique une ambiance, pas une ouverture en temps réel. Horaires, entrée et programmation à vérifier auprès des lieux.</p></section>
  </section>
 </main><footer><span>QUARTIER LIBRE — SOLEIL / LUNE</span><span>UNE SÉLECTION DU 7e ARRONDISSEMENT</span><button id="sources" class="text-button">À PROPOS & SOURCES ↗</button></footer>
 <dialog id="result" class="result"><button id="close-result" class="dialog-close" aria-label="Fermer le ticket">×</button><div class="ticket-body"><p class="eyebrow" id="result-label">RÉSULTAT DU TIRAGE</p><span id="result-category"></span><h2 id="result-title"></h2><p id="result-description"></p><address id="result-address"></address><div class="ticket-perf"></div><div class="ticket-links"><a id="maps" target="_blank" rel="noopener noreferrer">Y ALLER ↗</a><a id="official" target="_blank" rel="noopener noreferrer">INFOS DU LIEU ↗</a></div><p id="result-note" class="result-note"></p><button id="favorite-result" class="text-button"></button><button id="again" class="ticket-again">UN AUTRE TOUR ↻</button><div class="barcode" aria-hidden="true"></div><p class="ticket-code">LYON 7e / QUARTIER LIBRE / SÉLECTION LOCALE</p></div></dialog>
 <dialog id="info" class="info-dialog"><button id="close-info" class="dialog-close" aria-label="Fermer">×</button><h2 id="info-title"></h2><div id="info-content"></div></dialog><div id="announce" class="sr-only" aria-live="polite"></div>`;

$(".welcome-bottom span").textContent = "GUILLOTIÈRE / JEAN MACÉ / GERLAND";
const wheel = new ArcadeWheel($("#wheel"), {
  onTick: (p, i) => {
    sound.tick(p);
    if (activePool[i]) {
      $("#screen-hint").textContent = activePool[i].name;
      highlightPlace(i);
    }
  },
  onDone: (i) => reveal(activePool[i]),
});
function filtered() {
  return filterPlaces(places, {
    mode,
    category,
    district,
    query,
    favorites: favoritesOnly ? favorites : null,
  });
}
function refreshPool({ renew = false } = {}) {
  activePool = renew
    ? renewWheelPool(filtered(), recent, activePool)
    : makeWheelPool(filtered(), recent);
  poolDirty = false;
  wheel.setPlaces(activePool, mode);
  $("#wheel-legend").innerHTML = activePool
    .map(
      (p, i) =>
        `<li data-index="${i}"><span>${String(i + 1).padStart(2, "0")}</span>${escape(p.name)}</li>`,
    )
    .join("");
  $("#reroll").disabled =
    filtered().filter((p) => p.available !== false).length < 2;
  $("#pool-count").textContent =
    `${activePool.length} ${activePool.length === 1 ? "LIEU" : "LIEUX"}`;
  $("#screen-status").textContent = "PRÊT À SORTIR";
  $("#launch").disabled = !activePool.length;
  $("#screen-hint").textContent = activePool.length
    ? "TIRE LE LEVIER POUR LANCER."
    : "AUCUN LIEU. CHANGE LES FILTRES.";
}
function highlightPlace(index) {
  $$("#wheel-legend li").forEach((el, i) =>
    el.classList.toggle("current", i === index),
  );
}
let cabinetAnimationTimer;
function animateCabinet(kind) {
  clearTimeout(cabinetAnimationTimer);
  const cabinet = $("#cabinet");
  cabinet.classList.remove("renewing", "changing-activity");
  void cabinet.offsetWidth;
  cabinet.classList.add(kind);
  cabinetAnimationTimer = setTimeout(() => cabinet.classList.remove(kind), 550);
}
function renderCategories() {
  const categories = [
    "Tout",
    ...new Set(
      places.filter((p) => p.modes.includes(mode)).map((p) => p.category),
    ),
  ];
  $("#activity-label").textContent = category;
  $("#joystick").setAttribute("aria-label", `Changer d’activité : ${category}`);
  $("#joystick").style.setProperty(
    "--dial-angle",
    `${categories.indexOf(category) * 72}deg`,
  );
  $("#categories").innerHTML = categories
    .map(
      (c, i) =>
        `<button data-category="${escape(c)}" aria-pressed="${category === c}"><span>${String(i + 1).padStart(2, "0")}</span>${escape(c)}<b>${category === c ? "●" : "○"}</b></button>`,
    )
    .join("");
}
function refresh() {
  renderCategories();
  refreshPool();
  renderDirectory();
}
function renderDirectory() {
  const list = filtered();
  $("#directory-count").textContent =
    `${list.length} adresse${list.length !== 1 ? "s" : ""} · ${mode === "sun" ? "En journée" : "En soirée"}${favoritesOnly ? " · Favoris" : ""}`;
  $("#place-list").innerHTML = list.length
    ? list
        .map(
          (p) =>
            `<article class="place"><div class="place-meta">${escape(p.district)} <span>${escape(p.category)}</span></div><button class="place-title" data-open="${p.id}">${escape(p.name)} <span>↗</span></button><p>${escape(p.address)}</p>${p.available === false ? '<small class="unavailable">Statut à revérifier · hors tirages</small>' : ""}<button class="place-favorite" data-favorite="${p.id}" aria-label="${favorites.includes(p.id) ? "Retirer" : "Ajouter"} ${escape(p.name)} ${favorites.includes(p.id) ? "des" : "aux"} favoris" aria-pressed="${favorites.includes(p.id)}">${favorites.includes(p.id) ? "★" : "☆"}</button></article>`,
        )
        .join("")
    : '<div class="empty"><h3>Aucune adresse pour cette combinaison.</h3><p>Change ton envie ou réinitialise les filtres avec RESET.</p></div>';
}
function chooseMode(value) {
  if (spinning) return;
  cancelCharge();
  mode = value;
  category = "Tout";
  district = "Tout le 7e";
  query = "";
  favoritesOnly = false;
  $("#search").value = "";
  $("#district").value = district;
  $("#favorites-only").setAttribute("aria-pressed", "false");
  document.body.dataset.mode = mode;
  $("#choose").hidden = true;
  $("#play").hidden = false;
  $("#machine-title").textContent = mode === "sun" ? "SOLEIL" : "LUNE";
  $("#machine-kicker").textContent =
    mode === "sun" ? "JOURNÉE / LYON 7e" : "SOIRÉE / LYON 7e";
  $("#machine-icon").textContent = mode === "sun" ? "☀" : "☾";
  $("#serial-mode").textContent = mode === "sun" ? "S" : "L";
  $("#screen-status").textContent = "PRÊT À SORTIR";
  sound.select();
  refresh();
  requestAnimationFrame(() => {
    wheel.resize?.();
    $("#launch").focus({ preventScroll: true });
  });
  scrollTo({ top: 0, behavior: "instant" });
}
function home(e) {
  e?.preventDefault();
  if (spinning) return;
  cancelCharge();
  $("#play").hidden = true;
  $("#choose").hidden = false;
  document.body.dataset.mode = "choose";
  mode = null;
  $(".choice").focus({ preventScroll: true });
}
function lock(value) {
  spinning = value;
  $("#cabinet").classList.toggle("spinning", value);
  $$("#play button, #play select, #play input, #home").forEach((el) => {
    if (el.tagName === "A") {
      el.setAttribute("aria-disabled", String(value));
      return;
    }
    el.disabled = value;
  });
  if (!value)
    $("#reroll").disabled =
      filtered().filter((p) => p.available !== false).length < 2;
}
function beginCharge() {
  if (spinning || !mode || !activePool.length || charging) return;
  if (poolDirty) refreshPool();
  charging = true;
  chargeStart = performance.now();
  sound.unlock();
  $("#launch").classList.add("pressed");
  $("#screen-status").textContent = "TIRE PUIS RELÂCHE";
  const frame = () => {
    if (!charging) return;
    const pointer = $("#launch").hasAttribute("data-pointer");
    const p = pointer
      ? leverPull
      : Math.min(1, (performance.now() - chargeStart) / 1400);
    $("#power").style.width = `${p * 100}%`;
    $("#launch").style.setProperty("--pull", p);
    $(".power-track").setAttribute("aria-valuenow", Math.round(p * 100));
    chargeFrame = requestAnimationFrame(frame);
  };
  frame();
}
function cancelCharge() {
  charging = false;
  cancelAnimationFrame(chargeFrame);
  $("#launch").classList.remove("pressed");
  $("#launch").removeAttribute("data-pointer");
  $("#launch").style.setProperty("--pull", 0);
  $("#power").style.width = "0%";
  $(".power-track").setAttribute("aria-valuenow", "0");
  if (!spinning) $("#screen-status").textContent = "PRÊT À SORTIR";
}
function releaseCharge() {
  if (!charging) return;
  const power = Math.min(1, (performance.now() - chargeStart) / 1400);
  cancelCharge();
  launch(power);
}
function launch(power = 0.4) {
  if (spinning || !mode) return;
  if (poolDirty) refreshPool();
  if (!activePool.length) return;
  sound.unlock();
  lock(true);
  $("#lever-caption").textContent = "TIRAGE EN COURS";
  $("#screen-status").textContent = "TIRAGE EN COURS";
  $("#screen-hint").textContent = "LA ROUE RALENTIT.";
  $("#announce").textContent = "La roue tourne.";
  wheel.spin(chooseIndex(activePool.length), power);
}
function reveal(p) {
  poolDirty = true;
  lock(false);
  $("#lever-caption").textContent = "TIRE LE LEVIER →";
  $("#screen-status").textContent = "ADRESSE TROUVÉE";
  $("#screen-hint").textContent = p.name;
  highlightPlace(activePool.findIndex((place) => place.id === p.id));
  lastResult = p;
  recent = [...recent.filter((id) => id !== p.id), p.id].slice(-3);
  storage.set("sl-recent", recent);
  count++;
  storage.set("sl-count", count);
  $("#session-count").textContent = String(count).padStart(2, "0");
  $("#last-ticket").textContent = p.name;
  $("#show-last").hidden = false;
  sound.win();
  $("#announce").textContent = `Prochaine sortie : ${p.name}. ${p.address}`;
  burst();
  setTimeout(() => openPlace(p, true), 450);
}
function burst() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  $("#confetti").replaceChildren();
  for (let i = 0; i < 24; i++) {
    const p = document.createElement("i");
    p.style.cssText = `--x:${Math.random() * 100}%;--delay:${Math.random() * 0.2}s;--c:${["#e8b462", "#96aaa1", "#c1bbd6"][i % 3]};--r:${Math.random() * 300}deg`;
    $("#confetti").append(p);
  }
  setTimeout(() => $("#confetti").replaceChildren(), 1800);
}
function openPlace(p, won = false) {
  previousFocus = document.activeElement;
  lastResult = p;
  $("#result-label").textContent = won
    ? "RÉSULTAT DU TIRAGE"
    : "LE CARNET DU 7e";
  $("#result-category").textContent = `${p.district} / ${p.category}`;
  $("#result-title").textContent = p.name;
  $("#result-description").textContent = p.description;
  $("#result-address").textContent = p.address;
  $("#maps").href =
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.address)}`;
  $("#official").href = p.source;
  $("#result-note").textContent =
    p.available === false
      ? "Statut à revérifier. Ce lieu est exclu des tirages."
      : "Vérifie les horaires et la programmation avant de partir.";
  $("#favorite-result").textContent = favorites.includes(p.id)
    ? "★ RETIRER DES FAVORIS"
    : "☆ GARDER L’ADRESSE";
  $("#result").showModal();
}
function toggleFavorite(id) {
  favorites = favorites.includes(id)
    ? favorites.filter((x) => x !== id)
    : [...favorites, id];
  storage.set("sl-favorites", favorites);
  renderDirectory();
  if (lastResult)
    $("#favorite-result").textContent = favorites.includes(lastResult.id)
      ? "★ RETIRER DES FAVORIS"
      : "☆ GARDER L’ADRESSE";
  if (!spinning) refreshPool();
}
function closeResult() {
  $("#result").close();
  previousFocus?.focus({ preventScroll: true });
}
function reset() {
  if (spinning) return;
  category = "Tout";
  district = "Tout le 7e";
  query = "";
  favoritesOnly = false;
  $("#search").value = "";
  $("#district").value = district;
  $("#favorites-only").setAttribute("aria-pressed", "false");
  refresh();
  sound.select();
}
function nextCategory(delta = 1) {
  if (spinning || charging || !mode) return;
  const buttons = $$("#categories button");
  const index = buttons.findIndex((b) => b.dataset.category === category);
  category =
    buttons[(index + delta + buttons.length) % buttons.length].dataset.category;
  refresh();
  sound.select();
  animateCabinet("changing-activity");
}
$$("[data-mode]").forEach((b) =>
  b.addEventListener("click", () => chooseMode(b.dataset.mode)),
);
$("#back").onclick = home;
$("#home").onclick = home;
let leverStartY = 0,
  leverPull = 0;
$("#launch").addEventListener("pointerdown", (e) => {
  if (
    (e.button !== 0 && e.pointerType !== "touch") ||
    spinning ||
    !activePool.length
  )
    return;
  leverStartY = e.clientY;
  leverPull = 0;
  $("#launch").setAttribute("data-pointer", "");
  $("#launch").setPointerCapture(e.pointerId);
  beginCharge();
});
$("#launch").addEventListener("pointermove", (e) => {
  if (!charging || !$("#launch").hasPointerCapture(e.pointerId)) return;
  leverPull = Math.max(0, Math.min(1, (e.clientY - leverStartY) / 100));
  $("#launch").style.setProperty("--pull", leverPull);
  $("#power").style.width = leverPull * 100 + "%";
  $(".power-track").setAttribute("aria-valuenow", Math.round(leverPull * 100));
});
$("#launch").addEventListener("pointerup", () => {
  if (!charging) return;
  const elapsed = (performance.now() - chargeStart) / 1400;
  const power = Math.min(1, Math.max(leverPull, elapsed * 0.5));
  cancelCharge();
  launch(power);
});
$("#launch").addEventListener("pointercancel", cancelCharge);
$("#launch").addEventListener("lostpointercapture", () => {
  if (charging) cancelCharge();
});
$("#launch").addEventListener("click", (e) => {
  if (e.detail === 0 && !spinning && !charging) launch();
});
document.addEventListener("keydown", (e) => {
  if (
    !mode ||
    $("#play").hidden ||
    $("dialog[open]") ||
    /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    if (!e.repeat) beginCharge();
  }
  if (e.code === "ArrowRight" || e.code === "ArrowLeft") {
    e.preventDefault();
    nextCategory(e.code === "ArrowRight" ? 1 : -1);
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space" && charging) {
    e.preventDefault();
    releaseCharge();
  }
});
window.addEventListener("blur", cancelCharge);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancelCharge();
});
$("#categories").onclick = (e) => {
  const b = e.target.closest("[data-category]");
  if (!b || spinning) return;
  category = b.dataset.category;
  refresh();
  animateCabinet("changing-activity");
  sound.select();
};
$("#joystick").onclick = () => nextCategory();
$("#reset-filter").onclick = reset;
$("#reroll").onclick = () => {
  if (spinning || charging) return;
  const previous = activePool.map((p) => p.id);
  refreshPool({ renew: true });
  animateCabinet("renewing");
  sound.select();
  const added = activePool.filter((p) => !previous.includes(p.id)).length;
  $("#screen-status").textContent = added
    ? `${added} NOUVEAUX LIEUX`
    : "ORDRE RENOUVELÉ";
  $("#announce").textContent = added
    ? `${added} nouveaux lieux sur la roue.`
    : "Les lieux disponibles ont été réorganisés. Élargis les filtres pour en afficher d’autres.";
};
$("#district").onchange = (e) => {
  district = e.target.value;
  refresh();
};
$("#search").oninput = (e) => {
  query = e.target.value;
  refreshPool();
  renderDirectory();
};
$("#favorites-only").onclick = () => {
  favoritesOnly = !favoritesOnly;
  $("#favorites-only").setAttribute("aria-pressed", String(favoritesOnly));
  refresh();
};
$("#place-list").onclick = (e) => {
  const f = e.target.closest("[data-favorite]"),
    b = e.target.closest("[data-open]");
  if (f) toggleFavorite(f.dataset.favorite);
  if (b) openPlace(places.find((p) => p.id === b.dataset.open));
};
$("#favorite-result").onclick = () => toggleFavorite(lastResult.id);
$("#close-result").onclick = closeResult;
$("#result").addEventListener("close", () =>
  previousFocus?.focus({ preventScroll: true }),
);
$("#again").onclick = () => {
  closeResult();
  refreshPool();
  launch();
};
$("#show-last").onclick = () => openPlace(lastResult);
$("#sound").onclick = () => {
  sound.enabled = !sound.enabled;
  storage.set("sl-sound", sound.enabled);
  sound.unlock();
  $("#sound").textContent = `SON ${sound.enabled ? "ON" : "OFF"}`;
  $("#sound").setAttribute("aria-pressed", String(sound.enabled));
  $("#sound").setAttribute(
    "aria-label",
    `${sound.enabled ? "Couper" : "Activer"} le son`,
  );
  sound.select();
};
function info(title, html) {
  $("#info-title").textContent = title;
  $("#info-content").innerHTML = html;
  $("#info").showModal();
}
$("#help").onclick = () =>
  info(
    "UTILISER LA BORNE",
    "<p>Choisis Soleil pour la journée, Lune pour la soirée. Règle ton envie et ton quartier, puis tire le levier vers le bas et relâche pour faire tourner la roue. Un clic simple fonctionne aussi.</p><p>Au clavier : maintiens Espace, puis relâche. Les flèches changent l’envie. Le sélecteur rotatif fait défiler les activités. AUTRES LIEUX renouvelle la sélection en gardant les filtres.</p><p>Six adresses au maximum sont affichées par tour. Elles sont choisies dans toute la sélection filtrée. Les trois derniers lieux sont écartés si d’autres restent disponibles. Chaque lieu affiché sur la roue a la même chance. L’élan change la rotation, pas les probabilités.</p><p>Les favoris et le compteur restent dans ce navigateur. Aucun compte ni paiement.</p>",
  );
$("#sources").onclick = () =>
  info(
    "À PROPOS & SOURCES",
    `<p>Quartier Libre propose des sorties à Lyon 7e, avec une borne pour la journée et une borne pour la soirée.</p><p>Cette première sélection couvre Lyon 7e. Elle n’est pas exhaustive. Les catégories jour / nuit sont éditoriales, les ouvertures ne sont pas vérifiées en temps réel.</p><p>Sources consultées le 17 novembre 2026 :</p><ul>${places.map((p) => `<li><a href="${p.source}" target="_blank" rel="noopener noreferrer">${escape(p.name)}</a>${p.statusSource ? ` · <a href="${p.statusSource}" target="_blank" rel="noopener noreferrer">Statut à revérifier</a>` : ""}</li>`).join("")}</ul><p>Décor original généré avec imagegen. Borne, commandes et roue réalisées dans le code. Sons synthétisés localement.</p>`,
  );
$("#close-info").onclick = () => $("#info").close();
for (const d of $$("dialog"))
  d.addEventListener("click", (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }
  });
document.body.dataset.mode = "choose";
if (import.meta.hot) import.meta.hot.dispose(() => wheel.dispose());
