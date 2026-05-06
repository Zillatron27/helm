import type { Viewport } from "pixi-viewport";
import {
  getViewLevel,
  setSelectedEntity,
  setViewLevel,
  setFocusedSystem,
  getGatewaysVisible,
  setGatewaysVisible,
  getSettledVisible,
  setSettledVisible,
  getResourceFilters,
  setResourceFilters,
  getCogcFilter,
  setCogcFilter,
  getEmpireDim,
  setEmpireDim,
  getBridgeSnapshot,
} from "./state.js";
import type { PanelManager } from "./panels/PanelManager.js";
import type { SearchBar } from "./search/SearchBar.js";
import type { MapRenderer } from "../renderer/MapRenderer.js";
import type { ResourcePicker } from "./resource/ResourcePicker.js";

const PAN_SPEED = 300; // pixels of visual movement per keypress
const ZOOM_STEP = 0.15; // fraction per keypress

let handler: ((e: KeyboardEvent) => void) | null = null;

export function setupControls(
  viewport: Viewport,
  panelManager: PanelManager,
  searchBar: SearchBar,
  renderer: MapRenderer,
  resourcePicker?: ResourcePicker
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
        if (getResourceFilters().length > 0 || getCogcFilter()) {
          // Clear any active filter first
          setResourceFilters([]);
          setCogcFilter(null);
        } else if (panelManager.isVisible()) {
          setSelectedEntity(null);
        } else if (getViewLevel() === "system") {
          setFocusedSystem(null);
          setViewLevel("galaxy");
        } else {
          renderer.zoomToGalaxyFit();
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
      case "g":
        e.preventDefault();
        setGatewaysVisible(!getGatewaysVisible());
        break;
      case "s":
        e.preventDefault();
        setSettledVisible(!getSettledVisible());
        break;
      case "r":
        e.preventDefault();
        resourcePicker?.toggle();
        break;
      case "e":
        e.preventDefault();
        if (getBridgeSnapshot() !== null) {
          const next = !getEmpireDim();
          setEmpireDim(next);
          if (next) renderer.frameEmpire();
        }
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
