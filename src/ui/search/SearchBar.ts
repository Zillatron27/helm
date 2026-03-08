import { search } from "../../data/searchIndex.js";
import { setSearchFocused, setSelectedEntity } from "../state.js";
import type { SearchEntry } from "../../types/index.js";
import type { MapRenderer } from "../../renderer/MapRenderer.js";

const DEBOUNCE_MS = 50;

const SEARCH_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <circle cx="10" cy="10" r="7"/>
  <line x1="15.5" y1="15.5" x2="21" y2="21"/>
</svg>`;

export class SearchBar {
  private rowEl: HTMLElement;
  private expandEl: HTMLElement;
  private btnEl: HTMLButtonElement;
  private inputEl: HTMLInputElement;
  private dropdownEl: HTMLElement;
  private renderer: MapRenderer | null = null;
  private results: SearchEntry[] = [];
  private activeIndex = -1;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private expanded = false;

  constructor() {
    // Toolbar row: [expand panel] [button]
    this.rowEl = document.createElement("div");
    this.rowEl.className = "toolbar-row";

    // Expandable panel (left of button)
    this.expandEl = document.createElement("div");
    this.expandEl.className = "toolbar-expand toolbar-expand-search";

    // Search bar wrapper inside expand panel
    const bar = document.createElement("div");
    bar.className = "search-bar";

    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.className = "search-input";
    this.inputEl.placeholder = "Search systems or planets...";
    this.inputEl.autocomplete = "off";
    this.inputEl.spellcheck = false;

    bar.appendChild(this.inputEl);

    // Dropdown inside expand panel
    this.dropdownEl = document.createElement("div");
    this.dropdownEl.className = "search-dropdown";

    this.expandEl.appendChild(bar);
    this.expandEl.appendChild(this.dropdownEl);

    // Circular button (right)
    this.btnEl = document.createElement("button");
    this.btnEl.className = "toolbar-btn";
    this.btnEl.innerHTML = SEARCH_ICON_SVG;
    this.btnEl.addEventListener("click", () => this.toggleExpand());

    this.rowEl.appendChild(this.expandEl);
    this.rowEl.appendChild(this.btnEl);

    this.bindEvents();
  }

  getElement(): HTMLElement {
    return this.rowEl;
  }

  init(renderer: MapRenderer): void {
    this.renderer = renderer;
  }

  focus(): void {
    if (!this.expanded) {
      this.expand();
    }
    this.inputEl.focus();
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
    // Focus input after CSS transition
    setTimeout(() => this.inputEl.focus(), 260);
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
    this.inputEl.addEventListener("focus", () => this.onFocus());
    this.inputEl.addEventListener("blur", () => this.onBlur());
    this.inputEl.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  private onInput(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.runSearch();
    }, DEBOUNCE_MS);
  }

  private onFocus(): void {
    setSearchFocused(true);
    if (this.inputEl.value) {
      this.runSearch();
    }
  }

  private onBlur(): void {
    setSearchFocused(false);
    // Delay hide so mousedown on results fires first
    setTimeout(() => {
      if (!this.inputEl.value) {
        this.collapse();
      } else {
        this.hideDropdown();
      }
    }, 150);
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
      case "Tab":
        if (this.activeIndex >= 0 && this.activeIndex < this.results.length) {
          e.preventDefault();
          this.selectResult(this.results[this.activeIndex]!);
        }
        break;
      case "Enter":
        e.preventDefault();
        if (this.activeIndex >= 0 && this.activeIndex < this.results.length) {
          this.selectResult(this.results[this.activeIndex]!);
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

  private runSearch(): void {
    const query = this.inputEl.value.trim();
    if (!query) {
      this.results = [];
      this.hideDropdown();
      return;
    }

    this.results = search(query);
    this.activeIndex = this.results.length > 0 ? 0 : -1;
    this.renderDropdown();
  }

  private renderDropdown(): void {
    if (this.results.length === 0) {
      this.hideDropdown();
      return;
    }

    this.dropdownEl.innerHTML = this.results
      .map((r, i) => {
        const activeClass = i === this.activeIndex ? " search-result-active" : "";
        const typeClass =
          r.type === "system"
            ? "search-result-type-system"
            : "search-result-type-planet";
        return `<div class="search-result${activeClass}" data-index="${i}">
          <span class="search-result-name">${esc(r.name || r.naturalId)}</span>
          <span class="search-result-meta">
            <span class="search-result-id">${esc(r.naturalId)}</span>
            <span class="search-result-type ${typeClass}">${r.type}</span>
          </span>
        </div>`;
      })
      .join("");

    this.dropdownEl.classList.add("search-dropdown-open");

    // Bind mousedown (not click) to fire before blur
    this.dropdownEl.querySelectorAll(".search-result").forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const idx = parseInt((el as HTMLElement).dataset["index"] ?? "-1", 10);
        if (idx >= 0 && idx < this.results.length) {
          this.selectResult(this.results[idx]!);
        }
      });
    });
  }

  private hideDropdown(): void {
    this.dropdownEl.classList.remove("search-dropdown-open");
    this.dropdownEl.innerHTML = "";
    this.results = [];
    this.activeIndex = -1;
  }

  private moveSelection(delta: number): void {
    if (this.results.length === 0) return;
    this.activeIndex = Math.max(
      0,
      Math.min(this.results.length - 1, this.activeIndex + delta)
    );
    // Update active highlight without full re-render
    this.dropdownEl.querySelectorAll(".search-result").forEach((el, i) => {
      el.classList.toggle("search-result-active", i === this.activeIndex);
    });
  }

  private selectResult(entry: SearchEntry): void {
    this.inputEl.value = "";
    this.hideDropdown();
    this.collapse();
    this.inputEl.blur();

    // Navigate camera to parent system and select it
    setSelectedEntity({ type: "system", id: entry.systemId });
    this.renderer?.panToSystem(entry.systemId);
  }
}

function esc(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
