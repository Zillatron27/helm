import { VERSION } from "./version.js";
import { createMap } from "./factory.js";
import { SearchBar } from "./ui/search/SearchBar.js";
import { RoutePanel } from "./ui/search/RoutePanel.js";
import { SettingsPanel } from "./ui/SettingsPanel.js";
import { ResourcePicker } from "./ui/resource/ResourcePicker.js";
import { setupControls } from "./ui/controls.js";
import { onStateChange, getGatewaysVisible, setGatewaysVisible, getSettledVisible, getResourceFilters, getCogcFilter, getEmpireDim, setEmpireDim, onResourceFilterChange, onCogcFilterChange, getBridgeSnapshot, onBridgeSnapshotChange } from "./ui/state.js";
import { isResourceIndexReady, onResourceIndexReady, getMatchingSystemsAll } from "./data/resourceIndex.js";
import { getResourceSystemMatches, getResourcePlanetMatches, getCogcSystemMatches } from "./data/filterMatches.js";
import { getEmpireSystemMatches, getEmpirePlanetMatches, onEmpireIndexChange } from "./data/empireIndex.js";
import { yieldToMain } from "./util/yieldToMain.js";
import { initTheme, getTheme } from "./ui/theme.js";
import { createLoader } from "./ui/loader/LoaderAnimation.js";
import { initBridge } from "./data/bridge.js";
import "./ui/search/search.css";
import "./ui/settings.css";
import "./ui/resource/resource.css";
import "./ui/map-tooltip.css";

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

const EMPIRE_ICON_SVG = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="2" fill="currentColor"/>
  <circle cx="12" cy="12" r="6"/>
  <circle cx="12" cy="12" r="10" opacity="0.4"/>
</svg>`;

async function boot(): Promise<void> {
  // Attach the Helm Extension message listener before any await — the
  // extension's content script runs at document_start and the SW notifies
  // APEX as soon as both tabs register, so hello can arrive before
  // createMap() resolves on a slow connection. There's no retry on the
  // extension side per protocol §3.3.
  initBridge();

  (window as unknown as { __helm: unknown }).__helm = {
    getBridgeSnapshot,
    onBridgeSnapshotChange,
  };

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
    resourcePicker.setFilterCallback(async (materialIds) => {
      if (materialIds.length === 0) {
        renderer.clearResourceIndicators();
        return;
      }
      await renderer.setResourceConcentrationsAsync(getMatchingSystemsAll(materialIds));
    });
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

    // Empire dim lens row — hidden until a bridge snapshot arrives (tier 1 has no empire data)
    const empireRow = document.createElement("div");
    empireRow.className = "toolbar-row";
    const empireBtn = document.createElement("button");
    empireBtn.className = "toolbar-btn toolbar-btn-empire-off";
    empireBtn.title = "Toggle empire highlight (E)";
    empireBtn.innerHTML = EMPIRE_ICON_SVG;
    empireBtn.addEventListener("click", () => {
      const next = !getEmpireDim();
      setEmpireDim(next);
      if (next) renderer.frameEmpire();
    });
    empireRow.appendChild(empireBtn);
    toolbar.appendChild(empireRow);

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

    // --- Global toggle sync (gateways, settled visibility, empire button on/off) ---
    // Manages on/off classes for pressed state. Does not touch `display` —
    // that's syncEmpireDimVisibility's job.
    function syncToggles(): void {
      const gwVisible = getGatewaysVisible();
      renderer.setGatewaysVisible(gwVisible);
      gatewayBtn.classList.toggle("toolbar-btn-gateway-on", gwVisible);
      gatewayBtn.classList.toggle("toolbar-btn-gateway-off", !gwVisible);

      const stVisible = getSettledVisible();
      renderer.setSettledVisible(stVisible);

      const emDim = getEmpireDim();
      empireBtn.classList.toggle("toolbar-btn-empire-on", emDim);
      empireBtn.classList.toggle("toolbar-btn-empire-off", !emDim);
    }
    onStateChange(syncToggles);
    syncToggles();

    // Show/hide the empire-dim button based on snapshot presence. Tier 1
    // (no extension) → hidden; tier 2/3 → visible.
    function syncEmpireDimVisibility(): void {
      empireRow.style.display = getBridgeSnapshot() !== null ? "" : "none";
    }
    onBridgeSnapshotChange(syncEmpireDimVisibility);
    syncEmpireDimVisibility();

    // --- Dim composition ---
    // Intersect the active (non-null) match sets into a single bright set.
    // Galaxy dim = resource ∩ COGC ∩ empire. Planet dim = resource ∩ empire
    // (COGC doesn't drive planet dim).
    function intersectNonNull(sets: Array<Set<string> | null>): Set<string> | null {
      const active = sets.filter((s): s is Set<string> => s !== null);
      if (active.length === 0) return null;
      if (active.length === 1) return active[0]!;
      const smallest = active.reduce((a, b) => (a.size <= b.size ? a : b));
      const out = new Set<string>();
      for (const id of smallest) {
        if (active.every((s) => s.has(id))) out.add(id);
      }
      return out;
    }

    function setsEqualNullable(a: Set<string> | null, b: Set<string> | null): boolean {
      if (a === b) return true;
      if (a === null || b === null) return false;
      if (a.size !== b.size) return false;
      for (const v of a) if (!b.has(v)) return false;
      return true;
    }

    // Memoize so onStateChange tickling (view level, selection, route, etc.)
    // doesn't re-enter applyHighlightFilter mid-tween and trash the
    // system-view restore animation.
    let lastGalaxyBright: Set<string> | null = null;
    let lastPlanetBright: Set<string> | null = null;

    function applyComposition(): void {
      const galaxyBright = intersectNonNull([
        getResourceSystemMatches(),
        getCogcSystemMatches(),
        getEmpireSystemMatches(),
      ]);
      const planetBright = intersectNonNull([
        getResourcePlanetMatches(),
        getEmpirePlanetMatches(),
      ]);
      if (!setsEqualNullable(galaxyBright, lastGalaxyBright)) {
        renderer.setHighlightedSystems(galaxyBright);
        lastGalaxyBright = galaxyBright;
      }
      if (!setsEqualNullable(planetBright, lastPlanetBright)) {
        renderer.setDimmedPlanets(planetBright);
        lastPlanetBright = planetBright;
      }
    }
    onStateChange(applyComposition);
    onEmpireIndexChange(applyComposition);

    // Galaxy-view empire indicators (passive, ungated by the dim toggle):
    // base rings on owned systems + ship stacks on systems with docked
    // ships. Snapshot subscription covers tier arrival / disappearance;
    // index subscription covers site-level changes (rings only, but
    // calling both is idempotent and avoids stale state).
    const rebuildEmpireGalaxyOverlay = (): void => {
      renderer.rebuildEmpireRings();
      renderer.rebuildEmpireShipStacks();
    };

    renderer.onAfterRebuild(() => {
      // Galaxy layer is a fresh instance after rebuild; drop the memo so
      // the current composed state is actually pushed to it.
      lastGalaxyBright = null;
      lastPlanetBright = null;
      applyComposition();
      const ids = getResourceFilters();
      if (ids.length > 0) {
        renderer.setResourceConcentrationsAsync(getMatchingSystemsAll(ids));
      }
      rebuildEmpireGalaxyOverlay();
    });
    applyComposition();

    onBridgeSnapshotChange(rebuildEmpireGalaxyOverlay);
    onEmpireIndexChange(rebuildEmpireGalaxyOverlay);
    rebuildEmpireGalaxyOverlay();

    // --- Resource filter handler ---
    // On clear: drop concentration dots. Composition is re-applied via
    // onStateChange (global notify) and covers the dim side.
    function handleResourceFilterChange(): void {
      if (getResourceFilters().length === 0) {
        renderer.clearResourceIndicators();
      }
      resourcePicker.syncState();
    }
    onResourceFilterChange(handleResourceFilterChange);

    // --- COGC filter handler ---
    // Owns badge + spinner UX; composition is driven by onStateChange.
    async function handleCogcFilterChange(): Promise<void> {
      const cogcCat = getCogcFilter();
      if (!cogcCat) {
        searchBar.removeCogcBadge();
        searchBar.restoreButtonIcon();
        return;
      }

      const label = COGC_NAMES[cogcCat] ?? cogcCat.replace(/_/g, " ");
      searchBar.showButtonSpinner();

      if (!isResourceIndexReady()) {
        onResourceIndexReady(() => handleCogcFilterChange());
        return;
      }

      // Yield so the spinner paints before composition work
      await yieldToMain();
      await yieldToMain();

      // Guard: filter may have changed during the yield
      if (getCogcFilter() !== cogcCat) {
        searchBar.restoreButtonIcon();
        return;
      }

      applyComposition();
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
