import { getResourceFilters, onResourceFilterChange } from "../state.js";
import {
  getResourceContributions,
  getPlanetDisplayName,
  isResourceIndexReady,
  onResourceIndexReady,
} from "../../data/resourceIndex.js";
import { getCxDistances } from "../../data/cxDistances.js";
import { getPlanetBaseCount } from "../../data/siteCounts.js";
import { getSystemById, getMaterialTicker, getMaterialByTicker, getAllCxStations } from "../../data/cache.js";
import type { MapRenderer } from "../../renderer/MapRenderer.js";
import "./sidebar.css";

type SortKey = "planet" | "ticker" | "factor" | "cx" | "bases";
type SortDir = "asc" | "desc";

interface Row {
  planetName: string;
  planetNaturalId: string;
  systemId: string;
  systemName: string;
  systemNaturalId: string;
  ticker: string;
  factor: number;
  bases: number;
  // Distance to each CX (by ComexCode). -1 = unreachable.
  cxJumps: Map<string, { jumps: number; viaGateway: boolean; label: string }>;
}

export class ResultsSidebar {
  private el: HTMLElement;
  private headerEl: HTMLElement;
  private cxToggleEl: HTMLElement;
  private headerRowEl: HTMLElement;
  private bodyEl: HTMLElement;
  private renderer: MapRenderer | null = null;

  // First CX code alphabetically once stations load — typically AI1.
  // Initialised in init() so it survives a full filter refresh cycle.
  private cxTarget: string = "";
  private sortKey: SortKey = "factor";
  private sortDir: SortDir = "desc";
  private rows: Row[] = [];

  // ComexCode list, computed once after CX stations load.
  private cxCodes: string[] = [];

  constructor() {
    this.el = document.createElement("aside");
    this.el.id = "results-sidebar";

    this.headerEl = document.createElement("div");
    this.headerEl.className = "sidebar-header";

    this.cxToggleEl = document.createElement("div");
    this.cxToggleEl.className = "sidebar-cx-toggle";

    this.headerRowEl = document.createElement("div");
    this.headerRowEl.className = "sidebar-table-header";

    this.bodyEl = document.createElement("div");
    this.bodyEl.className = "sidebar-table-body";

    this.el.appendChild(this.headerEl);
    this.el.appendChild(this.cxToggleEl);
    this.el.appendChild(this.headerRowEl);
    this.el.appendChild(this.bodyEl);

    document.body.appendChild(this.el);
  }

  init(renderer: MapRenderer): void {
    this.renderer = renderer;

    // CX toggle row depends on CX stations being loaded; deferred until ready.
    const setupCx = (): void => {
      this.cxCodes = getAllCxStations()
        .map((cx) => cx.ComexCode)
        .sort();
      // Default target = first available CX (AI1 typically) — there is no
      // "Nearest" mode, since per-row mixed labels confused readers.
      if (!this.cxTarget && this.cxCodes.length > 0) {
        this.cxTarget = this.cxCodes[0]!;
      }
      this.renderCxToggle();
    };

    if (isResourceIndexReady()) {
      setupCx();
      this.refresh();
    } else {
      onResourceIndexReady(() => {
        setupCx();
        this.refresh();
      });
    }

    onResourceFilterChange(() => this.refresh());
  }

  getElement(): HTMLElement {
    return this.el;
  }

  /** Recompute rows from current filter state and re-render. */
  refresh(): void {
    const ids = getResourceFilters();
    if (ids.length === 0 || !isResourceIndexReady()) {
      this.hide();
      return;
    }
    this.rows = this.buildRows(ids);
    this.renderHeader(ids);
    this.renderHeaderRow();
    this.renderBody();
    this.show();
  }

  private buildRows(materialIds: readonly string[]): Row[] {
    const contributions = getResourceContributions(materialIds);

    // Cache per-system CX distances so we don't recompute for every row
    // (a system with N matching planets calls getCxDistances once).
    const cxBySystem = new Map<string, Map<string, { jumps: number; viaGateway: boolean; label: string }>>();

    const rows: Row[] = [];
    for (const c of contributions) {
      const sys = getSystemById(c.systemId);
      if (!sys) continue;

      let cxJumps = cxBySystem.get(c.systemId);
      if (!cxJumps) {
        cxJumps = new Map();
        for (const e of getCxDistances(c.systemId)) {
          cxJumps.set(e.code, { jumps: e.jumps, viaGateway: e.viaGateway, label: e.label });
        }
        cxBySystem.set(c.systemId, cxJumps);
      }

      rows.push({
        planetName: getPlanetDisplayName(c.planetNaturalId),
        planetNaturalId: c.planetNaturalId,
        systemId: c.systemId,
        systemName: sys.name,
        systemNaturalId: sys.naturalId,
        ticker: getMaterialTicker(c.materialId),
        factor: c.factor,
        bases: getPlanetBaseCount(c.planetNaturalId),
        cxJumps,
      });
    }
    return rows;
  }

  private renderHeader(materialIds: readonly string[]): void {
    const tickers = materialIds.map((id) => {
      const tkr = getMaterialTicker(id);
      const name = getMaterialByTicker(tkr)?.Name ?? tkr;
      return { tkr, name };
    });
    const tickerList = tickers.map((t) => t.tkr).join(" + ");
    const subtitle = tickers.length === 1
      ? formatCamelCase(tickers[0]!.name)
      : `${tickers.length} resources`;

    this.headerEl.innerHTML = `
      <div class="sidebar-title">${esc(tickerList)}</div>
      <div class="sidebar-subtitle">${esc(subtitle)} — ${this.rows.length} ${this.rows.length === 1 ? "result" : "results"}</div>
    `;
  }

  private renderCxToggle(): void {
    const buttons = this.cxCodes.map((code) => this.cxButton(code, code));
    this.cxToggleEl.innerHTML = `
      <span class="sidebar-cx-label">CX DIST</span>
      <div class="sidebar-cx-buttons">${buttons.join("")}</div>
    `;

    this.cxToggleEl.querySelectorAll("[data-cx-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = (btn as HTMLElement).dataset["cxTarget"]!;
        this.cxTarget = target;
        // Re-render header row (active state) and body.
        this.cxToggleEl.querySelectorAll("[data-cx-target]").forEach((b) => {
          b.classList.toggle("active", (b as HTMLElement).dataset["cxTarget"] === target);
        });
        this.renderBody();
      });
    });
  }

  private cxButton(target: string, label: string): string {
    const cls = this.cxTarget === target ? "sidebar-cx-btn active" : "sidebar-cx-btn";
    return `<button class="${cls}" data-cx-target="${esc(target)}">${esc(label)}</button>`;
  }

  private renderHeaderRow(): void {
    const cols: { key: SortKey; label: string; cls: string }[] = [
      { key: "planet", label: "Planet", cls: "col-planet" },
      { key: "ticker", label: "Mat", cls: "col-ticker" },
      { key: "factor", label: "Factor", cls: "col-factor" },
      { key: "cx", label: "CX", cls: "col-cx" },
      { key: "bases", label: "Bases", cls: "col-bases" },
    ];
    this.headerRowEl.innerHTML = cols
      .map((c) => {
        const indicator = c.key === this.sortKey ? (this.sortDir === "asc" ? " ▲" : " ▼") : "";
        return `<button class="sidebar-col ${c.cls}" data-sort="${c.key}">${esc(c.label)}${indicator}</button>`;
      })
      .join("");

    this.headerRowEl.querySelectorAll("[data-sort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = (btn as HTMLElement).dataset["sort"] as SortKey;
        if (key === this.sortKey) {
          this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
        } else {
          this.sortKey = key;
          // Sensible defaults: numerics descend, names ascend, cx ascends (closer first).
          this.sortDir = key === "planet" || key === "ticker" || key === "cx" ? "asc" : "desc";
        }
        this.renderHeaderRow();
        this.renderBody();
      });
    });
  }

  private renderBody(): void {
    const sorted = [...this.rows].sort((a, b) => this.compare(a, b));

    // Factor heat-map: red (worst) → yellow → green (best), relative to the
    // current row set. Recomputed every render so it tracks the active filter.
    let minF = Infinity;
    let maxF = -Infinity;
    for (const r of sorted) {
      if (r.factor < minF) minF = r.factor;
      if (r.factor > maxF) maxF = r.factor;
    }
    const range = maxF - minF;

    const html = sorted
      .map((r) => {
        const cxText = this.cxCellHtml(r);
        const pct = Math.round(r.factor * 100);
        const basesText = r.bases > 0 ? String(r.bases) : "";

        const t = range > 0 ? (r.factor - minF) / range : 0.5; // 0 = worst, 1 = best
        const hue = Math.round(t * 120); // 0 = red, 60 = yellow, 120 = green
        const factorStyle = `style="color: hsl(${hue}, 70%, 60%)"`;

        return `
          <div class="sidebar-row" data-system-id="${esc(r.systemId)}" data-planet-natural="${esc(r.planetNaturalId)}">
            <div class="col-planet">
              <span class="sidebar-planet-name">${esc(r.planetName)}</span>
              <span class="sidebar-planet-system">${esc(r.systemNaturalId)} · ${esc(r.systemName)}</span>
            </div>
            <div class="col-ticker">${esc(r.ticker)}</div>
            <div class="col-factor" ${factorStyle}>${pct}%</div>
            <div class="col-cx">${cxText}</div>
            <div class="col-bases">${esc(basesText)}</div>
          </div>
        `;
      })
      .join("");
    this.bodyEl.innerHTML = html || `<div class="sidebar-empty">No matches</div>`;

    this.bodyEl.querySelectorAll(".sidebar-row").forEach((row) => {
      row.addEventListener("click", () => {
        const sysId = (row as HTMLElement).dataset["systemId"]!;
        const planetNat = (row as HTMLElement).dataset["planetNatural"]!;
        this.navigateToPlanet(sysId, planetNat);
      });
    });
  }

  private compare(a: Row, b: Row): number {
    const dir = this.sortDir === "asc" ? 1 : -1;
    switch (this.sortKey) {
      case "planet":
        return a.planetName.localeCompare(b.planetName) * dir;
      case "ticker":
        return a.ticker.localeCompare(b.ticker) * dir;
      case "factor":
        return (a.factor - b.factor) * dir;
      case "bases":
        return (a.bases - b.bases) * dir;
      case "cx": {
        const aj = this.cxJumpsForSort(a);
        const bj = this.cxJumpsForSort(b);
        // Unreachable rows always sort to the end regardless of direction.
        if (aj === bj) return 0;
        if (aj === Infinity) return 1;
        if (bj === Infinity) return -1;
        return (aj - bj) * dir;
      }
    }
  }

  private cxCellHtml(r: Row): string {
    const e = r.cxJumps.get(this.cxTarget);
    if (!e || e.jumps < 0) return `<span class="sidebar-cx-unreachable">—</span>`;
    return `${e.jumps}`;
  }

  private cxJumpsForSort(r: Row): number {
    const e = r.cxJumps.get(this.cxTarget);
    return e && e.jumps >= 0 ? e.jumps : Infinity;
  }

  private navigateToPlanet(systemId: string, planetNaturalId: string): void {
    if (!this.renderer) return;
    // panToPlanet handles the galaxy → system zoom and selects the planet
    // after the planet data loads. PanelManager accepts naturalId or UUID
    // for the selected planet, so we don't need to look up the FIO id.
    this.renderer.panToPlanet(systemId, planetNaturalId);
  }

  show(): void {
    this.el.classList.add("sidebar-open");
  }

  hide(): void {
    this.el.classList.remove("sidebar-open");
  }
}

function esc(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatCamelCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}
