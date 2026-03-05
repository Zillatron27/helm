import { Container, Graphics, Circle, Text, TextStyle } from "pixi.js";
import type { StarSystem, JumpConnection } from "../types/index.js";
import { getTheme, getSpectralColour } from "../ui/theme.js";
import {
  setSelectedEntity,
  setViewLevel,
  setFocusedSystem,
} from "../ui/state.js";
import { getAllCxStations } from "../data/cache.js";

const STAR_RADIUS = 7;
const HIT_RADIUS = 24;
const LINE_WIDTH = 0.5;
const DOUBLE_CLICK_MS = 300;
const HOVER_SCALE = 1.4;

const ROUTE_COLOUR = 0xff8c00;
const ROUTE_WIDTH = 2.5;
const ROUTE_ALPHA = 0.9;

// Connection highlight visual parameters
const HIGHLIGHT_COLOUR = 0xff8c00;
const HIGHLIGHT_WIDTH = 2.0;
const HIGHLIGHT_ALPHA = 0.8;
const DIM_ALPHA = 0.3;
const CONNECTED_ALPHA = 1.0;

// CX marker visual parameters
const CX_DIAMOND_RADIUS = 40;
const CX_STROKE_WIDTH = 3;
const CX_STROKE_ALPHA = 0.7;
const CX_FILL_ALPHA = 0.1;
const CX_LABEL_SIZE = 28;
const CX_LABEL_ALPHA = 0.8;
const CX_LABEL_OFFSET_Y = 48;

// System view dimming — near-invisible background context
const SYSTEM_VIEW_LINES_ALPHA = 0.05;
const SYSTEM_VIEW_FOCUSED_STAR_ALPHA = 0.3;
const SYSTEM_VIEW_OTHER_STAR_ALPHA = 0.15;

export class GalaxyLayer {
  readonly container: Container;
  readonly starGraphics: Map<string, Graphics> = new Map();
  private systemLookup: Map<string, StarSystem> = new Map();
  private connectionIndex: Map<string, JumpConnection[]> = new Map();
  private baseConnections: Graphics;
  private highlightLayer: Graphics;
  private routeOverlay: Graphics;
  private cxMarkers: Container;

  // Highlight state
  private hoveredSystemId: string | null = null;
  private selectedSystemId: string | null = null;
  private isDimmedForSystemView = false;

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

    // Build connection index: systemId → connections touching that system
    for (const conn of connections) {
      const fromList = this.connectionIndex.get(conn.fromId);
      if (fromList) {
        fromList.push(conn);
      } else {
        this.connectionIndex.set(conn.fromId, [conn]);
      }
      const toList = this.connectionIndex.get(conn.toId);
      if (toList) {
        toList.push(conn);
      } else {
        this.connectionIndex.set(conn.toId, [conn]);
      }
    }

    // Draw base connections first (renders behind everything)
    this.baseConnections = new Graphics();
    for (const conn of connections) {
      const from = this.systemLookup.get(conn.fromId);
      const to = this.systemLookup.get(conn.toId);
      if (!from || !to) continue;

      this.baseConnections.moveTo(from.worldX, from.worldY);
      this.baseConnections.lineTo(to.worldX, to.worldY);
    }
    this.baseConnections.stroke({ width: LINE_WIDTH, color: theme.jumpLine, alpha: theme.jumpLineAlpha });
    this.container.addChild(this.baseConnections);

    // Highlight layer — on top of base connections, below route overlay
    this.highlightLayer = new Graphics();
    this.container.addChild(this.highlightLayer);

    // Route overlay — between highlight layer and stars
    this.routeOverlay = new Graphics();
    this.container.addChild(this.routeOverlay);

    // Draw stars — individual Graphics per system for interaction
    for (const system of systems) {
      const connCount = system.connectionIds.length;
      const sizeScale = connCount >= 5 ? 1.6 : connCount >= 3 ? 1.3 : 1;
      const radius = STAR_RADIUS * sizeScale;
      const hitRadius = Math.max(HIT_RADIUS, radius + 13);

      const star = new Graphics();
      star.circle(0, 0, radius);
      star.fill(getSpectralColour(system.spectralType));
      star.x = system.worldX;
      star.y = system.worldY;

      // Interaction setup
      star.eventMode = "static";
      star.cursor = "pointer";
      star.hitArea = new Circle(0, 0, hitRadius);

      // Click / double-click
      star.on("pointertap", () => this.handleStarClick(system));

      // Hover
      star.on("pointerover", () => {
        star.scale.set(HOVER_SCALE);
        this.setHoveredSystem(system.id);
      });
      star.on("pointerout", () => {
        star.scale.set(1);
        this.setHoveredSystem(null);
      });

      this.starGraphics.set(system.id, star);
      this.container.addChild(star);
    }

    // CX diamond markers — rendered on top of stars, below route overlay
    this.cxMarkers = new Container();
    this.cxMarkers.eventMode = "none";
    const accent = theme.accent;

    const cxLabelStyle = new TextStyle({
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: CX_LABEL_SIZE,
      fill: accent,
    });

    for (const station of getAllCxStations()) {
      const sys = this.systemLookup.get(station.SystemId);
      if (!sys) continue;

      const marker = new Container();
      marker.x = sys.worldX;
      marker.y = sys.worldY;

      // Diamond shape
      const diamond = new Graphics();
      const r = CX_DIAMOND_RADIUS;
      diamond.moveTo(0, -r);
      diamond.lineTo(r, 0);
      diamond.lineTo(0, r);
      diamond.lineTo(-r, 0);
      diamond.closePath();
      diamond.fill({ color: accent, alpha: CX_FILL_ALPHA });
      diamond.stroke({ width: CX_STROKE_WIDTH, color: accent, alpha: CX_STROKE_ALPHA });
      marker.addChild(diamond);

      // Label
      const label = new Text({ text: station.ComexCode, style: cxLabelStyle });
      label.alpha = CX_LABEL_ALPHA;
      label.anchor.set(0.5, 0);
      label.y = CX_LABEL_OFFSET_Y;
      marker.addChild(label);

      this.cxMarkers.addChild(marker);
    }

    // Insert CX markers above stars but below route overlay
    // Stars are already added; re-add route overlay on top
    this.container.removeChild(this.routeOverlay);
    this.container.addChild(this.cxMarkers);
    this.container.addChild(this.routeOverlay);
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

  setSelectedSystem(systemId: string | null): void {
    this.selectedSystemId = systemId;
    this.updateHighlight();
  }

  private setHoveredSystem(systemId: string | null): void {
    if (this.isDimmedForSystemView) return;
    this.hoveredSystemId = systemId;
    this.updateHighlight();
  }

  private updateHighlight(): void {
    if (this.isDimmedForSystemView) return;

    this.highlightLayer.clear();

    const hovered = this.hoveredSystemId;
    const selected = this.selectedSystemId;

    // No highlight active — restore all stars to default
    if (!hovered && !selected) {
      for (const star of this.starGraphics.values()) {
        star.alpha = 1;
      }
      return;
    }

    // Collect all connected system IDs and draw highlighted connections
    const connectedIds = new Set<string>();

    if (selected) {
      connectedIds.add(selected);
      this.drawSystemConnections(selected, connectedIds);
    }

    if (hovered && hovered !== selected) {
      connectedIds.add(hovered);
      this.drawSystemConnections(hovered, connectedIds);
    }

    this.highlightLayer.stroke({
      width: HIGHLIGHT_WIDTH,
      color: HIGHLIGHT_COLOUR,
      alpha: HIGHLIGHT_ALPHA,
    });

    // Dim non-connected stars, brighten connected ones
    for (const [id, star] of this.starGraphics) {
      star.alpha = connectedIds.has(id) ? CONNECTED_ALPHA : DIM_ALPHA;
    }
  }

  private drawSystemConnections(systemId: string, connectedIds: Set<string>): void {
    const conns = this.connectionIndex.get(systemId);
    if (!conns) return;

    for (const conn of conns) {
      const from = this.systemLookup.get(conn.fromId);
      const to = this.systemLookup.get(conn.toId);
      if (!from || !to) continue;

      this.highlightLayer.moveTo(from.worldX, from.worldY);
      this.highlightLayer.lineTo(to.worldX, to.worldY);

      // Track the other end as connected
      const otherId = conn.fromId === systemId ? conn.toId : conn.fromId;
      connectedIds.add(otherId);
    }
  }

  dimExcept(systemId: string): void {
    this.isDimmedForSystemView = true;
    this.hoveredSystemId = null;
    this.selectedSystemId = null;
    this.highlightLayer.clear();
    this.baseConnections.alpha = SYSTEM_VIEW_LINES_ALPHA;
    this.routeOverlay.alpha = SYSTEM_VIEW_LINES_ALPHA;
    this.cxMarkers.alpha = SYSTEM_VIEW_LINES_ALPHA;
    for (const [id, star] of this.starGraphics) {
      star.alpha = id === systemId
        ? SYSTEM_VIEW_FOCUSED_STAR_ALPHA
        : SYSTEM_VIEW_OTHER_STAR_ALPHA;
    }
  }

  restore(): void {
    this.isDimmedForSystemView = false;
    this.baseConnections.alpha = 1;
    this.routeOverlay.alpha = 1;
    this.cxMarkers.alpha = 1;
    for (const star of this.starGraphics.values()) {
      star.alpha = 1;
    }
  }
}
