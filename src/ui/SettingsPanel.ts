import { themePresets } from "../themes/index.js";
import { getActiveThemeId, setTheme, onThemeChange } from "./theme.js";

const COG_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="3"/>
  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
</svg>`;

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

export class SettingsPanel {
  private rowEl: HTMLElement;
  private expandEl: HTMLElement;
  private btnEl: HTMLButtonElement;
  private optionEls: Map<string, HTMLElement> = new Map();
  private expanded = false;

  constructor() {
    this.rowEl = document.createElement("div");
    this.rowEl.className = "toolbar-row";

    // Expandable panel (left of button)
    this.expandEl = document.createElement("div");
    this.expandEl.className = "toolbar-expand toolbar-expand-settings";

    // Title
    const title = document.createElement("div");
    title.className = "settings-title";
    title.textContent = "Theme";
    this.expandEl.appendChild(title);

    // Theme options
    for (const preset of themePresets) {
      const option = document.createElement("button");
      option.className = "settings-theme-option";
      if (preset.id === getActiveThemeId()) {
        option.classList.add("settings-theme-option-active");
      }

      // Colour swatch — 4 dots previewing the theme
      const swatch = document.createElement("div");
      swatch.className = "settings-theme-swatch";

      const colours = [
        preset.tokens.bgPrimary,
        preset.tokens.accent,
        preset.tokens.spectral.G,
        preset.tokens.spectral.O,
      ];
      for (const colour of colours) {
        const dot = document.createElement("div");
        dot.className = "settings-theme-dot";
        dot.style.background = hexToCss(colour);
        swatch.appendChild(dot);
      }

      // Label
      const label = document.createElement("span");
      label.className = "settings-theme-label";
      label.textContent = preset.name;

      option.appendChild(swatch);
      option.appendChild(label);

      option.addEventListener("click", () => {
        setTheme(preset.id);
      });

      this.optionEls.set(preset.id, option);
      this.expandEl.appendChild(option);
    }

    // Button
    this.btnEl = document.createElement("button");
    this.btnEl.className = "toolbar-btn";
    this.btnEl.innerHTML = COG_ICON_SVG;
    this.btnEl.addEventListener("click", () => this.toggleExpand());

    this.rowEl.appendChild(this.expandEl);
    this.rowEl.appendChild(this.btnEl);

    // Listen for external theme changes to sync active state
    onThemeChange(() => this.updateActiveState());
  }

  getElement(): HTMLElement {
    return this.rowEl;
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
  }

  private updateActiveState(): void {
    const activeId = getActiveThemeId();
    for (const [id, el] of this.optionEls) {
      el.classList.toggle("settings-theme-option-active", id === activeId);
    }
  }
}
