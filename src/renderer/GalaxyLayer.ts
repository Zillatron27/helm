import { CanvasSource, Container, Graphics, Circle, Sprite, Text, Texture, TextStyle } from "pixi.js";
import type { StarSystem, JumpConnection } from "../types/index.js";
import { getTheme, getSpectralColour } from "../ui/theme.js";
import {
  setSelectedEntity,
  setViewLevel,
  setFocusedSystem,
} from "../ui/state.js";
import { getAllCxStations, getGalaxyGatewayConnections, isGatewaySystem } from "../data/cache.js";
import { StarParticles } from "./StarParticles.js";
import { TweenManager } from "./Tween.js";

const STAR_RADIUS = 7;
const HIT_RADIUS = 24;
const DOUBLE_CLICK_MS = 300;
const HOVER_SCALE = 1.4;

// Base stroke widths (at scale 1.0) and clamp ranges
const LINE_BASE = 0.5;
const LINE_MIN = 0.3;
const LINE_MAX = 4.0;

const ROUTE_COLOUR = 0xff8c00;
const ROUTE_BASE = 2.5;
const ROUTE_MIN = 1.5;
const ROUTE_MAX = 8.0;
const ROUTE_ALPHA = 0.9;

// Connection highlight visual parameters
const HIGHLIGHT_COLOUR = 0xff8c00;
const HIGHLIGHT_BASE = 2.0;
const HIGHLIGHT_MIN = 1.0;
const HIGHLIGHT_MAX = 6.0;
const HIGHLIGHT_ALPHA = 0.8;
const DIM_ALPHA = 0.3;
const CONNECTED_ALPHA = 1.0;

// Redraw threshold — skip if scale changed less than 20%
const REDRAW_THRESHOLD_LOW = 0.8;
const REDRAW_THRESHOLD_HIGH = 1.2;

// CX marker visual parameters
const CX_DIAMOND_RADIUS = 40;
const CX_STROKE_WIDTH = 3;
const CX_STROKE_ALPHA = 0.7;
const CX_FILL_ALPHA = 0.1;
const CX_LABEL_SIZE = 40;
const CX_LABEL_ALPHA = 0.8;
const CX_LABEL_OFFSET_Y = 48;

// CX beacon pulse
const CX_PULSE_FREQUENCY = (2 * Math.PI) / 3.0;
const CX_PULSE_STROKE_AMPLITUDE = 0.25;
const CX_PULSE_LABEL_AMPLITUDE = 0.1;

// System view dimming — near-invisible background context
const SYSTEM_VIEW_LINES_ALPHA = 0.05;
const SYSTEM_VIEW_FOCUSED_STAR_ALPHA = 0.3;
const SYSTEM_VIEW_OTHER_STAR_ALPHA = 0.15;

// Ambient system name labels
const LABEL_FONT_SIZE = 18;
const LABEL_TARGET_SCREEN_SIZE = 14;
const LABEL_SCALE_MIN = 0.5;
const LABEL_SCALE_MAX = 4.0;
const LABEL_COLOUR = 0xaaaaaa;
const LABEL_EMPHASIS_COLOUR = 0xe0e0e0;
const LABEL_OFFSET_Y = 15;
const LABEL_SHOW_SCALE = 0.4;
const LABEL_FADE_RANGE = 0.1;
const LABEL_DIM_ALPHA = 0.15;

// CX label zoom-responsive scaling
const CX_LABEL_TARGET_SCREEN_SIZE = 18;
const CX_LABEL_SCALE_MIN = 0.3;
const CX_LABEL_SCALE_MAX = 3.0;

// Star glow parameters — pre-rendered radial gradient sprites
const GLOW_RADIUS_MULT = 2.5;
const GLOW_ALPHA = 0.25;
const GLOW_DIM_FACTOR = 0.15;
const GLOW_HOVER_BOOST = 2.0;

// Gateway visual parameters
const GATEWAY_COLOUR = 0xbb77ff;
const GATEWAY_INDICATOR_RADIUS = 7;
const GATEWAY_INDICATOR_STROKE = 1.5;
const GATEWAY_INDICATOR_ALPHA = 0.8;
const GATEWAY_INDICATOR_OFFSET = 14; // offset from star centre (top-right)
const GATEWAY_ARC_BASE = 1.5;
const GATEWAY_ARC_MIN = 0.5;
const GATEWAY_ARC_MAX = 5.0;
const GATEWAY_ARC_ALPHA = 0.6;
const GATEWAY_ARC_HEIGHT_FACTOR = 0.3;
const GATEWAY_ARC_HEIGHT_MAX = 200;

let glowTexture: Texture | null = null;
function getGlowTexture(): Texture {
  if (glowTexture) return glowTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.4)");
  gradient.addColorStop(0.6, "rgba(255, 255, 255, 0.1)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new Texture({ source: new CanvasSource({ resource: canvas }) });
  return glowTexture;
}

/** Clamp-scaled stroke width: base / scale, clamped to [min, max]. */
function scaledWidth(base: number, min: number, max: number, scale: number): number {
  return Math.min(Math.max(base / scale, min), max);
}

export class GalaxyLayer {
  readonly container: Container;
  readonly starGraphics: Map<string, Graphics> = new Map();
  private systemLookup: Map<string, StarSystem> = new Map();
  private connectionIndex: Map<string, JumpConnection[]> = new Map();
  private connections: JumpConnection[];
  private baseConnections: Graphics;
  private highlightLayer: Graphics;
  private routeOverlay: Graphics;
  private cxMarkers: Container;
  private cxBeacons: { diamond: Graphics; label: Text; phaseOffset: number }[] = [];

  // Gateway layers
  private gatewayIndicators: Container;
  private gatewayArcs: Graphics;
  private lastGatewayArcScale = 0;

  // Highlight state
  private hoveredSystemId: string | null = null;
  private selectedSystemId: string | null = null;
  private isDimmedForSystemView = false;

  // Ambient system name labels
  private ambientLabels: Container;
  private ambientLabelMap: Map<string, Text> = new Map();
  private emphasisedLabelIds: Set<string> = new Set();
  private cxLabelRefs: Text[] = [];

  // Star glows and particles
  private glowContainer: Container;
  private glowGraphics: Map<string, Sprite> = new Map();
  private starParticles: StarParticles;

  // Per-star twinkle
  private twinkleParams: Map<string, { frequency: number; phase: number; amplitude: number }> = new Map();
  private twinkleActive = true;

  // Zoom-responsive redraw tracking
  private lastConnectionScale = 0;
  private lastRouteScale = 0;
  private lastHighlightScale = 0;
  private currentRoute: string[] = [];
  private currentViewportScale = 1;

  // Tween manager for smooth transitions
  private tweens: TweenManager;

  // Double-click detection state
  private lastClickId: string | null = null;
  private lastClickTime = 0;

  constructor(systems: StarSystem[], connections: JumpConnection[], tweens: TweenManager) {
    this.container = new Container();
    this.tweens = tweens;

    // Build system lookup for connection drawing + interaction
    for (const s of systems) {
      this.systemLookup.set(s.id, s);
    }

    // Store connections for redraw
    this.connections = connections;

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

    // Base connections — drawn via redrawConnections(), initially empty
    this.baseConnections = new Graphics();
    this.container.addChild(this.baseConnections);

    // Gateway arcs — curved lines between gateway-linked systems
    this.gatewayArcs = new Graphics();
    this.container.addChild(this.gatewayArcs);

    // Highlight layer — on top of base connections, below route overlay
    this.highlightLayer = new Graphics();
    this.container.addChild(this.highlightLayer);

    // Route overlay — between highlight layer and stars
    this.routeOverlay = new Graphics();
    this.container.addChild(this.routeOverlay);

    // Star glows — pre-rendered radial gradient sprites, no GPU filter needed
    this.glowContainer = new Container();
    this.glowContainer.eventMode = "none";
    this.container.addChild(this.glowContainer);

    // Hover particles — above glows, below labels and stars
    this.starParticles = new StarParticles();
    this.container.addChild(this.starParticles.container);

    // Ambient system name labels — above connections, below stars
    this.ambientLabels = new Container();
    this.ambientLabels.eventMode = "none";
    this.ambientLabels.visible = false;
    this.ambientLabels.alpha = 0;

    const ambientLabelStyle = new TextStyle({
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: LABEL_FONT_SIZE,
      fill: LABEL_COLOUR,
    });

    for (const system of systems) {
      const label = new Text({
        text: system.name || system.naturalId,
        style: ambientLabelStyle.clone(),
      });
      label.anchor.set(0.5, 0);
      label.x = system.worldX;
      label.y = system.worldY + LABEL_OFFSET_Y;
      label.eventMode = "none";
      this.ambientLabels.addChild(label);
      this.ambientLabelMap.set(system.id, label);
    }

    this.container.addChild(this.ambientLabels);

    // Draw stars — individual Graphics per system for interaction
    for (const system of systems) {
      const connCount = system.connectionIds.length;
      const sizeScale = connCount >= 5 ? 1.6 : connCount >= 3 ? 1.3 : 1;
      const radius = STAR_RADIUS * sizeScale;
      const hitRadius = Math.max(HIT_RADIUS, radius + 13);
      const spectralColour = getSpectralColour(system.spectralType);

      // Glow — pre-rendered radial gradient sprite
      const glowSize = radius * GLOW_RADIUS_MULT * 2;
      const glow = new Sprite(getGlowTexture());
      glow.anchor.set(0.5);
      glow.width = glowSize;
      glow.height = glowSize;
      glow.tint = spectralColour;
      glow.alpha = GLOW_ALPHA;
      glow.x = system.worldX;
      glow.y = system.worldY;
      glow.eventMode = "none";
      this.glowContainer.addChild(glow);
      this.glowGraphics.set(system.id, glow);

      // Star dot
      const star = new Graphics();
      star.circle(0, 0, radius);
      star.fill(spectralColour);
      star.x = system.worldX;
      star.y = system.worldY;

      // Interaction setup
      star.eventMode = "static";
      star.cursor = "pointer";
      star.hitArea = new Circle(0, 0, hitRadius);

      // Click / double-click
      star.on("pointertap", () => this.handleStarClick(system));

      // Hover — start particles
      star.on("pointerover", () => {
        star.scale.set(HOVER_SCALE);
        this.starParticles.start(system.worldX, system.worldY, spectralColour);
        this.setHoveredSystem(system.id);
      });
      star.on("pointerout", () => {
        star.scale.set(1);
        this.starParticles.stop();
        this.setHoveredSystem(null);
      });

      this.starGraphics.set(system.id, star);
      this.container.addChild(star);

      // Deterministic twinkle params derived from system ID
      let hash = 0;
      for (let ci = 0; ci < system.id.length; ci++) {
        hash = ((hash << 5) - hash + system.id.charCodeAt(ci)) | 0;
      }
      hash = Math.abs(hash);
      this.twinkleParams.set(system.id, {
        frequency: 0.15 + (hash % 100) / 100 * 0.35,
        phase: ((hash >> 8) % 628) / 100,
        amplitude: 0.25 + ((hash >> 16) % 50) / 200,
      });
    }

    // CX diamond markers — rendered on top of stars, below route overlay
    this.cxMarkers = new Container();
    this.cxMarkers.eventMode = "none";
    const accent = getTheme().accent;

    const cxLabelStyle = new TextStyle({
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: CX_LABEL_SIZE,
      fill: accent,
    });

    let cxIndex = 0;
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
      this.cxLabelRefs.push(label);

      // Stagger phase so CX markers pulse out of sync
      const phaseOffset = cxIndex * (2 * Math.PI / 6);
      this.cxBeacons.push({ diamond, label, phaseOffset });
      cxIndex++;

      this.cxMarkers.addChild(marker);
    }

    // Gateway system indicators — small purple rings offset top-right of star
    this.gatewayIndicators = new Container();
    this.gatewayIndicators.eventMode = "none";
    for (const system of systems) {
      if (!isGatewaySystem(system.id)) continue;
      const indicator = new Graphics();
      indicator.circle(0, 0, GATEWAY_INDICATOR_RADIUS);
      indicator.stroke({ width: GATEWAY_INDICATOR_STROKE, color: GATEWAY_COLOUR, alpha: GATEWAY_INDICATOR_ALPHA });
      indicator.x = system.worldX + GATEWAY_INDICATOR_OFFSET;
      indicator.y = system.worldY - GATEWAY_INDICATOR_OFFSET;
      this.gatewayIndicators.addChild(indicator);
    }

    // Insert CX markers and gateway indicators above stars but below route overlay
    // Stars are already added; re-add route overlay on top
    this.container.removeChild(this.routeOverlay);
    this.container.addChild(this.cxMarkers);
    this.container.addChild(this.gatewayIndicators);
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
    this.currentRoute = systemIds;
    this.lastRouteScale = 0; // Force redraw
    this.drawRoute();
  }

  clearRoute(): void {
    this.currentRoute = [];
    this.routeOverlay.clear();
  }

  private drawRoute(): void {
    this.routeOverlay.clear();
    if (this.currentRoute.length < 2) return;

    const width = scaledWidth(ROUTE_BASE, ROUTE_MIN, ROUTE_MAX, this.currentViewportScale);

    for (let i = 0; i < this.currentRoute.length - 1; i++) {
      const from = this.systemLookup.get(this.currentRoute[i]!);
      const to = this.systemLookup.get(this.currentRoute[i + 1]!);
      if (!from || !to) continue;

      this.routeOverlay.moveTo(from.worldX, from.worldY);
      this.routeOverlay.lineTo(to.worldX, to.worldY);
    }
    this.routeOverlay.stroke({
      width,
      color: ROUTE_COLOUR,
      alpha: ROUTE_ALPHA,
    });
    this.lastRouteScale = this.currentViewportScale;
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

    // No highlight active — restore all stars, glows, and labels to default
    if (!hovered && !selected) {
      this.twinkleActive = true;
      for (const star of this.starGraphics.values()) {
        this.tweens.to(star, "alpha", 1, 0.25);
      }
      for (const glow of this.glowGraphics.values()) {
        this.tweens.to(glow, "alpha", GLOW_ALPHA, 0.25);
      }
      this.tweens.to(this.highlightLayer, "alpha", 0, 0.2);
      this.clearLabelEmphasis();
      return;
    }

    // Pause twinkle while highlight dimming is active
    this.twinkleActive = false;

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
      width: scaledWidth(HIGHLIGHT_BASE, HIGHLIGHT_MIN, HIGHLIGHT_MAX, this.currentViewportScale),
      color: HIGHLIGHT_COLOUR,
      alpha: HIGHLIGHT_ALPHA,
    });
    // Fade in highlight connections
    this.highlightLayer.alpha = 0;
    this.tweens.to(this.highlightLayer, "alpha", 1, 0.2);
    this.lastHighlightScale = this.currentViewportScale;

    // Tween non-connected stars/glows dim, connected ones bright
    const dur = hovered && !selected ? 0.2 : 0.25;
    for (const [id, star] of this.starGraphics) {
      this.tweens.to(star, "alpha", connectedIds.has(id) ? CONNECTED_ALPHA : DIM_ALPHA, dur);
    }
    for (const [id, glow] of this.glowGraphics) {
      if (id === hovered) {
        this.tweens.to(glow, "alpha", Math.min(GLOW_HOVER_BOOST, 1), dur);
      } else if (connectedIds.has(id)) {
        this.tweens.to(glow, "alpha", 1, dur);
      } else {
        this.tweens.to(glow, "alpha", GLOW_DIM_FACTOR, dur);
      }
    }

    this.applyLabelEmphasis(connectedIds);
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

  dimExcept(systemId: string, tw?: TweenManager): void {
    this.isDimmedForSystemView = true;
    this.twinkleActive = false;
    this.hoveredSystemId = null;
    this.selectedSystemId = null;
    this.highlightLayer.clear();
    this.starParticles.clear();

    const dur = tw ? 0.6 : 0;
    if (tw) {
      tw.to(this.baseConnections, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.routeOverlay, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.cxMarkers, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.glowContainer, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.gatewayArcs, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.gatewayIndicators, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      // Fade out ambient labels then hide
      tw.to(this.ambientLabels, "alpha", 0, 0.3);
    } else {
      this.baseConnections.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.routeOverlay.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.cxMarkers.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.glowContainer.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.gatewayArcs.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.gatewayIndicators.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.ambientLabels.visible = false;
    }

    for (const [id, star] of this.starGraphics) {
      const target = id === systemId
        ? SYSTEM_VIEW_FOCUSED_STAR_ALPHA
        : SYSTEM_VIEW_OTHER_STAR_ALPHA;
      if (tw) {
        tw.to(star, "alpha", target, dur);
      } else {
        star.alpha = target;
      }
    }
  }

  restore(tw?: TweenManager): void {
    this.isDimmedForSystemView = false;
    this.twinkleActive = true;
    this.clearLabelEmphasis();

    const dur = tw ? 0.4 : 0;
    if (tw) {
      tw.to(this.baseConnections, "alpha", 1, dur);
      tw.to(this.routeOverlay, "alpha", 1, dur);
      tw.to(this.cxMarkers, "alpha", 1, dur);
      tw.to(this.glowContainer, "alpha", 1, dur);
      tw.to(this.gatewayArcs, "alpha", 1, dur);
      tw.to(this.gatewayIndicators, "alpha", 1, dur);
    } else {
      this.baseConnections.alpha = 1;
      this.routeOverlay.alpha = 1;
      this.cxMarkers.alpha = 1;
      this.glowContainer.alpha = 1;
      this.gatewayArcs.alpha = 1;
      this.gatewayIndicators.alpha = 1;
    }

    for (const star of this.starGraphics.values()) {
      if (tw) {
        tw.to(star, "alpha", 1, dur);
      } else {
        star.alpha = 1;
      }
    }
    for (const glow of this.glowGraphics.values()) {
      if (tw) {
        tw.to(glow, "alpha", GLOW_ALPHA, dur);
      } else {
        glow.alpha = GLOW_ALPHA;
      }
    }
  }

  /** Show/hide ambient labels and scale all labels for consistent screen size. */
  updateLabelVisibility(viewportScale: number): void {
    // Scale CX labels regardless of system view state
    const cxScale = Math.min(Math.max(
      CX_LABEL_TARGET_SCREEN_SIZE / (CX_LABEL_SIZE * viewportScale),
      CX_LABEL_SCALE_MIN,
    ), CX_LABEL_SCALE_MAX);
    for (const label of this.cxLabelRefs) {
      label.scale.set(cxScale);
    }

    if (this.isDimmedForSystemView) return;

    // Ambient label visibility threshold + fade
    if (viewportScale < LABEL_SHOW_SCALE) {
      this.ambientLabels.alpha = 0;
      this.ambientLabels.visible = false;
    } else if (viewportScale < LABEL_SHOW_SCALE + LABEL_FADE_RANGE) {
      this.ambientLabels.visible = true;
      this.ambientLabels.alpha =
        (viewportScale - LABEL_SHOW_SCALE) / LABEL_FADE_RANGE;
    } else {
      this.ambientLabels.visible = true;
      this.ambientLabels.alpha = 1;
    }

    // Scale ambient labels for consistent screen-space sizing
    const labelScale = Math.min(Math.max(
      LABEL_TARGET_SCREEN_SIZE / (LABEL_FONT_SIZE * viewportScale),
      LABEL_SCALE_MIN,
    ), LABEL_SCALE_MAX);
    for (const label of this.ambientLabelMap.values()) {
      label.scale.set(labelScale);
    }
  }

  /** Brighten labels for connected systems, dim the rest. */
  private applyLabelEmphasis(connectedIds: Set<string>): void {
    if (!this.ambientLabels.visible) return;

    // Restore previously emphasised labels first
    this.clearLabelEmphasis();

    for (const [id, label] of this.ambientLabelMap) {
      if (connectedIds.has(id)) {
        label.style.fill = LABEL_EMPHASIS_COLOUR;
        this.tweens.to(label, "alpha", 1.0, 0.2);
        this.emphasisedLabelIds.add(id);
      } else {
        this.tweens.to(label, "alpha", LABEL_DIM_ALPHA, 0.2);
      }
    }
  }

  /** Restore all labels to ambient style. */
  private clearLabelEmphasis(): void {
    for (const id of this.emphasisedLabelIds) {
      const label = this.ambientLabelMap.get(id);
      if (label) {
        label.style.fill = LABEL_COLOUR;
      }
    }
    this.emphasisedLabelIds.clear();

    for (const label of this.ambientLabelMap.values()) {
      this.tweens.to(label, "alpha", 1, 0.2);
    }
  }

  /** Redraw base connections if zoom changed significantly (>20%). */
  redrawConnections(scale: number): void {
    this.currentViewportScale = scale;
    if (this.lastConnectionScale > 0) {
      const ratio = scale / this.lastConnectionScale;
      if (ratio > REDRAW_THRESHOLD_LOW && ratio < REDRAW_THRESHOLD_HIGH) return;
    }
    this.lastConnectionScale = scale;

    const theme = getTheme();
    const width = scaledWidth(LINE_BASE, LINE_MIN, LINE_MAX, scale);

    this.baseConnections.clear();
    for (const conn of this.connections) {
      const from = this.systemLookup.get(conn.fromId);
      const to = this.systemLookup.get(conn.toId);
      if (!from || !to) continue;

      this.baseConnections.moveTo(from.worldX, from.worldY);
      this.baseConnections.lineTo(to.worldX, to.worldY);
    }
    this.baseConnections.stroke({ width, color: theme.jumpLine, alpha: theme.jumpLineAlpha });
  }

  /** Redraw gateway arcs if zoom changed significantly. */
  redrawGatewayArcs(scale: number): void {
    if (this.lastGatewayArcScale > 0) {
      const ratio = scale / this.lastGatewayArcScale;
      if (ratio > REDRAW_THRESHOLD_LOW && ratio < REDRAW_THRESHOLD_HIGH) return;
    }
    this.lastGatewayArcScale = scale;

    const width = scaledWidth(GATEWAY_ARC_BASE, GATEWAY_ARC_MIN, GATEWAY_ARC_MAX, scale);
    const gwConns = getGalaxyGatewayConnections();

    this.gatewayArcs.clear();
    for (const gw of gwConns) {
      const from = this.systemLookup.get(gw.fromSystemId);
      const to = this.systemLookup.get(gw.toSystemId);
      if (!from || !to) continue;

      const midX = (from.worldX + to.worldX) / 2;
      const midY = (from.worldY + to.worldY) / 2;
      const dx = to.worldX - from.worldX;
      const dy = to.worldY - from.worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const arcHeight = Math.min(dist * GATEWAY_ARC_HEIGHT_FACTOR, GATEWAY_ARC_HEIGHT_MAX);

      this.gatewayArcs.moveTo(from.worldX, from.worldY);
      this.gatewayArcs.quadraticCurveTo(midX, midY - arcHeight, to.worldX, to.worldY);
    }
    this.gatewayArcs.stroke({ width, color: GATEWAY_COLOUR, alpha: GATEWAY_ARC_ALPHA });
  }

  /** Redraw route overlay if zoom changed significantly. */
  redrawRoute(scale: number): void {
    if (this.currentRoute.length < 2) return;
    if (this.lastRouteScale > 0) {
      const ratio = scale / this.lastRouteScale;
      if (ratio > REDRAW_THRESHOLD_LOW && ratio < REDRAW_THRESHOLD_HIGH) return;
    }
    this.drawRoute();
  }

  /** Redraw highlight connections if zoom changed significantly. */
  updateHighlightScale(scale: number): void {
    if (!this.hoveredSystemId && !this.selectedSystemId) return;
    if (this.lastHighlightScale > 0) {
      const ratio = scale / this.lastHighlightScale;
      if (ratio > REDRAW_THRESHOLD_LOW && ratio < REDRAW_THRESHOLD_HIGH) return;
    }
    this.updateHighlight();
  }

  /** Advance hover particle animation (called every frame). */
  updateParticles(dt: number): void {
    this.starParticles.update(dt);
  }

  /** Subtle per-star brightness oscillation. */
  updateTwinkle(elapsed: number): void {
    if (!this.twinkleActive) return;

    const TAU = Math.PI * 2;
    for (const [id, params] of this.twinkleParams) {
      // Map sin [-1,1] → [0,1] so full cycle is visible (alpha never exceeds 1.0)
      const wave = 0.5 + 0.5 * Math.sin(elapsed * params.frequency * TAU + params.phase);
      const starAlpha = 1.0 - params.amplitude * (1.0 - wave);
      const star = this.starGraphics.get(id);
      if (star) star.alpha = starAlpha;
      const glow = this.glowGraphics.get(id);
      if (glow) glow.alpha = GLOW_ALPHA * starAlpha;
    }
  }

  setGatewaysVisible(visible: boolean): void {
    this.gatewayArcs.visible = visible;
    this.gatewayIndicators.visible = visible;
  }

  /** Pulse CX diamond markers like station beacons. */
  updateCxPulse(elapsed: number): void {
    if (this.isDimmedForSystemView) return;

    for (const cx of this.cxBeacons) {
      const pulse = Math.sin(elapsed * CX_PULSE_FREQUENCY + cx.phaseOffset);
      cx.diamond.alpha = CX_STROKE_ALPHA + CX_PULSE_STROKE_AMPLITUDE * pulse;
      cx.label.alpha = CX_LABEL_ALPHA + CX_PULSE_LABEL_AMPLITUDE * pulse;
    }
  }
}
