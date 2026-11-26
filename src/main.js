import "./style.css";
import "./cabinet.css";
import "./arcade.css";
import "./cabinet-hud.css";
import "./ticket.css";
import { mountCabinetHud } from "./cabinet-hud.js";
import {
  places,
  ALL_DISTRICTS,
  filterPlaces,
  chooseIndex,
  makeWheelPool,
  renewWheelPool,
} from "./data.js";
import { ArcadeWheel } from "./wheel.js";
import { Sound } from "./sound.js";
import { mountTicketMap } from "./ticket-map.js";
import { mountAgenda } from "./agenda.js";
import { mountTicketAgenda } from "./ticket-agenda.js";
import { mountBaySmoke } from "./bay-smoke.js";
import { mountActivityDial } from "./activity-dial.js";
import { mountInstallation } from "./pwa.js";

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
  district = ALL_DISTRICTS,
  query = "",
  favoritesOnly = false,
  spinning = false,
  charging = false,
  chargeStart = 0,
  chargeFrame,
  leverStartY = 0,
  leverPull = null,
  activePool = [],
  lastResult = null,
  lastDraw = null,
  keptTicket = null,
  previousFocus = null,
  poolDirty = false;
let dialAngle = 0;
let favorites = storage
    .get("sl-favorites", [])
    .filter((x) => typeof x === "string"),
  recent = storage
    .get("sl-recent", [])
    .filter((x) => typeof x === "string")
    .slice(-3),
  count = Number(storage.get("sl-count", 0)) || 0;
const PRINT_TIMING = {
  sun: { transfer: 320, feed: 590 },
  moon: { transfer: 410, feed: 640 },
};
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const sparkTracks = Array.from({ length: 10 }, (_, i) => {
  const angle = i * 137.5;
  const delay = 80 + (i % 7) * 78;
  const duration = 750 + (i % 5) * 140;
  return `<i style="--angle:${angle}deg;--delay:${delay}ms;--duration:${duration}ms"></i>`;
}).join("");

const sound = new Sound();
sound.enabled = storage.get("sl-sound", false) === true;

$("#app").innerHTML = `
 <div class="room" aria-hidden="true"></div><div class="room-shade" aria-hidden="true"></div><div class="bay-dust" aria-hidden="true"><canvas id="bay-smoke" class="bay-smoke"></canvas></div>
 <header class="site-header"><a href="#" id="home" aria-label="Revenir au choix de la borne"><span class="brand-symbol">7<span>e</span></span><span>QUARTIER<br><b>LIBRE</b></span></a><span class="header-caption">SORTIES À LYON 7e · JOUR / NUIT</span><div class="header-actions"><span class="local-label"><i></i> LYON 7e</span><button id="install-app" type="button" class="plain-button" aria-label="Installer Quartier Libre" hidden>Installer</button><button id="sound" class="plain-button" aria-pressed="${sound.enabled}" aria-label="${sound.enabled ? "Couper" : "Activer"} le son">SON ${sound.enabled ? "ON" : "OFF"}</button><button id="help" class="plain-button" aria-label="Comment jouer">?</button></div></header>
 <main>
  <section id="choose" class="choose" aria-labelledby="welcome-title"><h1 id="welcome-title" class="sr-only">Choisir une borne</h1>
   <button type="button" class="agenda-trigger" data-agenda>Une sortie avec Ville Morte</button>
   <div class="choices"><button class="choice sun-choice" data-mode="sun" aria-label="Choisir la borne Soleil"><span class="choice-top">SERVICE DE JOUR <span>01 / S</span></span><span class="choice-art" aria-hidden="true"></span><span class="pixel-sun" aria-hidden="true"></span><strong>SOLEIL</strong><span class="choice-copy">Cafés, restaurants, parcs et culture.</span></button><span class="choice-divider" aria-hidden="true">OU</span><button class="choice moon-choice" data-mode="moon" aria-label="Choisir la borne Lune"><span class="choice-top">SERVICE DE NUIT <span>02 / L</span></span><span class="choice-art" aria-hidden="true"></span><span class="pixel-moon" aria-hidden="true"></span><strong>LUNE</strong><span class="choice-copy">Bars, concerts, restaurants et club.</span></button></div>
   <p class="welcome-bottom"><span>GUILLOTIÈRE / JEAN MACÉ / GERLAND</span><span>${places.length} ADRESSES</span></p>
  </section>
  <section id="play" class="play" hidden aria-label="La borne de sorties"><div class="play-top"><button id="back" class="text-button">← CHANGER DE BORNE</button><span class="play-top-note">GUILLOTIÈRE · JEAN MACÉ · GERLAND</span></div>
   <div class="game-layout"><aside class="left-panel"><p class="eyebrow">COMMENT JOUER</p><h2>Tire le levier.</h2><ol><li>Choisis ton envie.</li><li>Tire le levier vers le bas.</li><li>Relâche pour lancer.</li></ol><p class="side-note">Six lieux au maximum par tour.<br>Les derniers tirages sont écartés.</p><div class="session-stamp"><span>TIRAGES</span><strong id="session-count">${String(count).padStart(2, "0")}</strong></div></aside>
   <article id="cabinet" class="cabinet" aria-labelledby="machine-title"><div class="cabinet-roof"><span class="roof-serial">QL–07 / <span id="serial-mode">S</span></span><span class="roof-lights" aria-hidden="true">▪ ▪ ▪ ▪ ▪</span></div><div class="marquee"><i class="screw" aria-hidden="true"></i><div><span id="machine-kicker">JOURNÉE / LYON 7e</span><h2 id="machine-title">SOLEIL</h2></div><span id="machine-icon" class="marquee-icon" aria-hidden="true">☀</span><i class="screw" aria-hidden="true"></i></div>
    <div class="screen-bezel"><div class="bezel-lamp bezel-lamp-left" aria-hidden="true"></div><div class="bezel-lamp bezel-lamp-right" aria-hidden="true"></div><div class="screen"><div class="screen-top"><span><i class="status-led"></i><span id="screen-status">PRÊT À SORTIR</span></span><span id="pool-count"></span></div><div id="wheel" class="wheel" aria-label="Roue 3D des lieux de sortie"></div><div class="screen-bottom"><span id="screen-hint">TIRE LE LEVIER POUR LANCER.</span><span class="blink" aria-hidden="true">▮</span></div><div class="wheel-effects" aria-hidden="true"><div class="wheel-sparks">${sparkTracks}</div></div><div class="scanlines" aria-hidden="true"></div></div></div>
    <ol id="wheel-legend" class="wheel-legend" aria-label="Les lieux de la roue"></ol><div class="control-deck"><span class="deck-trace deck-trace-input" aria-hidden="true"></span><span class="deck-trace deck-trace-output" aria-hidden="true"></span><div class="activity-control"><button id="joystick" class="activity-dial" aria-label="Changer d’activité"><span class="dial-face" aria-hidden="true"></span></button><span id="activity-label" aria-live="polite">Tout</span></div><div class="launch-area"><div class="power-track" role="meter" aria-label="Puissance du lancer" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="power"></span></div><button id="launch" class="slot-lever" aria-label="Tirer le levier pour lancer la roue"><span class="lever-mount" aria-hidden="true"></span><span class="lever-arm" aria-hidden="true"><span class="lever-ball"></span></span></button><span id="lever-caption" class="lever-caption">ÉLAN</span><span class="button-caption">OU MAINTIENS ESPACE</span></div><button id="reroll" class="reroll-button" aria-label="Changer les lieux de la roue"><span aria-hidden="true">↻</span><b>AUTRES<br>LIEUX</b></button><button id="reset-filter" class="small-arcade" aria-label="Réinitialiser les filtres"><span></span>RESET</button></div>
    <div class="neighborhood-strip" aria-hidden="true"></div><div class="cabinet-front"><div class="speaker" aria-hidden="true"></div><div class="ticket-slot" aria-hidden="true"><i class="printer-led"></i><div class="printer-feed"><div class="printer-paper"><b id="print-place"></b><i></i></div></div></div><div class="cabinet-sticker">GUILLO<br>69007</div><div class="front-bottom"><span>QUARTIER LIBRE · LYON 7e</span><span>FREE PLAY</span></div></div><div class="cabinet-foot" aria-hidden="true"></div>
   </article>
   <aside class="right-panel"><p class="eyebrow">CHOISIR LES LIEUX</p><label class="field-label" for="district">TON QUARTIER</label><select id="district"><option>${ALL_DISTRICTS}</option><option>Tout le 7e</option><option>Guillotière</option><option>Jean Macé</option><option>Gerland</option><option>Blandan</option><option>Rancy · Lyon 3e</option></select><span class="field-label">TON ENVIE</span><div id="categories" class="category-list"></div><button id="favorites-only" class="favorite-filter" aria-pressed="false">☆ Mes favoris</button><div class="next-ticket"><span>DERNIER TICKET</span><p id="last-ticket">Aucun tirage pour le moment.</p><button id="show-last" class="text-button" hidden>REVOIR LE LIEU ↗</button></div></aside></div>
   <button type="button" id="cabinet-agenda" data-agenda>Ville Morte</button>
   <p class="keyboard-note">CLAVIER : <kbd>ESPACE</kbd> ABAISSER / RELÂCHER <span>·</span> <kbd>←</kbd> <kbd>→</kbd> CHANGER D’ENVIE</p>
   <dialog id="cabinet-directory" aria-labelledby="directory-title">
     <header class="directory-heading">
       <h2 id="directory-title" tabindex="-1" autofocus>Carnet d’adresses</h2>
       <button type="button" id="close-directory" aria-label="Fermer le carnet">×</button>
       <label class="search"><span class="sr-only">Chercher un lieu</span><input id="search" type="search" placeholder="Nom, rue ou activité…" maxlength="100"></label>
       <p id="directory-count" aria-live="polite"></p>
     </header>
     <div id="place-list" class="place-list"></div>
   </dialog>
  </section>
 </main><footer><span>QUARTIER LIBRE — SOLEIL / LUNE</span><span>UNE SÉLECTION DU 7e ARRONDISSEMENT</span><button id="sources" class="text-button">À PROPOS & SOURCES ↗</button></footer>
 <dialog id="result" class="result" aria-labelledby="result-title">
  <button id="close-result" class="dialog-close" aria-label="Fermer le ticket">×</button>
  <div class="ticket-body">
   <header class="ticket-head">
    <p class="eyebrow" id="result-label">Résultat du tirage</p>
    <h2 id="result-title" tabindex="-1" autofocus></h2>
    <p id="result-category"></p>
    <address id="result-address"></address>
   </header>
   <div id="ticket-compare" class="ticket-compare" aria-label="Comparer les tickets" hidden>
    <button id="compare-kept" type="button"></button>
    <button id="compare-draw" type="button"></button>
   </div>
   <section id="ticket-agenda" aria-label="Programmation du lieu" hidden></section>
   <p id="result-description"></p>
   <section id="ticket-map" class="ticket-map" aria-label="Carte du lieu">
    <p id="map-status" role="status"></p>
    <div id="map-frame"></div>
    <a id="osm-link" target="_blank" rel="noopener noreferrer">Ouvrir dans OpenStreetMap</a>
   </section>
   <div class="ticket-secondary">
    <a id="official" target="_blank" rel="noopener noreferrer">Infos du lieu</a>
    <button id="favorite-result" type="button" class="text-button"></button>
   </div>
   <p id="result-note" class="result-note"></p>
   <section class="detour" aria-label="Découvrir les environs">
    <button id="detour-button" type="button" class="text-button">Un détour</button>
    <p id="detour-status" role="status"></p>
    <a id="detour-link" target="_blank" rel="noopener noreferrer" hidden></a>
   </section>
  </div>
  <div class="ticket-links">
   <a id="maps" target="_blank" rel="noopener noreferrer">Y aller</a>
   <button id="again" type="button">Garder et relancer</button>
  </div>
 </dialog>
 <dialog id="agenda" class="info-dialog" aria-labelledby="agenda-title"><button id="close-agenda" class="dialog-close" aria-label="Fermer">×</button><h2 id="agenda-title">Tirage Ville Morte</h2><p id="agenda-status" role="status"></p><article id="agenda-card" hidden><h3 id="agenda-event-name"></h3><p id="agenda-event-date"></p><p id="agenda-event-place"></p><a id="agenda-event-link" target="_blank" rel="noopener noreferrer">Voir l’annonce sur Ville Morte</a></article><button id="agenda-again" class="agenda-trigger" type="button" hidden>Autre événement</button><p><a href="https://agenda.villemorte.fr/" target="_blank" rel="noopener noreferrer">Tout l’agenda Ville Morte</a></p></dialog>
 <dialog id="info" class="info-dialog"><button id="close-info" class="dialog-close" aria-label="Fermer">×</button><h2 id="info-title"></h2><div id="info-content"></div></dialog><div id="announce" class="sr-only" aria-live="polite"></div>`;

$(".welcome-bottom span").textContent = "GUILLOTIÈRE / JEAN MACÉ / GERLAND";
mountInstallation($("#install-app"));
const hud = mountCabinetHud();
const cabinet = $("#cabinet");
const printerSlot = $(".ticket-slot");
const printPaper = $(".printer-paper");
const lever = $("#launch");
const leverCaption = $("#lever-caption");
const leverMeter = $(".power-track");
const result = $("#result");
const ticketBody = $(".ticket-body");
const stopBaySmoke = mountBaySmoke($("#bay-smoke"), cabinet);
const ticketMap = mountTicketMap($(".ticket-body"));
const ticketAgenda = mountTicketAgenda($("#ticket-agenda"));
const openAgenda = mountAgenda($("#agenda"));
$$("[data-agenda]").forEach((button) => button.addEventListener("click", openAgenda));
const wheel = new ArcadeWheel($("#wheel"), {
  onTick: (p, i) => {
    sound.tick(p);
    if (p > 0.72 && !cabinet.classList.contains("braking")) {
      cabinet.classList.add("braking");
      $("#screen-status").textContent = "FREINAGE";
    }
    const place = activePool[i];
    const hint = $("#screen-hint");
    if (place && hint.textContent !== (place.shortName ?? place.name)) {
      hint.textContent = place.shortName ?? place.name;
      highlightPlace(i);
    }
  },
  onDone: (i) => reveal(activePool[i]),
});
function filtered(search = "") {
  return filterPlaces(places, {
    mode,
    category,
    district,
    query: search,
    favorites: favoritesOnly ? favorites : null,
  });
}
function drawablePlaces() {
  return filtered().filter((place) => place.available !== false);
}
function refreshPool({ renew = false, exclude = null } = {}) {
  const eligible = drawablePlaces();
  const candidates = exclude ? eligible.filter(({ id }) => id !== exclude) : eligible;
  activePool = renew
    ? renewWheelPool(candidates, recent, activePool)
    : makeWheelPool(candidates, recent);
  $("#cabinet").classList.remove("has-winner", "printing");
  poolDirty = false;
  wheel.setPlaces(activePool, mode);
  $("#wheel-legend").innerHTML = activePool
    .map(
      (p, i) =>
        `<li data-index="${i}"><span>${String(i + 1).padStart(2, "0")}</span>${escape(p.name)}</li>`,
    )
    .join("");
  hud.sync({ category, district, eligible: eligible.length });
  $("#reroll").disabled = eligible.length < 2;
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
  cabinet.classList.remove("renewing", "changing-activity", "arriving");
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
  const targetAngle = categories.indexOf(category) * (360 / categories.length);
  const delta = (((targetAngle - dialAngle + 180) % 360) + 360) % 360 - 180;
  dialAngle += delta;
  $("#joystick").style.setProperty("--dial-angle", `${dialAngle}deg`);
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
  const list = filtered(query);
  $("#directory-count").textContent =
    [`${list.length} adresse${list.length > 1 ? "s" : ""}`, mode === "sun" ? "Soleil" : "Lune",
      district, category === "Tout" ? "" : category, favoritesOnly ? "Favoris" : ""].filter(Boolean).join(" · ");
  $("#place-list").innerHTML = list.length
    ? list
        .map(
          (p) =>
            `<article class="place"><div class="place-meta">${escape(p.district)} <span>${escape(p.category)}</span></div><button class="place-title" data-open="${p.id}">${escape(p.name)} <span>↗</span></button><p>${escape(p.address)}</p>${p.available === false ? '<small class="unavailable">Statut à revérifier · hors tirages</small>' : ""}<button class="place-favorite" data-favorite="${p.id}" aria-label="${favorites.includes(p.id) ? "Retirer" : "Ajouter"} ${escape(p.name)} ${favorites.includes(p.id) ? "des" : "aux"} favoris" aria-pressed="${favorites.includes(p.id)}">${favorites.includes(p.id) ? "★" : "☆"}</button></article>`,
        )
        .join("")
    : `<div class="empty"><h3>Aucune adresse trouvée</h3><button type="button" data-clear-directory>${query ? "Effacer la recherche" : "Réinitialiser les filtres"}</button></div>`;
}
function chooseMode(value) {
  if (spinning) return;
  cancelCharge();
  mode = value;
  const printer = PRINT_TIMING[mode];
  cabinet.style.setProperty("--print-transfer", `${printer.transfer}ms`);
  cabinet.style.setProperty("--paper-feed", `${printer.feed}ms`);
  keptTicket = null;
  hud.resetPanels();
  category = "Tout";
  district = ALL_DISTRICTS;
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
  sound.setMode(mode);
  sound.select();
  refresh();
  animateCabinet("arriving");
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
  hud.resetPanels();
  $(".choice").focus({ preventScroll: true });
}
function lock(value) {
  spinning = value;
  cabinet.classList.toggle("spinning", value);
  if (!value) cabinet.classList.remove("braking");
  $$("#play button, #play select, #play input, #home").forEach((el) => {
    if (el.tagName === "A") {
      el.setAttribute("aria-disabled", String(value));
      return;
    }
    el.disabled = value;
  });
  if (!value) {
    $("#reroll").disabled = drawablePlaces().length < 2;
    lever.disabled = !activePool.length;
  }
}
function chargePower(now) {
  const held = Math.max(0, Math.min(1, (now - chargeStart) / 1250));
  return leverPull ?? (0.25 + held * 0.75);
}
function beginCharge() {
  if (spinning || !mode || !activePool.length || charging) return;
  if (poolDirty) refreshPool();
  charging = true;
  chargeStart = performance.now();
  sound.grab();
  cabinet.classList.add("charging");
  lever.classList.add("pressed");
  $("#screen-status").textContent = "RELÂCHE POUR LANCER";
  const frame = (now) => {
    if (!charging) return;
    paintCharge(chargePower(now));
    chargeFrame = requestAnimationFrame(frame);
  };
  frame(chargeStart);
}
function paintCharge(power) {
  const percentage = Math.round(power * 100);
  cabinet.style.setProperty("--charge", power);
  lever.style.setProperty("--pull", power);
  leverMeter.setAttribute("aria-valuenow", percentage);
  const caption = charging ? `${percentage} %` : "ÉLAN";
  if (leverCaption.textContent !== caption) leverCaption.textContent = caption;
}
function cancelCharge() {
  if (!charging) return;
  charging = false;
  cancelAnimationFrame(chargeFrame);
  leverPull = null;
  lever.classList.remove("pressed");
  cabinet.classList.remove("charging");
  paintCharge(0);
  if (!spinning) $("#screen-status").textContent = "PRÊT À SORTIR";
}
function releaseCharge() {
  if (!charging) return;
  const power = chargePower(performance.now());
  cancelCharge();
  launch(power);
}
function launch(power = 0.4) {
  if (spinning || !mode) return;
  if (poolDirty) refreshPool();
  if (!activePool.length) return;
  cabinet.style.setProperty("--launch-signal", 0.56 + power * 0.44);
  sound.launch(power);
  lock(true);
  leverCaption.textContent = "TIRAGE";
  $("#screen-status").textContent = "TIRAGE EN COURS";
  $("#screen-hint").textContent = "LA ROUE TOURNE.";
  $("#announce").textContent = "La roue tourne.";
  wheel.spin(chooseIndex(activePool.length), power);
}
function reveal(p) {
  lastDraw = p;
  poolDirty = true;
  $("#print-place").textContent = p.shortName ?? p.name;
  cabinet.classList.add("has-winner", "printing");
  leverCaption.textContent = "ÉLAN";
  cabinet.classList.remove("braking");
  $("#screen-status").textContent = "IMPRESSION DU TICKET";
  $("#screen-hint").textContent = p.shortName ?? p.name;
  highlightPlace(activePool.findIndex((place) => place.id === p.id));
  lastResult = p;
  recent = [...recent.filter((id) => id !== p.id), p.id].slice(-3);
  storage.set("sl-recent", recent);
  count++;
  storage.set("sl-count", count);
  $("#session-count").textContent = String(count).padStart(2, "0");
  $("#last-ticket").textContent = p.name;
  $("#show-last").hidden = false;
  const printer = PRINT_TIMING[mode];
  if (!reducedMotion.matches) {
    const slot = printerSlot.getBoundingClientRect();
    if (slot.top < 0 || slot.bottom + 24 > innerHeight)
      printerSlot.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  sound.win(
    reducedMotion.matches ? 0 : printer.transfer / 1000,
    reducedMotion.matches ? 0.17 : printer.feed / 1000,
  );
  const present = () => {
    const paper = printPaper.getBoundingClientRect();
    cabinet.classList.remove("printing");
    $("#screen-status").textContent = "ADRESSE TROUVÉE";
    lock(false);
    $("#announce").textContent = `Prochaine sortie : ${p.name}. ${p.address}`;
    openPlace(p, true, paper);
  };
  if (reducedMotion.matches) present();
  else setTimeout(present, printer.transfer + printer.feed + 110);
}
function openPlace(p, won = false, paper = null) {
  if (!result.open) previousFocus = paper ? lever : document.activeElement;
  lastResult = p;
  $("#result-label").textContent = won ? "Résultat du tirage" : "Carnet du 7e";
  $("#result-category").textContent = `${p.district} · ${p.category}`;
  $("#again").disabled = !hasAlternative(p);
  updateTicketComparison(p);
  $("#result-title").textContent = p.name;
  $("#result-description").textContent = p.description;
  $("#result-address").textContent = p.address;
  ticketMap.setPlace(p);
  ticketAgenda.setPlace(p);
  $("#maps").href =
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.address)}`;
  $("#official").href = p.source;
  $("#result-note").textContent =
    p.available === false
      ? "Statut à revérifier. Ce lieu est exclu des tirages."
      : "Vérifie les horaires et la programmation avant de partir.";
  $("#favorite-result").textContent = favorites.includes(p.id)
    ? "Retirer des favoris"
    : "Ajouter aux favoris";
  ticketBody.scrollTop = 0;
  if (!result.open) {
    result.showModal();
    if (!reducedMotion.matches && paper) {
      const ticket = result.getBoundingClientRect();
      const x = paper.left + (paper.width - ticket.width) / 2 - ticket.left;
      const y = paper.top - ticket.top;
      const scale = paper.width / ticket.width;
      result.animate([
        { transform: `translate(${x}px, ${y}px) rotate(-6deg) scale(${scale})` },
        {
          transform: `translate(${x * 0.20}px, ${y * 0.23 - 17}px) rotate(1.7deg) scale(.78)`,
          offset: 0.61,
        },
        { transform: "none" },
      ], { duration: 580, easing: "cubic-bezier(.18,.7,.24,1)" });
    }
  }
}

function hasAlternative(place) {
  return drawablePlaces().some((candidate) => candidate.id !== place.id);
}

function updateTicketComparison(place) {
  const pair = [keptTicket, lastDraw];
  const show = pair.every(Boolean) && pair[0].id !== pair[1].id &&
    pair.some((candidate) => candidate.id === place.id);
  $("#ticket-compare").hidden = !show;
  if (!show) return;
  ["#compare-kept", "#compare-draw"].forEach((selector, index) => {
    const button = $(selector);
    button.textContent = pair[index].name;
    button.setAttribute("aria-pressed", String(pair[index].id === place.id));
  });
}
function toggleFavorite(id) {
  favorites = favorites.includes(id)
    ? favorites.filter((x) => x !== id)
    : [...favorites, id];
  storage.set("sl-favorites", favorites);
  if (favoritesOnly) {
    renderDirectory();
  } else {
    const star = document.querySelector(`[data-favorite="${CSS.escape(id)}"]`);
    if (star) {
      const saved = favorites.includes(id);
      const name = places.find((place) => place.id === id).name;
      star.textContent = saved ? "★" : "☆";
      star.setAttribute("aria-pressed", String(saved));
      star.setAttribute("aria-label", saved ? `Retirer ${name} des favoris` : `Ajouter ${name} aux favoris`);
    }
  }
  if (lastResult)
    $("#favorite-result").textContent = favorites.includes(lastResult.id)
      ? "Retirer des favoris"
      : "Ajouter aux favoris";
  if (!spinning && favoritesOnly) refreshPool();
  if (lastResult) $("#again").disabled = !hasAlternative(lastResult);
}
function closeResult() {
  result.close();
}
function reset() {
  if (spinning) return;
  category = "Tout";
  district = ALL_DISTRICTS;
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
  if (!buttons.length) return;
  const next = ((index + delta) % buttons.length + buttons.length) % buttons.length;
  if (next === index) return;
  category = buttons[next].dataset.category;
  refresh();
  sound.select();
  animateCabinet("changing-activity");
}
$$("[data-mode]").forEach((b) =>
  b.addEventListener("click", () => chooseMode(b.dataset.mode)),
);
$("#back").onclick = home;
$("#home").onclick = home;
lever.addEventListener("pointerdown", (e) => {
  if (
    !e.isPrimary ||
    (e.button !== 0 && e.pointerType !== "touch") ||
    spinning || charging ||
    !activePool.length
  )
    return;
  leverStartY = e.clientY;
  leverPull = null;
  lever.setPointerCapture(e.pointerId);
  beginCharge();
});
lever.addEventListener("pointermove", (e) => {
  if (!charging || !lever.hasPointerCapture(e.pointerId)) return;
  const distance = e.clientY - leverStartY;
  if (leverPull === null && distance < 5) return;
  leverPull = Math.max(0, Math.min(1, distance / 90));
});
lever.addEventListener("pointerup", (e) => {
  if (lever.hasPointerCapture(e.pointerId)) releaseCharge();
});
lever.addEventListener("pointercancel", cancelCharge);
lever.addEventListener("lostpointercapture", () => {
  if (charging) cancelCharge();
});
lever.addEventListener("click", (e) => {
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
    if (e.target.closest("button, a, summary") && e.target.id !== "launch") return;
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
mountActivityDial($("#joystick"), nextCategory);
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
  renderDirectory();
  $("#place-list").scrollTop = 0;
};
$("#favorites-only").onclick = () => {
  favoritesOnly = !favoritesOnly;
  $("#favorites-only").setAttribute("aria-pressed", String(favoritesOnly));
  refresh();
};
$("#place-list").onclick = (e) => {
  if (e.target.closest("[data-clear-directory]")) {
    if (query) {
      query = "";
      $("#search").value = "";
      renderDirectory();
    } else reset();
    $("#search").focus();
    return;
  }
  const f = e.target.closest("[data-favorite]"),
    b = e.target.closest("[data-open]");
  if (f) {
    toggleFavorite(f.dataset.favorite);
    (document.querySelector(`[data-favorite="${CSS.escape(f.dataset.favorite)}"]`) || $("#search")).focus({ preventScroll: true });
  }
  if (b) openPlace(places.find((p) => p.id === b.dataset.open));
};
$("#favorite-result").onclick = () => toggleFavorite(lastResult.id);
$("#close-result").onclick = closeResult;
result.addEventListener("close", () => {
  if (result.open) return;
  result.getAnimations().forEach((animation) => animation.cancel());
  ticketMap.clear();
  ticketAgenda.clear();
  const opener = previousFocus?.isConnected ? previousFocus : $("#cabinet-directory").open
    ? (document.querySelector(`[data-open="${CSS.escape(lastResult.id)}"]`) || $("#search"))
    : lever;
  opener?.focus({ preventScroll: true });
});
$("#again").onclick = () => {
  if (!lastResult || spinning || !hasAlternative(lastResult)) return;
  keptTicket = lastResult;
  closeResult();
  if ($("#cabinet-directory").open) {
    $("#cabinet-directory").close();
    previousFocus = lever;
    lever.scrollIntoView({ block: "center", behavior: "instant" });
  }
  refreshPool({ exclude: keptTicket.id });
  launch();
};
$("#compare-kept").onclick = () => openPlace(keptTicket, keptTicket === lastDraw);
$("#compare-draw").onclick = () => openPlace(lastDraw, true);
$("#show-last").onclick = () => openPlace(lastDraw || lastResult, true);
$("#sound").onclick = () => {
  sound.setEnabled(!sound.enabled);
  storage.set("sl-sound", sound.enabled);
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
    "<p>Choisis Soleil pour la journée, Lune pour la soirée. Règle ton envie et ton quartier, puis tire le levier vers le bas et relâche pour faire tourner la roue. Un clic simple fonctionne aussi.</p><p>Au clavier : maintiens Espace, puis relâche. Les flèches changent l’envie. Clique sur le sélecteur ou fais-le glisser à gauche ou à droite pour changer d’activité. AUTRES LIEUX renouvelle la sélection en gardant les filtres.</p><p>Six adresses au maximum sont affichées par tour. Elles sont choisies dans toute la sélection filtrée. Les trois derniers lieux sont écartés si d’autres restent disponibles. Chaque lieu affiché sur la roue a la même chance. L’élan change la rotation, pas les probabilités.</p><p>Les favoris et le compteur restent dans ce navigateur. Aucun compte ni paiement.</p>",
  );
$("#sources").onclick = () =>
  info(
    "À PROPOS & SOURCES",
    `<p>Quartier Libre propose des sorties à Lyon 7e, avec une borne pour la journée et une borne pour la soirée.</p><p>La sélection couvre le 7e et inclut la Maison pour tous des Rancy, dans le 3e. Les catégories jour / nuit sont éditoriales, les ouvertures ne sont pas vérifiées en temps réel.</p><p>Sources du catalogue :</p><ul>${places.map((p) => `<li><a href="${p.source}" target="_blank" rel="noopener noreferrer">${escape(p.name)}</a> · ${p.checked}${p.statusSource ? ` · <a href="${p.statusSource}" target="_blank" rel="noopener noreferrer">Statut à revérifier</a>` : ""}</li>`).join("")}</ul><p>Décor original généré avec imagegen. Borne, commandes et roue réalisées dans le code. Sons synthétisés localement.</p>`,
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
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopBaySmoke();
    wheel.dispose();
  });
}
