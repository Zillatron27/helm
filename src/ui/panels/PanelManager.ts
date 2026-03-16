import "./panel.css";
import type { StarSystem, Planet } from "../../types/index.js";
import {
  getSelectedEntity,
  getViewLevel,
  getFocusedSystemId,
  setSelectedEntity,
  setViewLevel,
  setFocusedSystem,
  setActiveRoute,
  onStateChange,
} from "../state.js";
import {
  getSystemById,
  getPlanetsForSystem,
  loadPlanetsForSystem,
  getCxForSystem,
  getMaterialTicker,
} from "../../data/cache.js";
import { getCxDistances } from "../../data/cxDistances.js";
import { findRoute } from "../../data/pathfinding.js";
import { getPlanetBaseCount } from "../../data/siteCounts.js";
import { getNearestCxPrice } from "../../data/exchangePrices.js";
import { getGovernor } from "../../data/settledPlanets.js";
import { loadPlanetInfrastructure, getPlanetInfrastructure } from "../../data/infrastructure.js";
import type { MapRenderer } from "../../renderer/MapRenderer.js";

export class PanelManager {
  private containerEl: HTMLElement;
  private panelEl: HTMLElement;
  private renderer: MapRenderer | null = null;
  private isOpen = false;

  constructor() {
    this.containerEl = document.createElement("div");
    this.containerEl.id = "panel-container";

    this.panelEl = document.createElement("div");
    this.panelEl.className = "panel";
    this.containerEl.appendChild(this.panelEl);

    document.body.appendChild(this.containerEl);
  }

  init(renderer: MapRenderer): void {
    this.renderer = renderer;
    onStateChange(() => this.handleStateChange());
  }

  private handleStateChange(): void {
    const entity = getSelectedEntity();

    if (!entity) {
      this.hide();
      return;
    }

    if (entity.type === "system") {
      const system = getSystemById(entity.id);
      if (system) {
        const planets = getPlanetsForSystem(system.naturalId);
        this.showSystemPanel(system, planets);

        // If planets not cached yet, fetch and update
        if (!planets) {
          loadPlanetsForSystem(system.naturalId).then((loaded) => {
            // Only update if still viewing this system
            const current = getSelectedEntity();
            if (
              current?.type === "system" &&
              current.id === entity.id
            ) {
              this.showSystemPanel(system, loaded);
            }
          });
        }
      }
    } else if (entity.type === "planet") {
      const focusedId = getFocusedSystemId();
      if (!focusedId) return;
      const system = getSystemById(focusedId);
      if (!system) return;
      const planets = getPlanetsForSystem(system.naturalId);
      const planet = planets?.find((p) => p.id === entity.id || p.naturalId === entity.id);
      if (planet) {
        this.showPlanetPanel(planet);
      }
    }
  }

  private showSystemPanel(system: StarSystem, planets: Planet[] | null): void {
    const html = `
      <div class="panel-header">
        <h2 class="panel-title">${esc(system.name)}</h2>
        <div class="panel-subtitle">
          ${esc(system.naturalId)}
          <span class="panel-badge">${esc(system.spectralType)}-type</span>
        </div>
        <button class="panel-close" aria-label="Close panel">&times;</button>
      </div>
      <div class="panel-body">
        ${this.renderCxSection(system.id)}
        ${renderCxDistanceSection(system.id)}
        ${this.renderPlanetsSection(planets)}
        ${this.renderConnectionsSection(system)}
        ${this.renderZoomButton(system)}
      </div>
    `;
    this.setContent(html, () => {
      this.open();

      // Wire close button
      this.panelEl.querySelector(".panel-close")?.addEventListener("click", () => {
        setSelectedEntity(null);
      });

      // Wire zoom button
      this.panelEl.querySelector("[data-action='zoom']")?.addEventListener("click", () => {
        setFocusedSystem(system.id);
        setViewLevel("system");
      });

      this.wireCxBadgeClicks();

      // Wire planet links — zoom to system view and select the planet
      this.panelEl.querySelectorAll("[data-planet-id]").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          const planetId = (el as HTMLElement).dataset["planetId"];
          const planetSystemId = (el as HTMLElement).dataset["planetSystem"];
          if (!planetId || !planetSystemId) return;
          this.renderer?.panToPlanet(planetSystemId, planetId);
        });
      });

      // Wire connection links
      this.panelEl.querySelectorAll("[data-system-id]").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          const targetId = (el as HTMLElement).dataset["systemId"];
          if (!targetId) return;
          this.navigateToSystem(targetId);
        });
      });
    });
  }

  private renderCxSection(systemId: string): string {
    const cx = getCxForSystem(systemId);
    if (!cx) return "";

    const factionNames: Record<string, string> = {
      AI: "Antares Initiative",
      CI: "Castillo-Ito Mercantile",
      IC: "Insitor Cooperative",
      NC: "NEO Charter Exploration",
    };

    const faction = factionNames[cx.CountryCode] ?? cx.CountryCode;

    return `
      <div class="panel-section">
        <h3 class="panel-section-title">Commodity Exchange</h3>
        <div class="panel-row">
          <span class="panel-row-label">Station</span>
          <span class="panel-row-value">${esc(cx.Name)}</span>
        </div>
        <div class="panel-row">
          <span class="panel-row-label">Code</span>
          <span class="panel-row-value">${esc(cx.ComexCode)}</span>
        </div>
        <div class="panel-row">
          <span class="panel-row-label">Faction</span>
          <span class="panel-row-value">${esc(faction)}</span>
        </div>
        <div class="panel-row">
          <span class="panel-row-label">Currency</span>
          <span class="panel-row-value">${esc(cx.CurrencyCode)}</span>
        </div>
      </div>
    `;
  }

  private renderPlanetsSection(planets: Planet[] | null): string {
    if (!planets) {
      return `
        <div class="panel-section">
          <h3 class="panel-section-title">Planets</h3>
          <div class="panel-loading">Loading planets...</div>
        </div>
      `;
    }

    if (planets.length === 0) {
      return `
        <div class="panel-section">
          <h3 class="panel-section-title">Planets</h3>
          <div class="panel-loading">No planets</div>
        </div>
      `;
    }

    const rows = planets
      .map(
        (p) => {
          const bases = getPlanetBaseCount(p.naturalId);
          const basesText = bases > 0 ? `${bases}` : "";
          return `
          <div class="panel-planet-row">
            <a class="panel-planet-link" data-planet-id="${esc(p.id)}" data-planet-system="${esc(p.systemId)}">${esc(p.name || p.naturalId)}</a>
            <span class="panel-badge ${p.surface ? "panel-badge-rocky" : "panel-badge-gas"}">
              ${p.surface ? "Rocky" : "Gas"}
            </span>
            <span class="panel-planet-bases">${basesText}</span>
          </div>
        `;
        }
      )
      .join("");

    return `
      <div class="panel-section">
        <h3 class="panel-section-title">Planets (${planets.length})</h3>
        ${rows}
      </div>
    `;
  }

  private renderConnectionsSection(system: StarSystem): string {
    if (system.connectionIds.length === 0) return "";

    const links = system.connectionIds
      .map((id) => {
        const target = getSystemById(id);
        if (!target) return "";
        return `<a class="panel-link" data-system-id="${esc(id)}">${esc(target.name)} (${esc(target.naturalId)})</a>`;
      })
      .filter(Boolean)
      .join("");

    return `
      <div class="panel-section">
        <h3 class="panel-section-title">Connected Systems (${system.connectionIds.length})</h3>
        ${links}
      </div>
    `;
  }

  private renderZoomButton(system: StarSystem): string {
    // Only show zoom button if at galaxy level
    if (getViewLevel() === "system") return "";
    return `<button class="panel-button" data-action="zoom">Zoom to ${esc(system.name)}</button>`;
  }

  private showPlanetPanel(planet: Planet): void {
    const typeLabel = planet.surface ? "Rocky" : "Gaseous";
    const typeBadge = planet.surface ? "panel-badge-rocky" : "panel-badge-gas";

    const html = `
      <div class="panel-header">
        <h2 class="panel-title">${esc(planet.name || planet.naturalId)}</h2>
        <div class="panel-subtitle">
          ${esc(planet.naturalId)}
          <span class="panel-badge ${typeBadge}">${typeLabel}</span>
        </div>
        <button class="panel-close" aria-label="Close panel">&times;</button>
      </div>
      <div class="panel-body">
        ${renderCxDistanceSection(planet.systemId)}
        ${renderBaseCountSection(planet.naturalId)}
        ${this.renderResourcesSection(planet)}
        ${this.renderEnvironmentSection(planet)}
        ${this.renderInfrastructureSection(planet)}
        ${renderBuildRequirementsSection(planet)}
        ${renderPopulationSection(planet.naturalId)}
        ${this.renderFactionSection(planet)}
        ${renderPlanBaseLink(planet.naturalId)}
      </div>
    `;
    this.setContent(html, () => {
      this.open();

      this.panelEl.querySelector(".panel-close")?.addEventListener("click", () => {
        setSelectedEntity(null);
      });

      this.wireCxBadgeClicks();
      wireCollapsibleSections(this.panelEl);

      // Lazy-load infrastructure data
      const infraEl = this.panelEl.querySelector("[data-infra-planet]") as HTMLElement | null;
      if (infraEl) {
        const pNid = infraEl.dataset["infraPlanet"]!;
        const cached = getPlanetInfrastructure(pNid);
        if (cached) {
          infraEl.innerHTML = renderPopulationContent(cached);
        } else {
          loadPlanetInfrastructure(pNid).then((data) => {
            // Only update if still viewing this planet
            const current = getSelectedEntity();
            if (current?.type !== "planet") return;
            if (data) {
              infraEl.innerHTML = renderPopulationContent(data);
            } else {
              infraEl.innerHTML = `<span class="panel-loading">No data available</span>`;
            }
          });
        }
      }
    });
  }

  private renderEnvironmentSection(planet: Planet): string {
    const rows = [
      { label: "Gravity", value: `${planet.gravity.toFixed(2)}g` },
      {
        label: "Temperature",
        value: `${planet.temperature.toFixed(1)}°C`,
        cls: tempClass(planet.temperature),
      },
      { label: "Pressure", value: `${planet.pressure.toFixed(2)} atm` },
      { label: "Radiation", value: planet.radiation.toFixed(3) },
      {
        label: "Fertility",
        value:
          planet.fertility < 0
            ? "Infertile"
            : planet.fertility.toFixed(2),
        cls: planet.fertility < 0 ? "panel-row-value-negative" : "panel-row-value-positive",
      },
      { label: "Sunlight", value: planet.sunlight.toFixed(3) },
      { label: "Magnetic Field", value: planet.magneticField.toFixed(3) },
    ];

    return `
      <div class="panel-section">
        <h3 class="panel-section-title">Environment</h3>
        ${rows
          .map(
            (r) => `
            <div class="panel-row">
              <span class="panel-row-label">${r.label}</span>
              <span class="panel-row-value ${r.cls ?? ""}">${r.value}</span>
            </div>`
          )
          .join("")}
      </div>
    `;
  }

  private renderResourcesSection(planet: Planet): string {
    if (planet.resources.length === 0) {
      return `
        <div class="panel-section">
          <h3 class="panel-section-title">Resources</h3>
          <div class="panel-loading">No resources</div>
        </div>
      `;
    }

    const sorted = [...planet.resources].sort((a, b) => b.Factor - a.Factor);
    const rows = sorted
      .map(
        (r) => {
          const ticker = getMaterialTicker(r.MaterialId);
          const price = getNearestCxPrice(ticker, planet.systemId);
          const priceText = price && price.ask !== null
            ? `<span class="panel-resource-price">${Math.round(price.ask)} ${esc(price.currency)}</span>`
            : "";
          return `
          <div class="panel-resource">
            <span class="panel-resource-ticker">${esc(ticker)}</span>
            <span class="panel-resource-type">${esc(formatResourceType(r.ResourceType))}</span>
            <div class="panel-resource-bar">
              <div class="panel-resource-bar-fill" style="width: ${Math.round(r.Factor * 100)}%"></div>
            </div>
            ${priceText}
          </div>
        `;
        }
      )
      .join("");

    return `
      <div class="panel-section">
        <h3 class="panel-section-title">Resources (${planet.resources.length})</h3>
        ${rows}
      </div>
    `;
  }

  private renderInfrastructureSection(planet: Planet): string {
    const flags = [
      { label: "LM", active: planet.hasLocalMarket },
      { label: "COGC", active: planet.hasChamberOfCommerce },
      { label: "WAR", active: planet.hasWarehouse },
      { label: "ADM", active: planet.hasAdministrationCenter },
      { label: "SHY", active: planet.hasShipyard },
    ];

    const gov = getGovernor(planet.naturalId);
    const govLine = gov && gov.corporationCode
      ? `<div class="panel-row" style="margin-top: 6px">
          <span class="panel-row-label">Governor</span>
          <span class="panel-row-value">${esc(gov.corporationCode)}${gov.corporationName ? ` (${esc(gov.corporationName)})` : ""}</span>
        </div>`
      : "";

    return `
      <div class="panel-section">
        <h3 class="panel-section-title">Infrastructure</h3>
        <div class="panel-flags">
          ${flags
            .map(
              (f) =>
                `<span class="panel-flag ${f.active ? "panel-flag-active" : ""}">${f.label}</span>`
            )
            .join("")}
        </div>
        ${govLine}
      </div>
    `;
  }

  private renderFactionSection(planet: Planet): string {
    if (!planet.factionName) return "";

    return `
      <div class="panel-section">
        <h3 class="panel-section-title">Faction</h3>
        <div class="panel-row">
          <span class="panel-row-label">${esc(planet.factionName)}</span>
          <span class="panel-row-value">${esc(planet.factionCode ?? "")}</span>
        </div>
      </div>
    `;
  }

  private wireCxBadgeClicks(): void {
    this.panelEl.querySelectorAll("[data-cx-system]").forEach((el) => {
      el.addEventListener("click", () => {
        const cxSystemId = (el as HTMLElement).dataset["cxSystem"];
        const fromSystemId = (el as HTMLElement).dataset["fromSystem"];
        if (!cxSystemId || !fromSystemId) return;

        const route = findRoute(fromSystemId, cxSystemId);
        if (!route) return;

        setActiveRoute(route);

        // Frame the route — keep the panel open for comparison
        this.renderer?.frameRoute(route.systemIds);
      });
    });
  }

  private navigateToSystem(targetId: string): void {
    const currentView = getViewLevel();

    if (currentView === "system") {
      // Zoom out to galaxy first, then pan
      setSelectedEntity(null);
      setFocusedSystem(null);
      setViewLevel("galaxy");

      // Wait for zoom-out animation, then pan to target
      setTimeout(() => {
        this.renderer?.panToSystem(targetId);
      }, 850);
    } else {
      this.renderer?.panToSystem(targetId);
    }
  }

  private setContent(html: string, onReady?: () => void): void {
    if (this.isOpen) {
      // Panel already visible — cross-fade content
      this.panelEl.style.transition = "opacity 0.12s ease";
      this.panelEl.style.opacity = "0.3";

      setTimeout(() => {
        this.panelEl.innerHTML = html;
        this.panelEl.style.opacity = "1";
        setTimeout(() => {
          this.panelEl.style.transition = "";
          this.panelEl.style.opacity = "";
        }, 150);
        onReady?.();
      }, 120);
    } else {
      this.panelEl.innerHTML = html;
      onReady?.();
    }
  }

  private open(): void {
    // Force reflow for transition
    void this.panelEl.offsetHeight;
    this.panelEl.classList.add("panel-open");
    this.isOpen = true;
  }

  hide(): void {
    if (!this.isOpen) return;
    this.panelEl.classList.remove("panel-open");
    this.isOpen = false;
    setActiveRoute(null);
  }

  isVisible(): boolean {
    return this.panelEl.classList.contains("panel-open");
  }
}

// --- Helpers ---

function esc(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatResourceType(type: string): string {
  // Convert "GASEOUS" → "Gas", "LIQUID" → "Liquid", "MINERAL" → "Mineral"
  if (!type) return "";
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

function tempClass(temp: number): string {
  if (temp < -25) return "panel-row-value-negative";
  if (temp > 75) return "panel-row-value-negative";
  return "panel-row-value-positive";
}

function renderBaseCountSection(planetNaturalId: string): string {
  const count = getPlanetBaseCount(planetNaturalId);
  const display = count > 0 ? `${count}` : "Unsettled";
  const cls = count > 0 ? "" : "panel-row-value-neutral";

  return `
    <div class="panel-section">
      <h3 class="panel-section-title">Population</h3>
      <div class="panel-row">
        <span class="panel-row-label">Bases</span>
        <span class="panel-row-value ${cls}">${display}</span>
      </div>
    </div>
  `;
}

function renderCxDistanceSection(systemId: string): string {
  const entries = getCxDistances(systemId);
  if (entries.length === 0) return "";

  const badges = entries.map((entry, i) => {
    if (entry.jumps === -1) return "";
    const classes = ["panel-cx-badge"];
    if (i === 0) classes.push("panel-cx-nearest");
    if (entry.viaGateway) classes.push("panel-cx-gateway");

    const codeText = entry.viaGateway ? `${esc(entry.label)} \u2B21` : esc(entry.label);

    return `
      <span class="${classes.join(" ")}" data-cx-system="${esc(entry.systemId)}" data-from-system="${esc(systemId)}">
        <span class="panel-cx-code">${codeText}</span>
        <span class="panel-cx-jumps">${entry.jumps}</span>
      </span>
    `;
  }).filter(Boolean).join("");

  if (!badges) return "";

  return `
    <div class="panel-section panel-cx-distances">
      <h3 class="panel-section-title">CX Distance</h3>
      <div class="panel-cx-row">${badges}</div>
    </div>
  `;
}

function renderBuildRequirementsSection(planet: Planet): string {
  if (!planet.buildRequirements || planet.buildRequirements.length === 0) return "";

  const items = planet.buildRequirements
    .map((br) => `<span class="panel-build-item">${esc(br.ticker)} \u00d7${br.amount}</span>`)
    .join("");

  return `
    <div class="panel-section panel-section-collapsible">
      <h3 class="panel-section-title panel-section-toggle" data-section="build">
        Core Module Requirements
        <span class="panel-section-arrow">\u25b8</span>
      </h3>
      <div class="panel-section-content" data-section-content="build">
        <div class="panel-build-list">${items}</div>
      </div>
    </div>
  `;
}

function renderPopulationSection(planetNaturalId: string): string {
  return `
    <div class="panel-section panel-section-collapsible">
      <h3 class="panel-section-title panel-section-toggle" data-section="population">
        Population &amp; Economy
        <span class="panel-section-arrow">\u25b8</span>
      </h3>
      <div class="panel-section-content" data-section-content="population" data-infra-planet="${esc(planetNaturalId)}">
        <span class="panel-loading">Loading...</span>
      </div>
    </div>
  `;
}

function renderPopulationContent(data: import("../../types/index.js").InfrastructureData): string {
  if (data.population.length === 0 && data.projects.length === 0) {
    return `<span class="panel-loading">No infrastructure data</span>`;
  }

  let html = "";

  if (data.population.length > 0) {
    html += data.population.map((t) => `
      <div class="panel-row">
        <span class="panel-row-label">${esc(t.tier)}</span>
        <span class="panel-row-value">${t.count.toLocaleString()} <span class="panel-row-detail">${Math.round(t.happiness * 100)}% happy</span></span>
      </div>
    `).join("");
  }

  if (data.projects.length > 0) {
    html += `<div class="panel-flags" style="margin-top: 6px">`;
    html += data.projects.map((p) =>
      `<span class="panel-flag panel-flag-active">${esc(p.ticker)} Lv${p.level}</span>`
    ).join("");
    html += `</div>`;
  }

  return html;
}

function renderPlanBaseLink(planetNaturalId: string): string {
  const url = `https://prunplanner.org/plan/${encodeURIComponent(planetNaturalId)}`;
  return `<a class="panel-button panel-button-external" href="${url}" target="_blank" rel="noopener">Plan Base in PrUNplanner \u2197</a>`;
}

function wireCollapsibleSections(panelEl: HTMLElement): void {
  panelEl.querySelectorAll(".panel-section-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const section = toggle.closest(".panel-section-collapsible");
      if (section) {
        section.classList.toggle("panel-section-expanded");
      }
    });
  });
}
