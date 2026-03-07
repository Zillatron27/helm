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
import { TweenManager } from "./Tween.js";
import {
  getViewLevel,
  getFocusedSystemId,
  getSelectedEntity,
  getActiveRoute,
  setSelectedEntity,
  setFocusedSystem,
  setViewLevel,
  onStateChange,
} from "../ui/state.js";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8.0;
const WORLD_PADDING = 500;
const SYSTEM_ZOOM_SCALE = 1.3;
const TRANSITION_MS = 800;
const NEIGHBOURHOOD_SCALE_FACTOR = 4;
const SYSTEM_VIEW_HEX_ALPHA = 0.05;
const SYSTEM_DISMISS_THRESHOLD = SYSTEM_ZOOM_SCALE * 0.8;
const DESELECT_THRESHOLD_FACTOR = 1.5;

export class MapRenderer {
  private app: Application | null = null;
  private viewport: Viewport | null = null;
  private background: BackgroundLayer | null = null;
  private hexGrid: HexGridLayer | null = null;
  private galaxy: GalaxyLayer | null = null;
  private systemLayer: SystemLayer | null = null;
  private fitScale = 1;
  private prevViewLevel: "galaxy" | "system" = "galaxy";
  private lastFocusedSystemId: string | null = null;
  private isAnimating = false;
  private suppressTransitionAnimation = false;
  private elapsedTime = 0;
  private tweens = new TweenManager();

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
    this.galaxy = new GalaxyLayer(getSystems(), getConnections(), this.tweens);
    viewport.addChild(this.galaxy.container);

    // System layer — also inside viewport, above galaxy
    this.systemLayer = new SystemLayer();
    viewport.addChild(this.systemLayer.container);

    // Centre on galaxy and fit to show the whole thing
    viewport.moveCenter(0, 0);
    viewport.fitWorld(true);
    this.fitScale = viewport.scaled;

    // Wire parallax + zoom-responsive line weight updates
    viewport.on("moved", () => {
      this.background?.updateParallax(viewport);

      const scale = viewport.scaled;
      this.galaxy?.redrawConnections(scale);
      this.galaxy?.redrawRoute(scale);
      this.galaxy?.updateHighlightScale(scale);
      this.galaxy?.updateLabelVisibility(scale);
      this.hexGrid?.redraw(scale);
    });
    this.background.updateParallax(viewport);

    // Initial zoom-responsive draw at fitWorld scale
    const initialScale = viewport.scaled;
    this.galaxy?.redrawConnections(initialScale);
    this.galaxy?.updateLabelVisibility(initialScale);
    this.hexGrid?.redraw(initialScale);

    // Per-frame animation ticker
    app.ticker.add((ticker) => {
      const dt = ticker.deltaMS / 1000;
      this.tweens.update(dt);
      this.galaxy?.updateParticles(dt);
      this.elapsedTime += dt;
      if (getViewLevel() === "galaxy") {
        this.galaxy?.updateCxPulse(this.elapsedTime);
        this.galaxy?.updateTwinkle(this.elapsedTime);
      } else {
        this.systemLayer?.update(dt, this.elapsedTime);
      }
    });

    // Zoom threshold auto-dismiss
    viewport.on("zoomed", () => this.checkZoomThresholds());

    // Empty-space click cascade (mirrors Escape key behaviour)
    // Guard against double-click cascading through two steps
    let lastEmptyClickTime = 0;
    viewport.on("pointertap", (e) => {
      if (e.target !== viewport) return;

      const now = performance.now();
      if (now - lastEmptyClickTime < 300) return;
      lastEmptyClickTime = now;

      if (getSelectedEntity() !== null) {
        setSelectedEntity(null);
      } else if (getViewLevel() === "system") {
        setFocusedSystem(null);
        setViewLevel("galaxy");
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
      this.lastFocusedSystemId = focusedId;
      this.zoomToSystem(focusedId);
    } else if (viewLevel === "galaxy" && this.prevViewLevel === "system") {
      if (!this.suppressTransitionAnimation) {
        this.zoomToNeighbourhood();
      }
      this.suppressTransitionAnimation = false;
    }

    this.prevViewLevel = viewLevel;

    // Connection highlight for selected system (galaxy view only)
    if (viewLevel === "galaxy") {
      const selected = getSelectedEntity();
      const selectedSystemId =
        selected && selected.type === "system" ? selected.id : null;
      this.galaxy?.setSelectedSystem(selectedSystemId);
    }

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

    // Start dim tweens concurrent with camera animation
    this.galaxy?.dimExcept(systemId, this.tweens);
    if (this.hexGrid) {
      this.tweens.to(this.hexGrid.container, "alpha", SYSTEM_VIEW_HEX_ALPHA, 0.6);
    }

    // Animate camera to system position
    this.isAnimating = true;
    viewport.animate({
      position: { x: system.worldX, y: system.worldY },
      scale: SYSTEM_ZOOM_SCALE,
      time: TRANSITION_MS,
      ease: "easeInOutCubic",
      callbackOnComplete: () => {
        this.isAnimating = false;
        this.showSystemView(system);
      },
    });
  }

  private zoomToNeighbourhood(): void {
    const viewport = this.viewport;
    if (!viewport) return;

    // Hide system layer, restore galaxy + hex grid with tweened fade-in
    this.systemLayer?.hide();
    this.galaxy?.restore(this.tweens);
    if (this.hexGrid) {
      this.tweens.to(this.hexGrid.container, "alpha", 1, 0.4);
    }

    // Zoom to sector neighbourhood centred on the system we just left
    const system = this.lastFocusedSystemId
      ? getSystemById(this.lastFocusedSystemId)
      : null;
    const centreX = system ? system.worldX : 0;
    const centreY = system ? system.worldY : 0;
    const targetScale = system
      ? this.fitScale * NEIGHBOURHOOD_SCALE_FACTOR
      : this.fitScale;

    this.isAnimating = true;
    viewport.animate({
      position: { x: centreX, y: centreY },
      scale: targetScale,
      time: TRANSITION_MS,
      ease: "easeInOutCubic",
      callbackOnComplete: () => {
        this.isAnimating = false;
      },
    });
  }

  zoomToGalaxyFit(): void {
    const viewport = this.viewport;
    if (!viewport) return;

    this.isAnimating = true;
    viewport.animate({
      position: { x: 0, y: 0 },
      scale: this.fitScale,
      time: TRANSITION_MS,
      ease: "easeInOutCubic",
      callbackOnComplete: () => {
        this.isAnimating = false;
      },
    });
  }

  private checkZoomThresholds(): void {
    if (this.isAnimating) return;
    const viewport = this.viewport;
    if (!viewport) return;
    const scale = viewport.scaled;

    // Auto-dismiss system view when zooming out
    if (getViewLevel() === "system" && scale < SYSTEM_DISMISS_THRESHOLD) {
      // Direct cleanup — tweened restore
      this.systemLayer?.hide();
      this.galaxy?.restore(this.tweens);
      if (this.hexGrid) {
        this.tweens.to(this.hexGrid.container, "alpha", 1, 0.3);
      }
      this.suppressTransitionAnimation = true;
      setSelectedEntity(null);
      setFocusedSystem(null);
      setViewLevel("galaxy");
      return;
    }

    // Auto-deselect at galaxy level when zoomed out far
    if (
      getViewLevel() === "galaxy" &&
      getSelectedEntity() !== null &&
      scale < this.fitScale * DESELECT_THRESHOLD_FACTOR
    ) {
      setSelectedEntity(null);
    }
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

    this.isAnimating = true;
    viewport.animate({
      position: { x: system.worldX, y: system.worldY },
      scale: Math.max(viewport.scaled, this.fitScale * 2),
      time: TRANSITION_MS,
      ease: "easeInOutCubic",
      callbackOnComplete: () => {
        this.isAnimating = false;
      },
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
