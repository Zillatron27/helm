import type { StarSystem, Planet } from "../../types/index.js";
import {
  getSelectedEntity,
  getViewLevel,
  getFocusedSystemId,
  setSelectedEntity,
  setViewLevel,
  setFocusedSystem,
  onStateChange,
} from "../state.js";
import {
  getSystemById,
  getPlanetsForSystem,
  loadPlanetsForSystem,
  getCxForSystem,
  getMaterialTicker,
} from "../../data/cache.js";
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
      const planet = planets?.find((p) => p.id === entity.id);
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
        (p) => `
          <div class="panel-row">
            <span class="panel-row-label">${esc(p.name || p.naturalId)}</span>
            <span>
              <span class="panel-badge ${p.surface ? "panel-badge-rocky" : "panel-badge-gas"}">
                ${p.surface ? "Rocky" : "Gas"}
              </span>
              <span class="panel-badge">T${p.tier}</span>
            </span>
          </div>
        `
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
          <span class="panel-badge">Tier ${planet.tier}</span>
        </div>
        <button class="panel-close" aria-label="Close panel">&times;</button>
      </div>
      <div class="panel-body">
        ${this.renderEnvironmentSection(planet)}
        ${this.renderResourcesSection(planet)}
        ${this.renderInfrastructureSection(planet)}
        ${this.renderFactionSection(planet)}
      </div>
    `;
    this.setContent(html, () => {
      this.open();

      this.panelEl.querySelector(".panel-close")?.addEventListener("click", () => {
        setSelectedEntity(null);
      });
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
        (r) => `
          <div class="panel-resource">
            <span class="panel-resource-ticker">${esc(getMaterialTicker(r.MaterialId))}</span>
            <span class="panel-resource-type">${esc(formatResourceType(r.ResourceType))}</span>
            <div class="panel-resource-bar">
              <div class="panel-resource-bar-fill" style="width: ${Math.round(r.Factor * 100)}%"></div>
            </div>
          </div>
        `
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
    this.panelEl.classList.remove("panel-open");
    this.isOpen = false;
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
