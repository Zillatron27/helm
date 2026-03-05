import { search } from "../../data/searchIndex.js";
import { setSearchFocused, setSelectedEntity } from "../state.js";
import type { SearchEntry } from "../../types/index.js";
import type { MapRenderer } from "../../renderer/MapRenderer.js";

const DEBOUNCE_MS = 50;

export class SearchBar {
  private containerEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private hintEl: HTMLElement;
  private dropdownEl: HTMLElement;
  private renderer: MapRenderer | null = null;
  private results: SearchEntry[] = [];
  private activeIndex = -1;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Container
    this.containerEl = document.createElement("div");
    this.containerEl.id = "search-container";

    // Search bar wrapper
    const bar = document.createElement("div");
    bar.className = "search-bar";

    // Input
    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.className = "search-input";
    this.inputEl.placeholder = "Search systems or planets...";
    this.inputEl.autocomplete = "off";
    this.inputEl.spellcheck = false;

    // Keyboard hint
    this.hintEl = document.createElement("kbd");
    this.hintEl.className = "search-hint";
    this.hintEl.textContent = "/";

    bar.appendChild(this.inputEl);
    bar.appendChild(this.hintEl);

    // Dropdown
    this.dropdownEl = document.createElement("div");
    this.dropdownEl.className = "search-dropdown";

    this.containerEl.appendChild(bar);
    this.containerEl.appendChild(this.dropdownEl);
    document.body.appendChild(this.containerEl);

    this.bindEvents();
  }

  init(renderer: MapRenderer): void {
    this.renderer = renderer;
  }

  focus(): void {
    this.inputEl.focus();
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
    this.hintEl.style.display = "none";
    if (this.inputEl.value) {
      this.runSearch();
    }
  }

  private onBlur(): void {
    setSearchFocused(false);
    this.hintEl.style.display = "";
    // Delay hide so mousedown on results fires first
    setTimeout(() => this.hideDropdown(), 150);
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
        this.inputEl.value = "";
        this.hideDropdown();
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
