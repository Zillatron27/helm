import {
  getResourceFilters,
  setSelectedEntity,
  setFocusedSystem,
  setViewLevel,
  getViewLevel,
  onResourceFilterChange,
} from "../state.js";
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
  planetId: string; // resolved later if available; fallback to natural id
  systemId: string;
  systemName: string;
  systemNaturalId: string;
  ticker: string;
  factor: number;
  bases: number;
  // Distance to each CX (by ComexCode). -1 = unreachable.
  cxJumps: Map<string, { jumps: number; viaGateway: boolean; label: string }>;
  // Pre-computed nearest CX (or null if unreachable from any).
  nearestCx: { code: string; label: string; jumps: number; viaGateway: boolean } | null;
}

const CX_TARGET_NEAREST = "__nearest__";

export class ResultsSidebar {
  private el: HTMLElement;
  private headerEl: HTMLElement;
  private cxToggleEl: HTMLElement;
  private headerRowEl: HTMLElement;
  private bodyEl: HTMLElement;
  private renderer: MapRenderer | null = null;

  private cxTarget: string = CX_TARGET_NEAREST;
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

    // Cache per-system CX distances so we don't recompute for every row.
    const cxBySystem = new Map<string, Map<string, { jumps: number; viaGateway: boolean; label: string }>>();
    const nearestBySystem = new Map<string, Row["nearestCx"]>();

    const rows: Row[] = [];
    for (const c of contributions) {
      const sys = getSystemById(c.systemId);
      if (!sys) continue;

      let cxJumps = cxBySystem.get(c.systemId);
      let nearestCx: Row["nearestCx"] = nearestBySystem.get(c.systemId) ?? null;
      if (!cxJumps) {
        cxJumps = new Map();
        const entries = getCxDistances(c.systemId); // already sorted asc by jumps, unreachable last
        for (const e of entries) {
          cxJumps.set(e.code, { jumps: e.jumps, viaGateway: e.viaGateway, label: e.label });
        }
        cxBySystem.set(c.systemId, cxJumps);
        // First reachable entry = nearest.
        const reachable = entries.find((e) => e.jumps >= 0);
        nearestCx = reachable
          ? { code: reachable.code, label: reachable.label, jumps: reachable.jumps, viaGateway: reachable.viaGateway }
          : null;
        nearestBySystem.set(c.systemId, nearestCx);
      }

      const tkr = getMaterialTicker(c.materialId);

      rows.push({
        planetName: getPlanetDisplayName(c.planetNaturalId),
        planetNaturalId: c.planetNaturalId,
        planetId: c.planetNaturalId, // panToPlanet expects FIO planet id; we don't have it here
        systemId: c.systemId,
        systemName: sys.name,
        systemNaturalId: sys.naturalId,
        ticker: tkr,
        factor: c.factor,
        bases: getPlanetBaseCount(c.planetNaturalId),
        cxJumps,
        nearestCx,
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
    const buttons: string[] = [];
    buttons.push(this.cxButton(CX_TARGET_NEAREST, "Nearest"));
    for (const code of this.cxCodes) {
      buttons.push(this.cxButton(code, code));
    }
    this.cxToggleEl.innerHTML = `
      <span class="sidebar-cx-label">CX</span>
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
    const html = sorted
      .map((r) => {
        const cxText = this.cxCellHtml(r);
        const pct = Math.round(r.factor * 100);
        const basesText = r.bases > 0 ? String(r.bases) : "";
        return `
          <div class="sidebar-row" data-system-id="${esc(r.systemId)}" data-planet-natural="${esc(r.planetNaturalId)}">
            <div class="col-planet">
              <span class="sidebar-planet-name">${esc(r.planetName)}</span>
              <span class="sidebar-planet-system">${esc(r.systemNaturalId)} · ${esc(r.systemName)}</span>
            </div>
            <div class="col-ticker">${esc(r.ticker)}</div>
            <div class="col-factor">${pct}%</div>
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
        this.navigateToSystem(sysId);
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
    const unreachable = `<span class="sidebar-cx-unreachable">—</span>`;
    if (this.cxTarget === CX_TARGET_NEAREST) {
      if (!r.nearestCx) return unreachable;
      const gw = r.nearestCx.viaGateway ? " ⬡" : "";
      return `${esc(r.nearestCx.label)} ${r.nearestCx.jumps}j${gw}`;
    }
    const e = r.cxJumps.get(this.cxTarget);
    if (!e || e.jumps < 0) return unreachable;
    const gw = e.viaGateway ? " ⬡" : "";
    return `${esc(e.label)} ${e.jumps}j${gw}`;
  }

  private cxJumpsForSort(r: Row): number {
    if (this.cxTarget === CX_TARGET_NEAREST) {
      return r.nearestCx ? r.nearestCx.jumps : Infinity;
    }
    const e = r.cxJumps.get(this.cxTarget);
    return e && e.jumps >= 0 ? e.jumps : Infinity;
  }

  private navigateToSystem(systemId: string): void {
    if (!this.renderer) return;
    const view = getViewLevel();
    if (view === "system") {
      // Zoom out first so the pan happens on the galaxy view, matching
      // PanelManager.navigateToSystem's pattern.
      setSelectedEntity(null);
      setFocusedSystem(null);
      setViewLevel("galaxy");
      setTimeout(() => {
        this.renderer?.panToSystem(systemId);
        setSelectedEntity({ type: "system", id: systemId });
      }, 850);
    } else {
      this.renderer.panToSystem(systemId);
      setSelectedEntity({ type: "system", id: systemId });
    }
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
