import { ALL_DISTRICTS } from "./data.js";

// Move the existing controls rather than duplicating them: all game handlers,
// labels and keyboard controls keep a single source of truth.
export function mountCabinetHud() {
  const find = (selector) => document.querySelector(selector);
  const cabinet = find("#cabinet");
  cabinet.insertAdjacentHTML("afterbegin", `
    <div class="cabinet-shell" aria-hidden="true">
      <i class="shell-side shell-left"></i>
      <i class="shell-side shell-right"></i>
      <i class="shell-floor"></i>
    </div>`);
  cabinet.querySelector(".screen").insertAdjacentHTML("beforeend",
    '<div class="glass-reflection" aria-hidden="true"></div>');
  const toolbar = document.createElement("nav");
  toolbar.className = "cabinet-toolbar";
  toolbar.setAttribute("aria-label", "Commandes de la borne");
  const back = find("#back");
  back.textContent = "◀ Bornes";
  const catalogue = document.createElement("button");
  catalogue.id = "show-directory";
  catalogue.className = "panel-key";
  catalogue.textContent = "Adresses";
  catalogue.setAttribute("aria-expanded", "false");
  catalogue.setAttribute("aria-controls", "cabinet-directory");
  catalogue.setAttribute("aria-haspopup", "dialog");
  const help = find("#help");
  help.textContent = "Aide";
  toolbar.append(back, catalogue, find("#sound"), find("#cabinet-agenda"));
  cabinet.querySelector(".marquee").after(toolbar);

  const filters = document.createElement("details");
  filters.className = "cabinet-filters";
  filters.id = "cabinet-filters";
  filters.innerHTML = `<summary><span class="filter-readout"><b id="hud-activity">Tout</b><span><span id="hud-district">${ALL_DISTRICTS}</span> · <span id="hud-eligible"></span></span></span><span class="filter-caption">Filtres <i aria-hidden="true">⌄</i></span></summary><div class="filter-panel"></div>`;
  const panel = filters.querySelector(".filter-panel");
  const districtLabel = document.createElement("label");
  districtLabel.textContent = "Quartier";
  districtLabel.htmlFor = "district";
  districtLabel.append(find("#district"));
  const favorites = find("#favorites-only");
  favorites.textContent = "★ Favoris";
  const reset = find("#reset-filter");
  reset.className = "panel-key reset-key";
  reset.textContent = "Réinitialiser";
  panel.append(districtLabel, find("#categories"), reset);
  const filterBar = document.createElement("div");
  filterBar.className = "filter-bar";
  filterBar.append(filters, favorites);
  toolbar.after(filterBar);

  const dock = document.createElement("div");
  dock.className = "lever-dock";
  dock.append(find("#launch"));
  find(".control-deck").append(dock);
  find(".button-caption").textContent = "Tire ou maintiens";

  const wheelDetails = document.createElement("details");
  wheelDetails.className = "wheel-details";
  const wheelSummary = document.createElement("summary");
  wheelSummary.textContent = "Lieux sur la roue";
  wheelDetails.append(wheelSummary, find("#wheel-legend"));
  cabinet.after(wheelDetails);

  const directoryPanel = find("#cabinet-directory");
  catalogue.addEventListener("click", () => {
    directoryPanel.showModal();
    catalogue.setAttribute("aria-expanded", "true");
  });
  directoryPanel.addEventListener("close", () => catalogue.setAttribute("aria-expanded", "false"));
  find("#close-directory").onclick = () => directoryPanel.close();

  const counter = find(".session-stamp");
  counter.querySelector("span").textContent = "Tirages";
  const ticket = find(".next-ticket");
  ticket.querySelector("span").textContent = "Dernière adresse";
  find("#last-ticket").textContent = "—";
  find("#show-last").textContent = "Voir le ticket ↗";
  const slot = find(".ticket-slot");
  find(".cabinet-front").replaceChildren(counter, slot, ticket);
  const credits = document.createElement("div");
  credits.className = "cabinet-credits";
  const signature = document.createElement("span");
  signature.textContent = "QUARTIER LIBRE · LYON 7e";
  const sources = find("#sources");
  sources.textContent = "Sources";
  credits.append(signature, help, sources);
  wheelDetails.after(credits);
  find(".left-panel").remove();
  find(".right-panel").remove();
  find(".play-top").remove();
  find(".keyboard-note").remove();
  document.body.classList.add("cabinet-hud");
  return {
    sync({ category, district, eligible }) {
      find("#hud-activity").textContent =
        category === "Tout" ? "Toutes les activités" : category;
      find("#hud-district").textContent = district;
      find("#hud-eligible").textContent = `${eligible} ${eligible > 1 ? "adresses" : "adresse"}`;
      filters.classList.toggle(
        "has-filters",
        category !== "Tout" ||
          district !== ALL_DISTRICTS ||
          favorites.getAttribute("aria-pressed") === "true",
      );
    },
    resetPanels() {
      filters.open = false;
      wheelDetails.open = false;
      if (directoryPanel.open) directoryPanel.close();
    },
  };
}
