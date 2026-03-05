import { VERSION } from "./version.js";
import { loadSystemData, getSystems } from "./data/cache.js";
import { fetchAllPlanetNames } from "./data/fio.js";
import { buildSearchIndex } from "./data/searchIndex.js";
import { MapRenderer } from "./renderer/MapRenderer.js";
import { PanelManager } from "./ui/panels/PanelManager.js";
import { SearchBar } from "./ui/search/SearchBar.js";
import { RoutePanel } from "./ui/search/RoutePanel.js";
import { setupControls } from "./ui/controls.js";
import "./ui/panels/panel.css";
import "./ui/search/search.css";

console.log(`Helm v${VERSION}`);

const appEl = document.getElementById("app") as HTMLElement | null;
if (!appEl) throw new Error("Missing #app element");
const container: HTMLElement = appEl;

// Loading indicator
const loading = document.createElement("div");
loading.style.cssText = `
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 16px;
  color: #666666;
  background: #0a0a0a;
  z-index: 100;
`;
loading.textContent = "Loading galaxy data...";
document.body.appendChild(loading);

async function boot(): Promise<void> {
  try {
    // Parallel fetch: system data + planet name index
    const [, planetSummaries] = await Promise.all([
      loadSystemData(),
      fetchAllPlanetNames().catch((err) => {
        console.warn("Planet index fetch failed, search will be systems-only:", err);
        return [];
      }),
    ]);

    buildSearchIndex(getSystems(), planetSummaries);
    loading.remove();

    const renderer = new MapRenderer();
    await renderer.init(container);

    const panelManager = new PanelManager();
    panelManager.init(renderer);

    const searchBar = new SearchBar();
    searchBar.init(renderer);
    new RoutePanel();

    const viewport = renderer.getViewport();
    if (viewport) {
      setupControls(viewport, panelManager, searchBar);
    }
  } catch (err) {
    loading.textContent = "";
    loading.style.flexDirection = "column";
    loading.style.gap = "12px";

    const title = document.createElement("div");
    title.style.color = "#ff8c00";
    title.style.fontSize = "18px";
    title.style.fontFamily = "'Audiowide', sans-serif";
    title.textContent = "Failed to load galaxy data";
    loading.appendChild(title);

    const detail = document.createElement("div");
    detail.style.color = "#666666";
    detail.style.fontSize = "14px";
    detail.style.maxWidth = "600px";
    detail.style.textAlign = "center";
    detail.textContent = err instanceof Error ? err.message : String(err);
    loading.appendChild(detail);

    console.error("Helm boot failed:", err);
  }
}

boot();
