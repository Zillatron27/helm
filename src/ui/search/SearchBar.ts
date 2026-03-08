import { search } from "../../data/searchIndex.js";
import { setSearchFocused, setSelectedEntity } from "../state.js";
import type { SearchEntry } from "../../types/index.js";
import type { MapRenderer } from "../../renderer/MapRenderer.js";

const DEBOUNCE_MS = 50;

// SVG magnifying glass icon
const SEARCH_ICON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

export class SearchBar {
  private rowEl: HTMLElement;
  private buttonEl: HTMLButtonElement;
  private expandedEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private dropdownEl: HTMLElement;
  private renderer: MapRenderer | null = null;
  private results: SearchEntry[] = [];
  private activeIndex = -1;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private expanded = false;

  constructor() {
    // Row container — holds expanded field + icon button
    this.rowEl = document.createElement("div");
    this.rowEl.className = "toolbar-row";

    // Expanded search field (hidden by default)
    this.expandedEl = document.createElement("div");
    this.expandedEl.className = "toolbar-expand toolbar-expand-search";

    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.className = "search-input";
    this.inputEl.placeholder = "Search systems or planets...";
    this.inputEl.autocomplete = "off";
    this.inputEl.spellcheck = false;

    this.expandedEl.appendChild(this.inputEl);

    // Dropdown
    this.dropdownEl = document.createElement("div");
    this.dropdownEl.className = "search-dropdown";
    this.expandedEl.appendChild(this.dropdownEl);

    // Icon button
    this.buttonEl = document.createElement("button");
    this.buttonEl.className = "toolbar-btn";
    this.buttonEl.innerHTML = SEARCH_ICON_SVG;
    this.buttonEl.title = "Search (/)";
    this.buttonEl.addEventListener("click", () => this.toggleExpand());

    this.rowEl.appendChild(this.expandedEl);
    this.rowEl.appendChild(this.buttonEl);

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
    this.expandedEl.classList.add("toolbar-expand-open");
    this.buttonEl.classList.add("toolbar-btn-active");
    // Focus after transition
    setTimeout(() => this.inputEl.focus(), 50);
  }

  private collapse(): void {
    this.expanded = false;
    this.expandedEl.classList.remove("toolbar-expand-open");
    this.buttonEl.classList.remove("toolbar-btn-active");
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
      this.hideDropdown();
      // Collapse if input is empty
      if (!this.inputEl.value) {
        this.collapse();
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
      el.