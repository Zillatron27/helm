import type { Viewport } from "pixi-viewport";
import { loadSystemData, loadCxStations, loadMaterials, getSystems } from "./data/cache.js";
import { fetchAllPlanetNames } from "./data/fio.js";
import { buildSearchIndex } from "./data/searchIndex.js";
import { MapRenderer } from "./renderer/MapRenderer.js";
import { PanelManager } from "./ui/panels/PanelManager.js";
import { initTheme } from "./ui/theme.js";

export interface HelmInstance {
  renderer: MapRenderer;
  viewport: Viewport;
  panelManager: PanelManager;
  panToSystem(systemId: string): void;
  panToPlanet(systemId: string, planetId: string): void;
  frameRoute(systemIds: string[]): void;
  zoomToGalaxyFit(): void;
  setGatewaysVisible(visible: boolean): void;
  destroy(): void;
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

  const renderer = new MapRenderer();
  await renderer.init(container);

  const viewport = renderer.getViewport()!;

  const panelManager = new PanelManager();
  panelManager.init(renderer);

  return {
    renderer,
    viewport,
    panelManager,
    panToSystem: (systemId) => renderer.panToSystem(systemId),
    panToPlanet: (systemId, planetId) => renderer.panToPlanet(systemId, planetId),
    frameRoute: (systemIds) => renderer.frameRoute(systemIds),
    zoomToGalaxyFit: () => renderer.zoomToGalaxyFit(),
    setGatewaysVisible: (visible) => renderer.setGatewaysVisible(visible),
    destroy: () => renderer.destroy(),
  };
}
