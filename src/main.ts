import { VERSION } from "./version.js";
import { loadSystemData, loadCxStations, loadMaterials, getSystems } from "./data/cache.js";
import { fetchAllPlanetNames } from "./data/fio.js";
import { buildSearchIndex } from "./data/searchIndex.js";
import { MapRenderer } from "./renderer/MapRenderer.js";
import { PanelManager } from "./ui/panels/PanelManager.js";
import { SearchBar } from "./ui/search/SearchBar.js";
import { RoutePanel } from "./ui/search/RoutePanel.js";
import { setupControls } from "./ui/controls.js";
import { onStateChange, getGatewaysVisible, setGatewaysVisible } from "./ui/state.js";
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

const GATEWAY_ICON_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <path d="M2 18 Q2 8 12 8 Q22 8 22 18"/>
  <circle cx="2" cy="18" r="2"/>
  <circle cx="22" cy="18" r="2"/>
</svg>`;

async function boot(): Promise<void> {
  try {
    // Parallel fetch: system data + planet name index + CX stations
    const [, planetSummaries] = await Promise.all([
      loadSystemData(),
      fetchAllPlanetNames().catch((err) => {
        console.warn("Planet index fetch failed, search will be systems-only:", err);
        return [];
      }),
      loadCxStations().catch((err) => {
        console.warn("CX station fetch failed, CX markers will be hidden:", err);
      }),
      loadMaterials().catch((err) => {
        console.warn("Materials fetch failed, resource codes will show IDs:", err);
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
    const routePanel = new RoutePanel();

    // Build toolbar container
    const toolbar = document.createElement("div");
    toolbar.id = "helm-toolbar";
    toolbar.appendChild(searchBar.getElement());
    toolbar.appendChild(routePanel.getElement());

    // Gateway toggle row
    const gatewayRow = document.createElement("div");
    gatewayRow.className = "toolbar-row";
    const gatewayBtn = document.createElement("button");
    gatewayBtn.className = "toolbar-btn toolbar-btn-gateway-on";
    gatewayBtn.innerHTML = GATEWAY_ICON_SVG;
    gatewayBtn.addEventListener("click", () => {
      setGatewaysVisible(!getGatewaysVisible());
    });
    gatewayRow.appendChild(gatewayBtn);
    toolbar.appendChild(gatewayRow);

    document.body.appendChild(toolbar);

    // Version indicator
    const versionEl = document.createElement("div");
    versionEl.id = "helm-version";
    versionEl.textContent = `v${VERSION}`;
    document.body.appendChild(versionEl);

    // Sync gateway button with state (handles both button click and G key)
    onStateChange(() => {
      const visible = getGatewaysVisible();
      renderer.setGatewaysVisible(visible);
      gatewayBtn.classList.toggle("toolbar-btn-gateway-on", visible);
      gatewayBtn.classList.toggle("toolbar-btn-gateway-off", !visible);
    });

    const viewport = renderer.getViewport();
    if (viewport) {
      setupControls(viewport, panelManager, searchBar, renderer);
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
