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
  // filteredMaterials is rebuilt in grouped display order after every search
  private filteredMaterials: FioMaterial[] = [];
  private activeIndex = -1;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private expanded = false;
  private applyFilterAsync: ((materialId: string | null) => Promise<void>) | null = null;

  constructor() {
    // Toolbar row: [expand panel] [badge area] [button]
    this.rowEl = document.createElement("div");
    this.rowEl.className = "toolbar-row";

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

  /** Wire the async filter callback (called from main.ts after renderer is available). */
  setFilterCallback(fn: (materialId: string | null) => Promise<void>): void {
    this.applyFilterAsync = fn;
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
    const raw = getAllMaterials().filter((m) => extractable.has(m.MaterialId));
    this.buildGroupedList(raw);
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
    const raw = getAllMaterials().filter((m) => {
      if (!extractable.has(m.MaterialId)) return false;
      return (
        m.Ticker.toLowerCase().includes(query) ||
        m.Name.toLowerCase().includes(query)
      );
    });
    this.buildGroupedList(raw);
    this.renderDropdown();
  }

  /** Group materials by category and rebuild filteredMaterials in display order. */
  private buildGroupedList(raw: FioMaterial[]): void {
    const grouped = new Map<string, FioMaterial[]>();
    for (const m of raw) {
      const cat = m.CategoryName || "Other";
      let list = grouped.get(cat);
      if (!list) {
        list = [];
        grouped.set(cat, list);
      }
      list.push(m);
    }

    // Rebuild filteredMaterials in grouped display order so indices match
    this.filteredMaterials = [];
    for (const materials of grouped.values()) {
      for (const m of materials) {
        this.filteredMaterials.push(m);
      }
    }
    this.activeIndex = this.filteredMaterials.length > 0 ? 0 : -1;
  }

  private renderDropdown(): void {
    if (this.filteredMaterials.length === 0) {
      this.dropdownEl.innerHTML = "";
      this.dropdownEl.classList.remove("resource-dropdown-open");
      return;
    }

    // Group by category (already in grouped order)
    const grouped = new Map<string, Array<{ material: FioMaterial; index: number }>>();
    for (let i = 0; i < this.filteredMaterials.length; i++) {
      const m = this.filteredMaterials[i]!;
      const cat = m.CategoryName || "Other";
      let list = grouped.get(cat);
      if (!list) {
        list = [];
        grouped.set(cat, list);
      }
      list.push({ material: m, index: i });
    }

    let html = "";
    for (const [category, entries] of grouped) {
      html += `<div class="resource-category">${esc(category)}</div>`;
      for (const { material, index } of entries) {
        const activeClass = index === this.activeIndex ? " resource-item-active" : "";
        html += `<div class="resource-item${activeClass}" data-index="${index}">
          <span class="resource-item-ticker">${esc(material.Ticker)}</span>
          <span class="resource-item-name">${esc(material.Name)}</span>
        </div>`;
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
    const activeEl = this.dropdownEl.querySelector(".resource-item-active");
    activeEl?.scrollIntoView({ block: "nearest" });
  }

  private selectMaterial(material: FioMaterial): void {
    this.inputEl.value = "";
    this.hideDropdown();
    this.collapse();
    this.inputEl.blur();

    // Show spinner — the async filter yields between chunks so the spinner
    // stays animated throughout the multi-second computation.
    this.showButtonSpinner();

    // Set state first (lightweight — triggers panel update, badge)
    setResourceFilter(material.MaterialId);
    this.showBadge(material.Ticker);

    // Apply the heavy rendering work asynchronously (chunked with yields)
    if (this.applyFilterAsync) {
      this.applyFilterAsync(material.MaterialId).then(() => {
        this.restoreButtonIcon();
        this.btnEl.classList.add("toolbar-btn-resource-on");
      });
    } else {
      // Fallback: no async callback wired, restore immediately
      this.restoreButtonIcon();
      this.btnEl.classList.add("toolbar-btn-resource-on");
    }
  }

  private showButtonSpinner(): void {
    this.btnEl.innerHTML = "";
    const miniLoader = createMiniLoader(getTheme());
    miniLoader.style.pointerEvents = "none";
    this.btnEl.appendChild(miniLoader);
  }

  private restoreButtonIcon(): void {
    this.btnEl.innerHTML = FILTER_ICON_SVG;
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
    // Insert badge before the button (pops out to the left)
    this.rowEl.insertBefore(badge, this.btnEl);
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
