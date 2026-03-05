import { Container, Graphics, Circle } from "pixi.js";
import type { StarSystem, JumpConnection } from "../types/index.js";
import { getTheme, getSpectralColour } from "../ui/theme.js";
import {
  setSelectedEntity,
  setViewLevel,
  setFocusedSystem,
} from "../ui/state.js";

const STAR_RADIUS = 4;
const HIT_RADIUS = 15;
const LINE_WIDTH = 0.5;
const DOUBLE_CLICK_MS = 300;
const HOVER_SCALE = 1.4;

const ROUTE_COLOUR = 0xff8c00;
const ROUTE_WIDTH = 2.5;
const ROUTE_ALPHA = 0.9;

export class GalaxyLayer {
  readonly container: Container;
  readonly starGraphics: Map<string, Graphics> = new Map();
  private systemLookup: Map<string, StarSystem> = new Map();
  private routeOverlay: Graphics;

  // Double-click detection state
  private lastClickId: string | null = null;
  private lastClickTime = 0;

  constructor(systems: StarSystem[], connections: JumpConnection[]) {
    this.container = new Container();
    const theme = getTheme();

    // Build system lookup for connection drawing + interaction
    for (const s of systems) {
      this.systemLookup.set(s.id, s);
    }

    // Draw connections first (renders behind stars)
    const lines = new Graphics();
    for (const conn of connections) {
      const from = this.systemLookup.get(conn.fromId);
      const to = this.systemLookup.get(conn.toId);
      if (!from || !to) continue;

      lines.moveTo(from.worldX, from.worldY);
      lines.lineTo(to.worldX, to.worldY);
    }
    lines.stroke({ width: LINE_WIDTH, color: theme.jumpLine, alpha: theme.jumpLineAlpha });
    this.container.addChild(lines);

    // Route overlay — between jump lines and stars
    this.routeOverlay = new Graphics();
    this.container.addChild(this.routeOverlay);

    // Draw stars — individual Graphics per system for interaction
    for (const system of systems) {
      const star = new Graphics();
      star.circle(0, 0, STAR_RADIUS);
      star.fill(getSpectralColour(system.spectralType));
      star.x = system.worldX;
      star.y = system.worldY;

      // Interaction setup
      star.eventMode = "static";
      star.cursor = "pointer";
      star.hitArea = new Circle(0, 0, HIT_RADIUS);

      // Click / double-click
      star.on("pointertap", () => this.handleStarClick(system));

      // Hover
      star.on("pointerover", () => {
        star.scale.set(HOVER_SCALE);
      });
      star.on("pointerout", () => {
        star.scale.set(1);
      });

      this.starGraphics.set(system.id, star);
      this.container.addChild(star);
    }
  }

  private handleStarClick(system: StarSystem): void {
    const now = performance.now();
    const isDoubleClick =
      this.lastClickId === system.id &&
      now - this.lastClickTime < DOUBLE_CLICK_MS;

    if (isDoubleClick) {
      // Double-click: zoom into system view
      this.lastClickId = null;
      this.lastClickTime = 0;
      setFocusedSystem(system.id);
      setViewLevel("system");
    } else {
      // Single click: select system, show panel
      this.lastClickId = system.id;
      this.lastClickTime = now;
      setSelectedEntity({ type: "system", id: system.id });
    }
  }

  dimExcept(systemId: string): void {
    for (const [id, star] of this.starGraphics) {
      star.alpha = id === systemId ? 1 : 0.15;
    }
  }

  restore(): void {
    for (const star of this.starGraphics.values()) {
      star.alpha = 1;
    }
  }

  showRoute(systemIds: string[]): void {
    this.routeOverlay.clear();
    if (systemIds.length < 2) return;

    for (let i = 0; i < systemIds.length - 1; i++) {
      const from = this.systemLookup.get(systemIds[i]!);
      const to = this.systemLookup.get(systemIds[i + 1]!);
      if (!from || !to) continue;

      this.routeOverlay.moveTo(from.worldX, from.worldY);
      this.routeOverlay.lineTo(to.worldX, to.worldY);
    }
    this.routeOverlay.stroke({
      width: ROUTE_WIDTH,
      color: ROUTE_COLOUR,
      alpha: ROUTE_ALPHA,
    });
  }

  clearRoute(): void {
    this.routeOverlay.clear();
  }
}
