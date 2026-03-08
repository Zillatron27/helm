import { search } from "../../data/searchIndex.js";
import { findRoute } from "../../data/pathfinding.js";
import {
  setActiveRoute,
  setSearchFocused,
  setSelectedEntity,
  setFocusedSystem,
  setViewLevel,
  getViewLevel,
} from "../state.js";
import type { MapRenderer } from "../../renderer/MapRenderer.js";
import type { SearchEntry } from "../../types/index.js";

const DEBOUNCE_MS = 50;

const ROUTE_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <circle cx="5" cy="5" r="3"/>
  <circle cx="19" cy="19" r="3"/>
  <line x1="8" y1="8" x2="16" y2="16"/>
</svg>`;

interface RouteField {
  inputEl: HTMLInputElement;
  suggestionsEl: HTMLElement;
  results: SearchEntry[];
  activeIndex: number;
  selectedId: string | null;
  selectedLabel: string;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

export class RoutePanel {
  private rowEl: HTMLElement;
  private expandEl: HTMLElement;
  private btnEl: HTMLButtonElement;
  private panelContent: HTMLElement;
  private infoEl: HTMLElement;
  private fromField: RouteField;
  private toField: RouteField;
  private expanded = false;
  private renderer: MapRenderer | null = null;

  constructor() {
    // Toolbar row: [expand panel] [button]
    this.rowEl = document.createElement("div");
    this.rowEl.className = "toolbar-row";

    // Expandable panel (left of button)
    this.expandEl = document.createElement("div");
    this.expandEl.className = "toolbar-expand toolbar-expand-route";

    // Panel content inside expand
    this.panelContent = document.createElement("div");
    this.panelContent.className = "route-panel-content";

    // From field
    this.fromField = this.createField("From");
    // To field
    this.toField = this.createField("To");

    // Info line
    this.infoEl = document.createElement("div");
    this.infoEl.className = "route-info";

    // Clear button
    const clearBtn = document.createElement("button");
    clearBtn.className = "route-clear";
    clearBtn.textContent = "Clear Route";
    clearBtn.addEventListener("click", () => this.clearRoute());

    this.panelContent.appendChild(this.fromField.inputEl.parentElement!);
    this.panelContent.appendChild(this.toField.inputEl.parentElement!);
    this.panelContent.appendChild(this.infoEl);
    this.panelContent.appendChild(clearBtn);

    this.expandEl.appendChild(this.panelContent);

    // Circular button (right)
    this.btnEl = document.createElement("button");
    this.btnEl.className = "toolbar-btn";
    this.btnEl.innerHTML = ROUTE_ICON_SVG;
    this.btnEl.addEventListener("click", () => this.toggleExpand());

    this.rowEl.appendChild(this.expandEl);
    this.rowEl.appendChild(this.btnEl);
  }

  getElement(): HTMLElement {
    return this.rowEl;
  }

  init(renderer: MapRenderer): void {
    this.renderer = renderer;
  }

  private toggleExpand(): void {
    if (this.expanded) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  private expand(): void {
    this.expanded = true;
    this.expandEl.classList.add("toolbar-expand-open");
    this.btnEl.classList.add("toolbar-btn-active");
  }

  private collapse(): void {
    this.expanded = false;
    this.expandEl.classList.remove("toolbar-expand-open");
    this.btnEl.classList.remove("toolbar-btn-active");
    this.clearRoute();
  }

  private createField(label: string): RouteField {
    const wrapper = document.createElement("div");
    wrapper.className = "route-field";

    const labelEl = document.createElement("div");
    labelEl.className = "route-label";
    labelEl.textContent = label;

    const inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.className = "route-input";
    inputEl.placeholder = `${label} system...`;
    inputEl.autocomplete = "off";
    inputEl.spellcheck = false;

    const suggestionsEl = document.createElement("div");
    suggestionsEl.className = "route-suggestions";

    wrapper.appendChild(labelEl);
    wrapper.appendChild(inputEl);
    wrapper.appendChild(suggestionsEl);

    const field: RouteField = {
      inputEl,
      suggestionsEl,
      results: [],
      activeIndex: -1,
      selectedId: null,
      selectedLabel: "",
      debounceTimer: null,
    };

    inputEl.addEventListener("input", () => this.onFieldInput(field));
    inputEl.addEventListener("focus", () => {
      setSearchFocused(true);
      // If user clears a selection and types again, reset selectedId
      if (field.selectedId && inputEl.value !== field.selectedLabel) {
        field.selectedId = null;
      }
      if (inputEl.value && !field.selectedId) {
        this.runFieldSearch(field);
      }
    });
    inputEl.addEventListener("blur", () => {
      setSearchFocused(false);
      setTimeout(() => this.hideFieldSuggestions(field), 150);
    });
    inputEl.addEventListener("keydown", (e) => this.onFieldKeyDown(e, field));

    return field;
  }

  private onFieldInput(field: RouteField): void {
    // User typing clears previous selection
    if (field.selectedId) {
      field.selectedId = null;
    }
    if (field.debounceTimer !== null) {
      clearTimeout(field.debounceTimer);
    }
    field.debounceTimer = setTimeout(() => {
      this.runFieldSearch(field);
    }, DEBOUNCE_MS);
  }

  private onFieldKeyDown(e: KeyboardEvent, field: RouteField): void {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.moveFieldSelection(field, 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.moveFieldSelection(field, -1);
        break;
      case "Enter":
        e.preventDefault();
        if (field.activeIndex >= 0 && field.activeIndex < field.results.length) {
          this.selectFieldResult(field, field.results[field.activeIndex]!);
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        this.hideFieldSuggestions(field);
        field.inputEl.blur();
        break;
    }
  }

  private runFieldSearch(field: RouteField): void {
    const query = field.inputEl.value.trim();
    if (!query) {
      field.results = [];
      this.hideFieldSuggestions(field);
      return;
    }

    // Filter to systems only
    field.results = search(query, 8).filter((e) => e.type === "system");
    field.activeIndex = field.results.length > 0 ? 0 : -1;
    this.renderFieldSuggestions(field);
  }

  private renderFieldSuggestions(field: RouteField): void {
    if (field.results.length === 0) {
      this.hideFieldSuggestions(field);
      return;
    }

    field.suggestionsEl.innerHTML = field.results
      .map((r, i) => {
        const activeClass = i === field.activeIndex ? " search-result-active" : "";
        return `<div class="search-result${activeClass}" data-index="${i}">
          <span class="search-result-name">${esc(r.name)}</span>
          <span class="search-result-meta">
            <span class="search-result-id">${esc(r.naturalId)}</span>
          </span>
        </div>`;
      })
      .join("");

    field.suggestionsEl.classList.add("route-suggestions-open");

    field.suggestionsEl.querySelectorAll(".search-result").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const idx = parseInt((el as HTMLElement).dataset["index"] ?? "-1", 10);
        if (idx >= 0 && idx < field.results.length) {
          this.selectFieldResult(field, field.results[idx]!);
        }
      });
    });
  }

  private hideFieldSuggestions(field: RouteField): void {
    field.suggestionsEl.classList.remove("route-suggestions-open");
    field.suggestionsEl.innerHTML = "";
    field.results = [];
    field.activeIndex = -1;
  }

  private moveFieldSelection(field: RouteField, delta: number): void {
    if (field.results.length === 0) return;
    field.activeIndex = Math.max(
      0,
      Math.min(field.results.length - 1, field.activeIndex + delta)
    );
    field.suggestionsEl.querySelectorAll(".search-result").forEach((el, i) => {
      el.classList.toggle("search-result-active", i === field.activeIndex);
    });
  }

  private selectFieldResult(field: RouteField, entry: SearchEntry): void {
    field.selectedId = entry.systemId;
    field.selectedLabel = `${entry.name} (${entry.naturalId})`;
    field.inputEl.value = field.selectedLabel;
    this.hideFieldSuggestions(field);

    this.tryCalculateRoute();
  }

  private tryCalculateRoute(): void {
    const fromId = this.fromField.selectedId;
    const toId = this.toField.selectedId;

    if (!fromId || !toId) {
      this.infoEl.textContent = "";
      return;
    }

    // Exit system view if active
    if (getViewLevel() === "system") {
      setSelectedEntity(null);
      setFocusedSystem(null);
      setViewLevel("galaxy");
    }

    const route = findRoute(fromId, toId);
    if (route) {
      setActiveRoute(route);
      const jumpWord = route.jumpCount === 1 ? "jump" : "jumps";
      this.infoEl.innerHTML = `<span class="route-info-jumps">${route.jumpCount} ${jumpWord}</span>`;

      // Frame the route on the map after a brief delay for system view exit
      setTimeout(() => {
        this.renderer?.frameRoute(route.systemIds);
      }, 150);
    } else {
      setActiveRoute(null);
      this.infoEl.textContent = "No route found";
    }
  }

  private clearRoute(): void {
    this.fromField.selectedId = null;
    this.fromField.inputEl.value = "";
    this.toField.selectedId = null;
    this.toField.inputEl.value = "";
    this.infoEl.textContent = "";
    setActiveRoute(null);
  }
}

function esc(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
