import { VERSION } from "./version.js";
import { createMap } from "./factory.js";
import { SearchBar } from "./ui/search/SearchBar.js";
import { RoutePanel } from "./ui/search/RoutePanel.js";
import { SettingsPanel } from "./ui/SettingsPanel.js";
import { ResourcePicker } from "./ui/resource/ResourcePicker.js";
import { setupControls } from "./ui/controls.js";
import { onStateChange, getGatewaysVisible, setGatewaysVisible, getSettledVisible, setSettledVisible, getResourceFilter, getCogcFilter, onResourceFilterChange, onCogcFilterChange } from "./ui/state.js";
import { isResourceIndexReady, onResourceIndexReady, getSystemsWithCogcProgram } from "./data/resourceIndex.js";
import { yieldToMain } from "./util/yieldToMain.js";
import { initTheme, getTheme } from "./ui/theme.js";
import { createLoader } from "./ui/loader/LoaderAnimation.js";
import { initBridge } from "./data/bridge.js";
import "./ui/search/search.css";
import "./ui/settings.css";
import "./ui/resource/resource.css";

console.log(`Helm v${VERSION}`);

// Load saved theme and apply CSS custom properties before any rendering
initTheme();

const appEl = document.getElementById("app") as HTMLElement | null;
if (!appEl) throw new Error("Missing #app element");
const container: HTMLElement = appEl;

// Themed loading animation
const theme = getTheme();
const loading = createLoader(theme, VERSION);
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
  // Attach the Helm Extension message listener before any await — the
  // extension's content script runs at document_start and the SW notifies
  // APEX as soon as both tabs register, so hello can arrive before
  // createMap() resolves on a slow connection. There's no retry on the
  // extension side per protocol §3.3.
  initBridge();

  try {
    const helm = await createMap(container);
    const { renderer, panelManager } = helm;

    // Cross-fade: loader fades out over the now-visible map
    loading.style.transition = "opacity 0.6s ease";
    loading.style.opacity = "0";
    loading.addEventListener("transitionend", () => loading.remove(), { once: true });

    const searchBar = new SearchBar();
    searchBar.init(renderer);
    const routePanel = new RoutePanel();
    routePanel.init(renderer);

    // Build toolbar container
    const toolbar = document.createElement("div");
    toolbar.id = "helm-toolbar";
    toolbar.appendChild(searchBar.getElement());

    // Resource filter picker row — right after search
    const resourcePicker = new ResourcePicker();
    resourcePicker.setFilterCallback((materialId) => renderer.setResourceFilterAsync(materialId));
    toolbar.appendChild(resourcePicker.getElement());

    toolbar.appendChild(routePanel.getElement());

    // Gateway toggle row
    const gatewayRow = document.createElement("div");
    gatewayRow.className = "toolbar-row";
    const gatewayBtn = document.createElement("button");
    gatewayBtn.className = "toolbar-btn toolbar-btn-gateway-on";
    gatewayBtn.title = "Toggle gateways (G)";
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

    // HUD toolbar slot — Phase 4+ overview panels (burn/fleet/warehouse)
    // append their toggle buttons here. Empty in Phase 3.
    const hudToolbarSlot = document.createElement("div");
    hudToolbarSlot.id = "hud-toolbar-slot";
    toolbar.appendChild(hudToolbarSlot);

    document.body.appendChild(toolbar);

    // Version indicator
    const versionEl = document.createElement("div");
    versionEl.id = "helm-version";
    versionEl.textContent = `v${VERSION}`;
    document.body.appendChild(versionEl);

    // --- Display labels for COGC program categories ---
    const COGC_NAMES: Record<string, string> = {
      ADVERTISING_MANUFACTURING: "Manufacturing",
      ADVERTISING_AGRICULTURE: "Agriculture",
      ADVERTISING_CHEMISTRY: "Chemistry",
      ADVERTISING_CONSTRUCTION: "Construction",
      ADVERTISING_ELECTRONICS: "Electronics",
      ADVERTISING_FOOD_INDUSTRIES: "Food Industries",
      ADVERTISING_FUEL_REFINING: "Fuel Refining",
      ADVERTISING_METALLURGY: "Metallurgy",
      ADVERTISING_RESOURCE_EXTRACTION: "Resource Extraction",
    };

    // --- Global toggle sync (gateways, settled visibility) ---
    // Only handles genuinely global visual state that doesn't interfere
    // with filter-specific logic.
    function syncToggles(): void {
      const gwVisible = getGatewaysVisible();
      renderer.setGatewaysVisible(gwVisible);
      gatewayBtn.classList.toggle("toolbar-btn-gateway-on", gwVisible);
      gatewayBtn.classList.toggle("toolbar-btn-gateway-off", !gwVisible);

      const stVisible = getSettledVisible();
      renderer.setSettledVisible(stVisible);
      settledBtn.classList.toggle("toolbar-btn-settled-on", stVisible);
      settledBtn.classList.toggle("toolbar-btn-settled-off", !stVisible);
    }
    onStateChange(syncToggles);
    syncToggles();

    // --- Resource filter handler ---
    // Owns the full lifecycle of resource filter teardown.
    // Setting a filter goes through the async path (ResourcePicker.setFilterCallback).
    function handleResourceFilterChange(): void {
      const filterMat = getResourceFilter();
      if (!filterMat) {
        renderer.clearResourceIndicators();
        // Only clear highlights if COGC isn't taking over
        if (!getCogcFilter()) {
          renderer.setHighlightedSystems(null);
        }
      }
      resourcePicker.syncState();
    }
    onResourceFilterChange(handleResourceFilterChange);

    // --- COGC filter handler ---
    // Owns the full lifecycle: spinner → highlight application → badge.
    // Same pattern as resource filter: button spinner while working.
    async function handleCogcFilterChange(): Promise<void> {
      const cogcCat = getCogcFilter();
      if (!cogcCat) {
        searchBar.removeCogcBadge();
        searchBar.restoreButtonIcon();
        // Only clear highlights if resource filter isn't taking over
        if (!getResourceFilter()) {
          renderer.setHighlightedSystems(null);
        }
        return;
      }

      const label = COGC_NAMES[cogcCat] ?? cogcCat.replace(/_/g, " ");

      // Show spinner on search button while working
      searchBar.showButtonSpinner();

      if (!isResourceIndexReady()) {
        onResourceIndexReady(() => handleCogcFilterChange());
        return;
      }

      // Yield so the spinner paints before highlight work
      await yieldToMain();
      await yieldToMain();

      // Guard: filter may have changed during the yield
      if (getCogcFilter() !== cogcCat) {
        searchBar.restoreButtonIcon();
        return;
      }

      const matchingSystems = getSystemsWithCogcProgram(cogcCat);
      renderer.setHighlightedSystems(matchingSystems.size > 0 ? matchingSystems : null);
      searchBar.restoreButtonIcon();
      searchBar.showCogcBadge(label);
    }
    onCogcFilterChange(handleCogcFilterChange);

    const viewport = renderer.getViewport();
    if (viewport) {
      setupControls(viewport, panelManager, searchBar, renderer, resourcePicker);
    }
  } catch (err) {
    loading.innerHTML = "";
    loading.style.cssText = `
      position:fixed;inset:0;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:12px;
      background:#${theme.bgPrimary.toString(16).padStart(6, "0")};
      font-family:'IBM Plex Mono',monospace;
      z-index:100;
    `;

    const title = document.createElement("div");
    title.style.color = "#ff8c00";
    title.style.fontSize = "18px";
    title.style.fontFamily = "'Audiowide', sans-serif";
    title.textContent = "Failed to load galaxy data";
    loading.appendChild(title);

    const detail = document.createElement("div");
    detail.style.color = "#666666";
    title.style.fontSize = "14px";
    detail.style.maxWidth = "600px";
    detail.style.textAlign = "center";
    detail.textContent = err instanceof Error ? err.message : String(err);
    loading.appendChild(detail);

    console.error("Helm boot failed:", err);
  }
}

boot();
