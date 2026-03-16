import type { FioMaterial } from "../../types/index.js";
import { getAllMaterials, getMaterialTicker } from "../../data/cache.js";
import {
  isResourceIndexReady,
  onResourceIndexReady,
  getExtractableResourceMaterialIds,
} from "../../data/resourceIndex.js";
import { getResourceFilter, setResourceFilter } from "../state.js";
import { getTheme } from "../theme.js";
import { createMiniLoader } from "../loader/LoaderAnimation.js";

const DEBOUNCE_MS = 50;

const FILTER_ICON_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
</svg>`;

export class ResourcePicker {
  private rowEl: HTMLElement;
  private expandEl: HTMLElement;
  private btnEl: HTMLButtonElement;
  private inputEl: HTMLInputElement;
  private dropdownEl: HTMLElement;
  private badgeEl: HTMLElement | null = null;
  private filteredMaterials: FioMaterial[] = [];
  private activeIndex = -1;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private expanded = false;

  constructor() {
    // Toolbar row: [expand panel] [button]
    this.rowEl = document.createElement("div");
    this.rowEl.className = "toolbar-row";
    this.rowEl.style.flexWrap = "wrap";
    this.rowEl.style.justifyContent = "flex-end";

    // Expandable panel (left of button)
    this.expandEl = document.createElement("div");
    this.expandEl.className = "toolbar-expand toolbar-expand-resource";

    // Search input wrapper
    const bar = document.createElement("div");
    bar.className = "search-bar";

    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.className = "resource-input";
    this.inputEl.placeholder = "Search resources...";
    this.inputEl.autocomplete = "off";
    this.inputEl.spellcheck = false;

    bar.appendChild(this.inputEl);

    // Dropdown
    this.dropdownEl = document.createElement("div");
    this.dropdownEl.className = "resource-dropdown";

    this.expandEl.appendChild(bar);
    this.expandEl.appendChild(this.dropdownEl);

    // Button — starts with mini loader, swaps to icon when index ready
    this.btnEl = document.createElement("button");
    this.btnEl.className = "toolbar-btn toolbar-btn-resource-disabled";
    this.btnEl.title = "Resource filter (R) — loading...";

    // Show mini solar system spinner while index builds
    if (!isResourceIndexReady()) {
      const miniLoader = createMiniLoader(getTheme());
      miniLoader.style.pointerEvents = "none";
      this.btnEl.appendChild(miniLoader);
    } else {
      this.btnEl.innerHTML = FILTER_ICON_SVG;
      this.btnEl.classList.remove("toolbar-btn-resource-disabled");
    }

    this.btnEl.addEventListener("click", () => this.handleButtonClick());

    this.rowEl.appendChild(this.expandEl);
    this.rowEl.appendChild(this.btnEl);

    this.bindEvents();

    // Swap spinner for icon when resource index is ready
    onResourceIndexReady(() => {
      this.btnEl.innerHTML = FILTER_ICON_SVG;
      this.btnEl.title = "Resource filter (R)";
      this.btnEl.classList.remove("toolbar-btn-resource-disabled");
    });
  }

  getElement(): HTMLElement {
    return this.rowEl;
  }

  /** Toggle picker open/closed, or clear filter if active and picker closed. */
  toggle(): void {
    this.handleButtonClick();
  }

  private handleButtonClick(): void {
    if (!isResourceIndexReady()) return;

    if (this.expanded) {
      this.collapse();
    } else if (getResourceFilter() !== null) {
      // Filter active but picker closed — clear the filter
      setResourceFilter(null);
      this.removeBadge();
    } else {
      this.expand();
    }
  }

  private expand(): void {
    this.expanded = true;
    this.expandEl.classList.add("toolbar-expand-open");
    this.btnEl.classList.add("toolbar-btn-active");
    setTimeout(() => {
      this.inputEl.focus();
      // Show all extractable resources initially
      this.showAllResources();
    }, 260);
  }

  private collapse(): void {
    this.expanded = false;
    this.expandEl.classList.remove("toolbar-expand-open");
    this.btnEl.classList.remove("toolbar-btn-active");
    this.inputEl.value = "";
    this.hideDropdown();
  }

  private bindEvents(): void {
    this.inputEl.addEventListener("input", () => this.onInput());
    this.inputEl.addEventListener("focus", () => {
      if (!this.inputEl.value) {
        this.showAllResources();
      }
    });
    this.inputEl.addEventListener("blur", () => {
      setTimeout(() => {
        if (!this.inputEl.value && !getResourceFilter()) {
          this.collapse();
        } else {
          this.hideDropdown();
        }
      }, 150);
    });
    this.inputEl.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  private onInput(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.runSearch(), DEBOUNCE_MS);
  }

  private onKeyDown(e: KeyboardEvent): void {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.moveSelection(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        this.moveSelection(-1);
        break;
      case "Enter":
        e.preventDefault();
        if (this.activeIndex >= 0 && this.activeIndex < this.filteredMaterials.length) {
          this.selectMaterial(this.filteredMaterials[this.activeIndex]!);
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        this.collapse();
        this.inputEl.blur();
        break;
    }
  }

  private showAllResources(): void {
    if (!isResourceIndexReady()) return;
    const extractable = getExtractableResourceMaterialIds();
    this.filteredMaterials = getAllMaterials().filter((m) => extractable.has(m.MaterialId));
    this.activeIndex = this.filteredMaterials.length > 0 ? 0 : -1;
    this.renderDropdown();
  }

  private runSearch(): void {
    const query = this.inputEl.value.trim().toLowerCase();
    if (!query) {
      this.showAllResources();
      return;
    }

    if (!isResourceIndexReady()) return;
    const extractable = getExtractableResourceMaterialIds();
    this.filteredMaterials = getAllMaterials().filter((m) => {
      if (!extractable.has(m.MaterialId)) return false;
      return (
        m.Ticker.toLowerCase().includes(query) ||
        m.Name.toLowerCase().includes(query)
      );
    });
    this.activeIndex = this.filteredMaterials.length > 0 ? 0 : -1;
    this.renderDropdown();
  }

  private renderDropdown(): void {
    if (this.filteredMaterials.length === 0) {
      this.dropdownEl.innerHTML = "";
      this.dropdownEl.classList.remove("resource-dropdown-open");
      return;
    }

    // Group by category
    const grouped = new Map<string, FioMaterial[]>();
    for (const m of this.filteredMaterials) {
      const cat = m.CategoryName || "Other";
      let list = grouped.get(cat);
      if (!list) {
        list = [];
        grouped.set(cat, list);
      }
      list.push(m);
    }

    let html = "";
    let flatIndex = 0;
    for (const [category, materials] of grouped) {
      html += `<div class="resource-category">${esc(category)}</div>`;
      for (const m of materials) {
        const activeClass = flatIndex === this.activeIndex ? " resource-item-active" : "";
        html += `<div class="resource-item${activeClass}" data-index="${flatIndex}">
          <span class="resource-item-ticker">${esc(m.Ticker)}</span>
          <span class="resource-item-name">${esc(m.Name)}</span>
        </div>`;
        flatIndex++;
      }
    }

    this.dropdownEl.innerHTML = html;
    this.dropdownEl.classList.add("resource-dropdown-open");

    // Bind mousedown (not click) to fire before blur
    this.dropdownEl.querySelectorAll(".resource-item").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const idx = parseInt((el as HTMLElement).dataset["index"] ?? "-1", 10);
        if (idx >= 0 && idx < this.filteredMaterials.length) {
          this.selectMaterial(this.filteredMaterials[idx]!);
        }
      });
    });
  }

  private hideDropdown(): void {
    this.dropdownEl.classList.remove("resource-dropdown-open");
    this.dropdownEl.innerHTML = "";
    this.filteredMaterials = [];
    this.activeIndex = -1;
  }

  private moveSelection(delta: number): void {
    if (this.filteredMaterials.length === 0) return;
    this.activeIndex = Math.max(0, Math.min(this.filteredMaterials.length - 1, this.activeIndex + delta));
    this.dropdownEl.querySelectorAll(".resource-item").forEach((el, i) => {
      el.classList.toggle("resource-item-active", i === this.activeIndex);
    });
    // Scroll active item into view
    const activeEl = this.dropdownEl.querySelector(".resource-item-active");
    activeEl?.scrollIntoView({ block: "nearest" });
  }

  private selectMaterial(material: FioMaterial): void {
    this.inputEl.value = "";
    this.hideDropdown();
    this.collapse();
    this.inputEl.blur();

    setResourceFilter(material.MaterialId);
    this.showBadge(material.Ticker);
    this.btnEl.classList.add("toolbar-btn-resource-on");
  }

  private showBadge(ticker: string): void {
    this.removeBadge();

    const badge = document.createElement("div");
    badge.className = "resource-badge";
    badge.textContent = ticker;

    const clearBtn = document.createElement("button");
    clearBtn.className = "resource-badge-clear";
    clearBtn.textContent = "\u00d7";
    clearBtn.addEventListener("click", () => {
      setResourceFilter(null);
      this.removeBadge();
    });

    badge.appendChild(clearBtn);
    this.rowEl.appendChild(badge);
    this.badgeEl = badge;
  }

  private removeBadge(): void {
    if (this.badgeEl) {
      this.badgeEl.remove();
      this.badgeEl = null;
    }
    this.btnEl.classList.remove("toolbar-btn-resource-on");
  }

  /** Sync button state with external filter changes. */
  syncState(): void {
    const materialId = getResourceFilter();
    if (materialId) {
      const ticker = getMaterialTicker(materialId);
      if (!this.badgeEl) {
        this.showBadge(ticker);
      }
    } else {
      this.removeBadge();
    }
  }
}

function esc(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
