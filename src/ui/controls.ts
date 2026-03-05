import type { Viewport } from "pixi-viewport";
import {
  getViewLevel,
  setSelectedEntity,
  setViewLevel,
  setFocusedSystem,
} from "./state.js";
import type { PanelManager } from "./panels/PanelManager.js";
import type { SearchBar } from "./search/SearchBar.js";

const PAN_SPEED = 300; // pixels of visual movement per keypress
const ZOOM_STEP = 0.15; // fraction per keypress

let handler: ((e: KeyboardEvent) => void) | null = null;

export function setupControls(
  viewport: Viewport,
  panelManager: PanelManager,
  searchBar: SearchBar
): void {
  handler = (e: KeyboardEvent) => {
    // Skip if user is typing in an input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    // Scale pan distance by current zoom so visual speed stays consistent
    const panDist = PAN_SPEED / viewport.scaled;

    switch (e.key) {
      case "/":
        e.preventDefault();
        searchBar.focus();
        break;
      case "k":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          searchBar.focus();
        }
        break;
      case "Escape":
        e.preventDefault();
        if (panelManager.isVisible()) {
          // Close panel first
          setSelectedEntity(null);
        } else if (getViewLevel() === "system") {
          // Zoom out to galaxy
          setFocusedSystem(null);
          setViewLevel("galaxy");
        }
        break;
      case "ArrowLeft":
        viewport.x += panDist;
        e.preventDefault();
        break;
      case "ArrowRight":
        viewport.x -= panDist;
        e.preventDefault();
        break;
      case "ArrowUp":
        viewport.y += panDist;
        e.preventDefault();
        break;
      case "ArrowDown":
        viewport.y -= panDist;
        e.preventDefault();
        break;
      case "+":
      case "=":
        viewport.zoomPercent(ZOOM_STEP, true);
        e.preventDefault();
        break;
      case "-":
        viewport.zoomPercent(-ZOOM_STEP, true);
        e.preventDefault();
        break;
    }
  };

  document.addEventListener("keydown", handler);
}

export function teardownControls(): void {
  if (handler) {
    document.removeEventListener("keydown", handler);
    handler = null;
  }
}
