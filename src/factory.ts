import type { Container } from "pixi.js";
import type { Viewport } from "pixi-viewport";
import { loadSystemData, loadCxStations, loadMaterials, getSystems } from "./data/cache.js";
import { fetchAllPlanetNames } from "./data/fio.js";
import { buildSearchIndex } from "./data/searchIndex.js";
import { computeCxDistances } from "./data/cxDistances.js";
import { loadSiteCounts } from "./data/siteCounts.js";
import { loadExchangePrices } from "./data/exchangePrices.js";
import { loadSettledPlanets } from "./data/settledPlanets.js";
import { initResourceIndex, getActiveCogcCategories } from "./data/resourceIndex.js";
import { addSearchEntries } from "./data/searchIndex.js";
import { MapRenderer } from "./renderer/MapRenderer.js";
import { PanelManager } from "./ui/panels/PanelManager.js";
import { initTheme } from "./ui/theme.js";

export interface CameraState {
  x: number;
  y: number;
  scale: number;
}

export interface CameraAnimationOptions {
  x: number;
  y: number;
  scale: number;
  timeMs?: number;
  ease?: string;
  onComplete?: () => void;
}

export interface HelmInstance {
  renderer: MapRenderer;
  viewport: Viewport;
  panelManager: PanelManager;
  panToSystem(systemId: string): void;
  panToPlanet(systemId: string, planetId: string): void;
  frameRoute(systemIds: string[]): void;
  zoomToGalaxyFit(): void;
  setGatewaysVisible(visible: boolean): void;
  setGatewayIndicatorsVisible(visible: boolean): void;
  setHighlightedSystems(ids: Set<string> | null): void;
  destroy(): void;

  // Bridge API: Overlay Layers
  createOverlayLayer(name: string, zOrder: number): Container;
  removeOverlayLayer(name: string): void;

  // Bridge API: Camera
  animateCamera(opts: CameraAnimationOptions): void;
  getCameraState(): CameraState;
  worldToScreen(worldX: number, worldY: number): { x: number; y: number };
  getFitScale(): number;

  // Bridge API: Per-Frame Tick
  onTick(fn: (deltaMs: number) => void): () => void;

  // Bridge API: Panel Interaction
  hideNativePanel(): void;
  onPlanetClick(fn: (planetNaturalId: string, screenX: number, screenY: number) => boolean): () => void;
  onSystemClick(fn: (systemId: string, screenX: number, screenY: number) => boolean): () => void;

  // Bridge API: Lifecycle Events
  onSystemViewEnter(fn: (systemId: string) => void): () => void;
  onSystemViewExit(fn: (systemId: string) => void): () => void;
}

export async function createMap(container: HTMLElement): Promise<HelmInstance> {
  initTheme();

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
  computeCxDistances();
  await Promise.all([
    loadSiteCounts().catch((err) => {
      console.warn("Site count fetch failed, settled indicators unavailable:", err);
    }),
    loadExchangePrices().catch((err) => {
      console.warn("Exchange prices fetch failed, resource prices unavailable:", err);
    }),
    loadSettledPlanets().catch((err) => {
      console.warn("Settled planets fetch failed, governor data unavailable:", err);
    }),
  ]);

  const renderer = new MapRenderer();
  await renderer.init(container);

  const viewport = renderer.getViewport()!;

  const panelManager = new PanelManager();
  panelManager.init(renderer);

  // Non-blocking: start background resource index build + COGC search entries
  initResourceIndex().then(() => {
    const cogcNames: Record<string, string> = {
      ADVERTISING_AGRICULTURE: "COGC: Agriculture",
      ADVERTISING_CHEMISTRY: "COGC: Chemistry",
      ADVERTISING_CONSTRUCTION: "COGC: Construction",
      ADVERTISING_ELECTRONICS: "COGC: Electronics",
      ADVERTISING_FOOD_INDUSTRIES: "COGC: Food Industries",
      ADVERTISING_FUEL_REFINING: "COGC: Fuel Refining",
      ADVERTISING_MANUFACTURING: "COGC: Manufacturing",
      ADVERTISING_METALLURGY: "COGC: Metallurgy",
      ADVERTISING_RESOURCE_EXTRACTION: "COGC: Resource Extraction",
      EDUCATION: "COGC: Education",
      FAMILY_SUPPORT: "COGC: Family Support",
      FESTIVITIES: "COGC: Festivities",
      IMMIGRATION_PIONEER: "COGC: Immigration Pioneer",
      IMMIGRATION_SETTLER: "COGC: Immigration Settler",
      IMMIGRATION_TECHNICIAN: "COGC: Immigration Technician",
      IMMIGRATION_ENGINEER: "COGC: Immigration Engineer",
      IMMIGRATION_SCIENTIST: "COGC: Immigration Scientist",
    };
    const categories = getActiveCogcCategories();
    const entries = categories.map((cat) => ({
      type: "cogc" as const,
      id: cat,
      name: cogcNames[cat] ?? `COGC: ${cat.replace(/_/g, " ")}`,
      naturalId: cat,
      systemId: "",
    }));
    if (entries.length > 0) {
      addSearchEntries(entries);
      console.log(`COGC search: ${entries.length} active program types indexed`);
    }
  }).catch((err) => {
    console.warn("Resource index failed, resource filter will be unavailable:", err);
  });

  return {
    renderer,
    viewport,
    panelManager,
    panToSystem: (systemId) => renderer.panToSystem(systemId),
    panToPlanet: (systemId, planetId) => renderer.panToPlanet(systemId, planetId),
    frameRoute: (systemIds) => renderer.frameRoute(systemIds),
    zoomToGalaxyFit: () => renderer.zoomToGalaxyFit(),
    setGatewaysVisible: (visible) => renderer.setGatewaysVisible(visible),
    setGatewayIndicatorsVisible: (visible) => renderer.setGatewayIndicatorsVisible(visible),
    setHighlightedSystems: (ids) => renderer.setHighlightedSystems(ids),
    destroy: () => renderer.destroy(),

    // Bridge API: Overlay Layers
    createOverlayLayer: (name, zOrder) => renderer.createOverlayLayer(name, zOrder),
    removeOverlayLayer: (name) => renderer.removeOverlayLayer(name),

    // Bridge API: Camera
    animateCamera: (opts) => renderer.animateCamera(opts),
    getCameraState: () => renderer.getCameraState(),
    worldToScreen: (worldX, worldY) => renderer.worldToScreen(worldX, worldY),
    getFitScale: () => renderer.getFitScale(),

    // Bridge API: Per-Frame Tick
    onTick: (fn) => renderer.onTick(fn),

    // Bridge API: Panel Interaction
    hideNativePanel: () => panelManager.hide(),
    onPlanetClick: (fn) => renderer.onPlanetClick(fn),
    onSystemClick: (fn) => renderer.onSystemClick(fn),

    // Bridge API: Lifecycle Events
    onSystemViewEnter: (fn) => renderer.onSystemViewEnter(fn),
    onSystemViewExit: (fn) => renderer.onSystemViewExit(fn),
  };
}
