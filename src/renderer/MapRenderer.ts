import { Application } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { getTheme } from "../ui/theme.js";
import type { StarSystem } from "../types/index.js";
import {
  getSystems,
  getConnections,
  getWorldBounds,
  getSectorHexes,
  getSystemById,
  loadPlanetsForSystem,
  getPlanetsForSystem,
} from "../data/cache.js";
import { BackgroundLayer } from "./BackgroundLayer.js";
import { HexGridLayer } from "./HexGridLayer.js";
import { GalaxyLayer } from "./GalaxyLayer.js";
import { SystemLayer } from "./SystemLayer.js";
import {
  getViewLevel,
  getFocusedSystemId,
  getActiveRoute,
  setSelectedEntity,
  onStateChange,
} from "../ui/state.js";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8.0;
const WORLD_PADDING = 500;
const SYSTEM_ZOOM_SCALE = 1.3;
const TRANSITION_MS = 800;

export class MapRenderer {
  private app: Application | null = null;
  private viewport: Viewport | null = null;
  private background: BackgroundLayer | null = null;
  private hexGrid: HexGridLayer | null = null;
  private galaxy: GalaxyLayer | null = null;
  private systemLayer: SystemLayer | null = null;
  private fitScale = 1;
  private prevViewLevel: "galaxy" | "system" = "galaxy";

  async init(container: HTMLElement): Promise<void> {
    const theme = getTheme();

    const app = new Application();
    await app.init({
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      background: theme.bgPrimary,
      resizeTo: window,
    });

    container.appendChild(app.canvas);
    this.app = app;

    const bounds = getWorldBounds();
    const worldWidth = bounds.width + WORLD_PADDING * 2;
    const worldHeight = bounds.height + WORLD_PADDING * 2;

    // Create viewport with v8 event system
    const viewport = new Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      worldWidth,
      worldHeight,
      events: app.renderer.events,
    });

    viewport
      .drag()
      .pinch()
      .wheel({ smooth: 5 })
      .decelerate()
      .clampZoom({ minScale: MIN_ZOOM, maxScale: MAX_ZOOM });

    this.viewport = viewport;

    // Background layer — on stage directly, behind viewport (for parallax)
    this.background = new BackgroundLayer(bounds);
    app.stage.addChild(this.background.container);

    // Viewport on stage, on top of background
    app.stage.addChild(viewport);

    // Hex grid layer — inside viewport, behind everything else
    const HEX_WORLD_CIRCUMRADIUS = 400; // 100 raw * WORLD_SCALE(4)
    this.hexGrid = new HexGridLayer(getSectorHexes(), HEX_WORLD_CIRCUMRADIUS);
    viewport.addChild(this.hexGrid.container);

    // Galaxy layer — inside viewport (pans/zooms with camera)
    this.galaxy = new GalaxyLayer(getSystems(), getConnections());
    viewport.addChild(this.galaxy.container);

    // System layer — also inside viewport, above galaxy
    this.systemLayer = new SystemLayer();
    viewport.addChild(this.systemLayer.container);

    // Centre on galaxy and fit to show the whole thing
    viewport.moveCenter(0, 0);
    viewport.fitWorld(true);
    this.fitScale = viewport.scaled;

    // Wire parallax updates
    viewport.on("moved", () => {
      this.background?.updateParallax(viewport);
    });
    this.background.updateParallax(viewport);

    // Empty-space click closes panel
    viewport.on("pointertap", (e) => {
      // Only deselect if the click target is the viewport itself (not a star/planet)
      if (e.target === viewport) {
        setSelectedEntity(null);
      }
    });

    // Handle window resize
    window.addEventListener("resize", () => {
      viewport.resize(window.innerWidth, window.innerHeight);
    });

    // Subscribe to state changes for camera transitions
    onStateChange(() => this.handleStateChange());
  }

  private handleStateChange(): void {
    const viewLevel = getViewLevel();
    const focusedId = getFocusedSystemId();

    if (viewLevel === "system" && this.prevViewLevel === "galaxy" && focusedId) {
      this.zoomToSystem(focusedId);
    } else if (viewLevel === "galaxy" && this.prevViewLevel === "system") {
      this.zoomToGalaxy();
    }

    this.prevViewLevel = viewLevel;

    // Route overlay
    const route = getActiveRoute();
    if (route && route.systemIds.length >= 2) {
      this.galaxy?.showRoute(route.systemIds);
    } else {
      this.galaxy?.clearRoute();
    }
  }

  private zoomToSystem(systemId: string): void {
    const viewport = this.viewport;
    if (!viewport) return;

    const system = getSystemById(systemId);
    if (!system) return;

    // Animate camera to system position
    viewport.animate({
      position: { x: system.worldX, y: system.worldY },
      scale: SYSTEM_ZOOM_SCALE,
      time: TRANSITION_MS,
      ease: "easeInOutCubic",
      callbackOnComplete: () => {
        // Dim galaxy layer, show system
        this.galaxy?.dimExcept(systemId);
        this.showSystemView(system);
      },
    });
  }

  private zoomToGalaxy(): void {
    const viewport = this.viewport;
    if (!viewport) return;

    // Hide system layer first
    this.systemLayer?.hide();
    this.galaxy?.restore();

    viewport.animate({
      position: { x: 0, y: 0 },
      scale: this.fitScale,
      time: TRANSITION_MS,
      ease: "easeInOutCubic",
    });
  }

  private showSystemView(system: StarSystem): void {
    // Show system layer with cached planets or loading state
    const cached = getPlanetsForSystem(system.naturalId);
    if (cached) {
      this.systemLayer?.show(system, cached);
      // Position at system world coordinates
      if (this.systemLayer) {
        this.systemLayer.container.x = system.worldX;
        this.systemLayer.container.y = system.worldY;
      }
    } else {
      // Show empty system layer while loading, then update
      this.systemLayer?.show(system, []);
      if (this.systemLayer) {
        this.systemLayer.container.x = system.worldX;
        this.systemLayer.container.y = system.worldY;
      }

      loadPlanetsForSystem(system.naturalId).then((planets) => {
        // Only update if still viewing this system
        if (getFocusedSystemId() === system.id && getViewLevel() === "system") {
          this.systemLayer?.show(system, planets);
          if (this.systemLayer) {
            this.systemLayer.container.x = system.worldX;
            this.systemLayer.container.y = system.worldY;
          }
        }
      });
    }
  }

  // Navigate camera to a system at galaxy level (used by panel connected-system links)
  panToSystem(systemId: string): void {
    const viewport = this.viewport;
    if (!viewport) return;

    const system = getSystemById(systemId);
    if (!system) return;

    viewport.animate({
      position: { x: system.worldX, y: system.worldY },
      scale: Math.max(viewport.scaled, this.fitScale * 2),
      time: TRANSITION_MS,
      ease: "easeInOutCubic",
    });

    setSelectedEntity({ type: "system", id: systemId });
  }

  getViewport(): Viewport | null {
    return this.viewport;
  }

  getFitScale(): number {
    return this.fitScale;
  }

  destroy(): void {
    this.app?.destroy(true);
    this.app = null;
    this.viewport = null;
    this.background = null;
    this.hexGrid = null;
    this.galaxy = null;
    this.systemLayer = null;
  }
}
