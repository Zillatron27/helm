import { VERSION } from "./version.js";
import { createMap } from "./factory.js";
import { SearchBar } from "./ui/search/SearchBar.js";
import { RoutePanel } from "./ui/search/RoutePanel.js";
import { SettingsPanel } from "./ui/SettingsPanel.js";
import { setupControls } from "./ui/controls.js";
import { onStateChange, getGatewaysVisible, setGatewaysVisible, getSettledVisible, setSettledVisible } from "./ui/state.js";
import { initTheme, getTheme } from "./ui/theme.js";
import "./ui/search/search.css";
import "./ui/settings.css";

console.log(`Helm v${VERSION}`);

// Load saved theme and apply CSS custom properties before any rendering
initTheme();

const appEl = document.getElementById("app") as HTMLElement | null;
if (!appEl) throw new Error("Missing #app element");
const container: HTMLElement = appEl;

// Loading indicator — uses theme colours
const theme = getTheme();
const loading = document.createElement("div");
loading.style.cssText = `
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 16px;
  color: #${theme.textSecondary.toString(16).padStart(6, "0")};
  background: #${theme.bgPrimary.toString(16).padStart(6, "0")};
  z-index: 100;
`;
loading.textContent = "Loading galaxy data...";
document.body.appendChild(loading);

const GATEWAY_ICON_SVG = `<svg width="26" height="26" viewBox="0 0 26 22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
  <circle cx="4" cy="16" r="3"/>
  <circle cx="22" cy="16" r="3"/>
  <path d="M4 13 C4 1 22 1 22 13"/>
</svg>`;

const SETTLED_ICON_SVG = `<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="13" cy="8" r="4"/>
  <path d="M5 24c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
  <circle cx="4" cy="12" r="3"/>
  <path d="M0 22c0-2.8 1.8-5 4-5"/>
  <circle cx="22" cy="12" r="3"/>
  <path d="M26 22c0-2.8-1.8-5-4-5"/>
</svg>`;

async function boot(): Promise<void> {
  try {
    const helm = await createMap(container);
    const { renderer, panelManager } = helm;
    loading.remove();

    const searchBar = new SearchBar();
    searchBar.init(renderer);
    const routePanel = new RoutePanel();
    routePanel.init(renderer);

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

    // Settled toggle row
    const settledRow = document.createElement("div");
    settledRow.className = "toolbar-row";
    const settledBtn = document.createElement("button");
    settledBtn.className = "toolbar-btn toolbar-btn-settled-off";
    settledBtn.title = "Toggle settled systems (S)";
    settledBtn.innerHTML = SETTLED_ICON_SVG;
    settledBtn.addEventListener("click", () => {
      setSettledVisible(!getSettledVisible());
    });
    settledRow.appendChild(settledBtn);
    toolbar.appendChild(settledRow);

    // Settings panel row
    const settingsPanel = new SettingsPanel();
    toolbar.appendChild(settingsPanel.getElement());

    document.body.appendChild(toolbar);

    // Version indicator
    const versionEl = document.createElement("div");
    versionEl.id = "helm-version";
    versionEl.textContent = `v${VERSION}`;
    document.body.appendChild(versionEl);

    // Sync toggle buttons with state (handles both button clicks and keyboard shortcuts)
    onStateChange(() => {
      const gwVisible = getGatewaysVisible();
      renderer.setGatewaysVisible(gwVisible);
      gatewayBtn.classList.toggle("toolbar-btn-gateway-on", gwVisible);
      gatewayBtn.classList.toggle("toolbar-btn-gateway-off", !gwVisible);

      const stVisible = getSettledVisible();
      renderer.setSettledVisible(stVisible);
      settledBtn.classList.toggle("toolbar-btn-settled-on", stVisible);
      settledBtn.classList.toggle("toolbar-btn-settled-off", !stVisible);
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
