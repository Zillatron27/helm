import { CanvasSource, Container, Graphics, Circle, Sprite, Text, Texture, TextStyle } from "pixi.js";
import type { StarSystem, JumpConnection } from "../types/index.js";
import { getTheme, getSpectralColour } from "../ui/theme.js";
import {
  setSelectedEntity,
  setViewLevel,
  setFocusedSystem,
} from "../ui/state.js";
import { getAllCxStations, getGalaxyGatewayConnections, isGatewaySystem } from "../data/cache.js";
import { isSettledSystem } from "../data/siteCounts.js";
import { getEmpireSystemIds } from "../data/empireIndex.js";
import { getBridgeSnapshot } from "../ui/state.js";
import { getSystemUuidByNaturalId } from "../data/searchIndex.js";
import { buildChevronStack, CHEVRON_GLYPH_SIZE } from "./ChevronStack.js";
import { showMapTooltip, hideMapTooltip } from "../ui/MapTooltip.js";
import { formatDockedShipTooltip } from "../data/shipTooltip.js";
import type { ShipSummary } from "../data/bridge-types.js";
import { StarParticles } from "./StarParticles.js";
import { TweenManager } from "./Tween.js";
import { yieldToMain } from "../util/yieldToMain.js";

const STAR_RADIUS = 12;
const HIT_RADIUS = 24;
const DOUBLE_CLICK_MS = 300;
const HOVER_SCALE = 1.4;

// Base stroke widths (at scale 1.0) and clamp ranges
const LINE_BASE = 0.5;
const LINE_MIN = 0.3;
const LINE_MAX = 4.0;

const ROUTE_COLOUR = 0xff8c00;
const ROUTE_GATEWAY_COLOUR = 0xffdd00;
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

// Empire highlight filter — per-system brightness control
const DIM_HIGHLIGHT_ALPHA = 0.12;

// Ambient system name labels
const LABEL_FONT_SIZE = 18;
const LABEL_TARGET_SCREEN_SIZE = 14;
const LABEL_SCALE_MIN = 0.7;
const LABEL_SCALE_MAX = 4.0;
const LABEL_COLOUR = 0xaaaaaa;
const LABEL_EMPHASIS_COLOUR = 0xe0e0e0;
const LABEL_OFFSET_Y = 26;
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

// System selection halo — matches the planet selection style. Sits at a
// fixed gap outside the star edge regardless of star size, mirroring the
// system-view halo's relationship to a planet (HALO_GAP in SystemLayer).
const SYSTEM_HALO_GAP = 6;
const SYSTEM_HALO_COLOUR = 0x3399ff;
const SYSTEM_HALO_ALPHA = 0.7;
const SYSTEM_HALO_STROKE = 2.0;
const SYSTEM_HALO_ARC_SPAN = Math.PI * 0.7;

// Resource filter concentration indicators
const RESOURCE_COLOUR = 0x00ccaa;
const RESOURCE_DOT_MAX_RADIUS = 20;
const RESOURCE_DOT_MIN_RADIUS = 4;
const RESOURCE_DOT_ALPHA = 0.7;

// Settled system ring indicators
const SETTLED_COLOUR = 0xc4a35a;
const SETTLED_RING_ALPHA = 0.345;
const SETTLED_RING_STROKE = 1.0;
const SETTLED_RING_RADIUS_MULT = 3.2;
const SETTLED_GLOW_SIZE = 14;
const SETTLED_GLOW_ALPHA = 0.86;
const SETTLED_ROTATION_PERIOD = 5.0;

// Empire base ring indicators — rendered on systems containing user sites
// whenever the bridge snapshot is present. Fixed gap outside the star edge,
// mirroring the system-view ring's relationship to a planet
// (EMPIRE_PLANET_RING_GAP in SystemLayer). The gap is intentionally smaller
// than SYSTEM_HALO_GAP so a selected empire system nests cleanly:
// star → empire ring → halo.
const EMPIRE_RING_GAP = 4;
const EMPIRE_RING_STROKE = 1.5;
const EMPIRE_RING_ALPHA = 0.7;

// Galaxy-view ship stack — same chevron signature as the system-view
// per-planet stack, but aggregated to the system level (any docked ship
// in the system, including CX-docked, contributes to the system's count).
// Anchored just outside the empire ring's outer edge (or star edge when
// the system isn't empire-owned).
const SHIP_STACK_OFFSET_FROM_RING = 6;
const SHIP_STACK_ALPHA = 1.0;

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

  // Empire highlight filter — which systems stay bright (null = no filter)
  private highlightedSystems: Set<string> | null = null;

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

  // Settled system indicators
  private settledRingsStatic: Container;
  private settledRingsAnimated: Container;
  private settledEntries: Array<{ sprite: Sprite; phase: number; radius: number; cx: number; cy: number }> = [];
  private settledVisible = false;

  // Resource filter concentration indicators
  private resourceIndicators: Container;

  // Empire base rings — owned-system markers from bridge snapshot
  private empireBaseRings: Container;

  // Empire ship stacks — per-system docked-ship indicators from snapshot
  private empireShipStacks: Container;

  // Generation counter — async concentration runs bail when superseded.
  private resourceConcentrationGen = 0;

  // System selection halo
  private selectionHalo: Graphics;

  // Bridge API: click interceptor (set by MapRenderer)
  systemClickInterceptor: ((systemId: string, screenX: number, screenY: number) => boolean) | null = null;

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

    // Settled system ring indicators — above glows, below particles/stars
    this.settledRingsStatic = new Container();
    this.settledRingsStatic.eventMode = "none";
    this.settledRingsStatic.visible = false;
    this.container.addChild(this.settledRingsStatic);

    this.settledRingsAnimated = new Container();
    this.settledRingsAnimated.eventMode = "none";
    this.settledRingsAnimated.visible = false;
    this.container.addChild(this.settledRingsAnimated);

    // Build settled indicators from site count data
    this.buildSettledIndicators(systems);

    // Resource filter concentration indicators — above settled rings, below particles
    this.resourceIndicators = new Container();
    this.resourceIndicators.eventMode = "none";
    this.resourceIndicators.visible = false;
    this.container.addChild(this.resourceIndicators);

    // Empire base rings — owned-system markers, above resource indicators,
    // below particles / labels / stars / CX markers / gateway indicators.
    // Populated lazily by rebuildEmpireRings(); empty until bridge snapshot arrives.
    this.empireBaseRings = new Container();
    this.empireBaseRings.eventMode = "none";
    this.container.addChild(this.empireBaseRings);

    // Empire ship stacks — per-system docked-ship indicators. Same z-order
    // tier as base rings; populated by rebuildEmpireShipStacks(). Container
    // is passive (doesn't intercept) so its interactive child stacks
    // dispatch hover events for the tooltip.
    this.empireShipStacks = new Container();
    this.empireShipStacks.eventMode = "passive";
    this.container.addChild(this.empireShipStacks);

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
      star.on("pointertap", (e) => this.handleStarClick(system, e.globalX, e.globalY));

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

      // Label — use station natural ID (e.g. "ANT") instead of comex code ("AI1")
      const label = new Text({ text: station.NaturalId, style: cxLabelStyle });
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

      // Hide ambient system name label — CX code replaces it
      const ambientLabel = this.ambientLabelMap.get(station.SystemId);
      if (ambientLabel) ambientLabel.visible = false;
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
    this.selectionHalo = new Graphics();
    this.selectionHalo.eventMode = "none";
    this.selectionHalo.visible = false;

    this.container.addChild(this.cxMarkers);
    this.container.addChild(this.gatewayIndicators);
    this.container.addChild(this.selectionHalo);
    this.container.addChild(this.routeOverlay);
  }

  private handleStarClick(system: StarSystem, screenX: number, screenY: number): void {
    const now = performance.now();
    const isDoubleClick =
      this.lastClickId === system.id &&
      now - this.lastClickTime < DOUBLE_CLICK_MS;

    if (isDoubleClick) {
      // Double-click: zoom into system view (always proceeds, not gated by interceptor)
      this.lastClickId = null;
      this.lastClickTime = 0;
      setFocusedSystem(system.id);
      setViewLevel("system");
    } else {
      // Single click: let interceptor suppress if it handles the click
      this.lastClickId = system.id;
      this.lastClickTime = now;
      if (this.systemClickInterceptor?.(system.id, screenX, screenY)) return;
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

    // Build gateway pair lookup
    const gwConns = getGalaxyGatewayConnections();
    const gwPairs = new Set<string>();
    for (const gw of gwConns) {
      const [a, b] = gw.fromSystemId < gw.toSystemId
        ? [gw.fromSystemId, gw.toSystemId]
        : [gw.toSystemId, gw.fromSystemId];
      gwPairs.add(`${a}:${b}`);
    }

    // Jump segments — straight orange lines
    let hasJumps = false;
    for (let i = 0; i < this.currentRoute.length - 1; i++) {
      const fromId = this.currentRoute[i]!;
      const toId = this.currentRoute[i + 1]!;
      const [a, b] = fromId < toId ? [fromId, toId] : [toId, fromId];
      if (gwPairs.has(`${a}:${b}`)) continue;

      const from = this.systemLookup.get(fromId);
      const to = this.systemLookup.get(toId);
      if (!from || !to) continue;

      this.routeOverlay.moveTo(from.worldX, from.worldY);
      this.routeOverlay.lineTo(to.worldX, to.worldY);
      hasJumps = true;
    }
    if (hasJumps) {
      this.routeOverlay.stroke({ width, color: ROUTE_COLOUR, alpha: ROUTE_ALPHA });
    }

    // Gateway segments — yellow bezier arcs
    let hasGateways = false;
    for (let i = 0; i < this.currentRoute.length - 1; i++) {
      const fromId = this.currentRoute[i]!;
      const toId = this.currentRoute[i + 1]!;
      const [a, b] = fromId < toId ? [fromId, toId] : [toId, fromId];
      if (!gwPairs.has(`${a}:${b}`)) continue;

      const from = this.systemLookup.get(fromId);
      const to = this.systemLookup.get(toId);
      if (!from || !to) continue;

      const midX = (from.worldX + to.worldX) / 2;
      const midY = (from.worldY + to.worldY) / 2;
      const dx = to.worldX - from.worldX;
      const dy = to.worldY - from.worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const arcHeight = Math.min(dist * GATEWAY_ARC_HEIGHT_FACTOR, GATEWAY_ARC_HEIGHT_MAX);

      this.routeOverlay.moveTo(from.worldX, from.worldY);
      this.routeOverlay.quadraticCurveTo(midX, midY - arcHeight, to.worldX, to.worldY);
      hasGateways = true;
    }
    if (hasGateways) {
      this.routeOverlay.stroke({ width, color: ROUTE_GATEWAY_COLOUR, alpha: ROUTE_ALPHA });
    }

    this.lastRouteScale = this.currentViewportScale;
  }

  setSelectedSystem(systemId: string | null): void {
    this.selectedSystemId = systemId;
    this.updateSelectionHalo();
    this.updateHighlight();
  }

  private updateSelectionHalo(): void {
    this.selectionHalo.clear();
    this.selectionHalo.visible = false;

    const id = this.selectedSystemId;
    if (!id) return;

    const system = this.systemLookup.get(id);
    if (!system) return;

    // Halo sits at a fixed gap outside the star edge, regardless of star
    // size — matches the system-view planet halo behaviour.
    const connCount = system.connectionIds.length;
    const sizeScale = connCount >= 5 ? 1.6 : connCount >= 3 ? 1.3 : 1;
    const haloRadius = STAR_RADIUS * sizeScale + SYSTEM_HALO_GAP;

    this.selectionHalo.x = system.worldX;
    this.selectionHalo.y = system.worldY;
    this.selectionHalo.arc(0, 0, haloRadius, -SYSTEM_HALO_ARC_SPAN / 2, SYSTEM_HALO_ARC_SPAN / 2);
    this.selectionHalo.stroke({ width: SYSTEM_HALO_STROKE, color: SYSTEM_HALO_COLOUR, alpha: SYSTEM_HALO_ALPHA });
    this.selectionHalo.arc(0, 0, haloRadius, Math.PI - SYSTEM_HALO_ARC_SPAN / 2, Math.PI + SYSTEM_HALO_ARC_SPAN / 2);
    this.selectionHalo.stroke({ width: SYSTEM_HALO_STROKE, color: SYSTEM_HALO_COLOUR, alpha: SYSTEM_HALO_ALPHA });
    this.selectionHalo.visible = true;
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
    const hl = this.highlightedSystems;

    // No hover active — restore all stars, glows, and labels to default
    // (respecting empire highlight filter when active)
    // Selection alone shows halo but doesn't dim/highlight connections
    if (!hovered) {
      this.twinkleActive = !hl;
      for (const [id, star] of this.starGraphics) {
        const target = hl && !hl.has(id) ? DIM_HIGHLIGHT_ALPHA : 1;
        this.tweens.to(star, "alpha", target, 0.25);
      }
      for (const [id, glow] of this.glowGraphics) {
        const target = hl && !hl.has(id) ? GLOW_ALPHA * DIM_HIGHLIGHT_ALPHA : GLOW_ALPHA;
        this.tweens.to(glow, "alpha", target, 0.25);
      }
      this.tweens.to(this.highlightLayer, "alpha", 0, 0.2);
      this.clearLabelEmphasis();
      // Redraw connections with per-line alpha if empire highlight is active
      if (hl) {
        setTimeout(() => this.redrawWithHighlight(), 300);
      }
      return;
    }

    // Pause twinkle while highlight dimming is active
    this.twinkleActive = false;

    // Collect all connected system IDs — connection highlight only on hover
    const connectedIds = new Set<string>();
    connectedIds.add(hovered);
    this.drawSystemConnections(hovered, connectedIds);

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
    // When empire highlight is active, "bright" for non-empire stars
    // is still DIM_HIGHLIGHT_ALPHA (they don't get boosted by selection)
    const dur = 0.2;
    for (const [id, star] of this.starGraphics) {
      let target: number;
      if (connectedIds.has(id)) {
        target = CONNECTED_ALPHA;
      } else if (hl && !hl.has(id)) {
        target = DIM_HIGHLIGHT_ALPHA;
      } else {
        target = DIM_ALPHA;
      }
      this.tweens.to(star, "alpha", target, dur);
    }
    for (const [id, glow] of this.glowGraphics) {
      let target: number;
      if (id === hovered) {
        target = Math.min(GLOW_HOVER_BOOST, 1);
      } else if (connectedIds.has(id)) {
        target = 1;
      } else if (hl && !hl.has(id)) {
        target = GLOW_ALPHA * DIM_HIGHLIGHT_ALPHA;
      } else {
        target = GLOW_DIM_FACTOR;
      }
      this.tweens.to(glow, "alpha", target, dur);
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

  // --- Settled Indicators ---

  private buildSettledIndicators(systems: StarSystem[]): void {
    for (const system of systems) {
      if (!isSettledSystem(system.id)) continue;

      const connCount = system.connectionIds.length;
      const sizeScale = connCount >= 5 ? 1.6 : connCount >= 3 ? 1.3 : 1;
      const ringRadius = STAR_RADIUS * sizeScale * SETTLED_RING_RADIUS_MULT;

      // Static base ring — subtle thin circle
      const ring = new Graphics();
      ring.circle(0, 0, ringRadius);
      ring.stroke({ width: SETTLED_RING_STROKE, color: SETTLED_COLOUR, alpha: SETTLED_RING_ALPHA });
      ring.x = system.worldX;
      ring.y = system.worldY;
      this.settledRingsStatic.addChild(ring);

      // Orbiting glow sprite — reuses the star glow texture, tinted amber
      const glow = new Sprite(getGlowTexture());
      glow.anchor.set(0.5);
      glow.width = SETTLED_GLOW_SIZE;
      glow.height = SETTLED_GLOW_SIZE;
      glow.tint = SETTLED_COLOUR;
      glow.alpha = SETTLED_GLOW_ALPHA;
      this.settledRingsAnimated.addChild(glow);

      // Phase offset from system ID hash for staggered rotation
      let hash = 0;
      for (let i = 0; i < system.id.length; i++) {
        hash = ((hash << 5) - hash + system.id.charCodeAt(i)) | 0;
      }
      const phase = (Math.abs(hash) % 1000) / 1000 * Math.PI * 2;

      this.settledEntries.push({ sprite: glow, phase, radius: ringRadius, cx: system.worldX, cy: system.worldY });
    }
  }

  setSettledVisible(visible: boolean): void {
    this.settledVisible = visible;
    if (visible) {
      this.settledRingsStatic.visible = true;
      this.settledRingsAnimated.visible = true;
      this.settledRingsStatic.alpha = 0;
      this.settledRingsAnimated.alpha = 0;
      this.tweens.to(this.settledRingsStatic, "alpha", 1, 0.4);
      this.tweens.to(this.settledRingsAnimated, "alpha", 1, 0.4);
    } else {
      this.tweens.to(this.settledRingsStatic, "alpha", 0, 0.3);
      this.tweens.to(this.settledRingsAnimated, "alpha", 0, 0.3);
      setTimeout(() => {
        if (!this.settledVisible) {
          this.settledRingsStatic.visible = false;
          this.settledRingsAnimated.visible = false;
        }
      }, 300);
    }
  }

  updateSettledRings(elapsed: number): void {
    if (!this.settledVisible) return;

    for (const entry of this.settledEntries) {
      const angle = (elapsed / SETTLED_ROTATION_PERIOD) * Math.PI * 2 + entry.phase;
      entry.sprite.x = entry.cx + Math.cos(angle) * entry.radius;
      entry.sprite.y = entry.cy + Math.sin(angle) * entry.radius;
    }
  }

  /**
   * Rebuild empire base rings from the current bridge snapshot's empire
   * system set. Cheap to run — empire sets are typically <100 entries.
   * Called on snapshot change, index change, and theme rebuild.
   */
  rebuildEmpireRings(): void {
    this.empireBaseRings.removeChildren();
    const empireSet = getEmpireSystemIds();
    if (empireSet.size === 0) return;

    const accent = getTheme().accent;

    for (const systemId of empireSet) {
      const system = this.systemLookup.get(systemId);
      if (!system) continue;

      const connCount = system.connectionIds.length;
      const sizeScale = connCount >= 5 ? 1.6 : connCount >= 3 ? 1.3 : 1;
      const ringRadius = STAR_RADIUS * sizeScale + EMPIRE_RING_GAP;

      const ring = new Graphics();
      ring.circle(0, 0, ringRadius);
      ring.stroke({ width: EMPIRE_RING_STROKE, color: accent, alpha: EMPIRE_RING_ALPHA });
      ring.x = system.worldX;
      ring.y = system.worldY;

      this.empireBaseRings.addChild(ring);
    }
  }

  /**
   * Rebuild per-system docked-ship stacks from the current bridge
   * snapshot. A system contributes to the count for any docked ship
   * inside it (planet-docked or CX-docked, status !== IN_FLIGHT).
   * Glyph count: 1 for a single ship, 3 for 2+. Stack anchors just
   * outside the empire ring footprint (or star edge when the system
   * isn't empire-owned).
   */
  rebuildEmpireShipStacks(): void {
    this.empireShipStacks.removeChildren();

    const snapshot = getBridgeSnapshot();
    if (!snapshot || snapshot.ships.length === 0) return;

    // Aggregate ships per system natural ID. CX-docked ships count here
    // (a different rule from system view, which can't render them
    // without a CX grid — this aggregate-level signal still wants to
    // tell the player "ships are present in this system").
    const shipsPerSystem = new Map<string, ShipSummary[]>();
    for (const ship of snapshot.ships) {
      if (ship.status === "IN_FLIGHT") continue;
      const sysNid = ship.locationSystemNaturalId;
      if (!sysNid) continue;
      const list = shipsPerSystem.get(sysNid);
      if (list) list.push(ship);
      else shipsPerSystem.set(sysNid, [ship]);
    }
    if (shipsPerSystem.size === 0) return;

    const accent = getTheme().accent;
    const half = CHEVRON_GLYPH_SIZE / 2;

    for (const [sysNid, ships] of shipsPerSystem) {
      const uuid = getSystemUuidByNaturalId(sysNid);
      if (!uuid) continue;
      const system = this.systemLookup.get(uuid);
      if (!system) continue;

      const connCount = system.connectionIds.length;
      const sizeScale = connCount >= 5 ? 1.6 : connCount >= 3 ? 1.3 : 1;
      const ringRadius = STAR_RADIUS * sizeScale + EMPIRE_RING_GAP;

      const { graphics: stack, clusterCentre } = buildChevronStack(
        ships.length,
        accent,
        SHIP_STACK_ALPHA,
      );
      stack.x = system.worldX + ringRadius + SHIP_STACK_OFFSET_FROM_RING + half;
      stack.y = system.worldY;

      // Hover → ship-list tooltip, same singleton overlay used in system view.
      // Bail when galaxy view is dimmed (under the system view); the stacks
      // remain hit-testable but firing the tooltip there would surface
      // background content over the foreground panel.
      stack.eventMode = "static";
      stack.cursor = "default";
      stack.hitArea = new Circle(clusterCentre, 0, CHEVRON_GLYPH_SIZE);
      const tooltip = formatDockedShipTooltip(ships, { systemNaturalId: sysNid });
      stack.on("pointerover", (e) => {
        if (this.isDimmedForSystemView) return;
        showMapTooltip(e.globalX, e.globalY, tooltip);
      });
      stack.on("pointerout", () => {
        hideMapTooltip();
      });

      this.empireShipStacks.addChild(stack);
    }
  }

  dimExcept(systemId: string, tw?: TweenManager): void {
    this.isDimmedForSystemView = true;
    this.twinkleActive = false;
    this.hoveredSystemId = null;
    this.selectedSystemId = null;
    this.highlightLayer.clear();
    this.selectionHalo.clear();
    this.selectionHalo.visible = false;
    this.starParticles.clear();
    // Any tooltip opened from a galaxy ship stack would otherwise float
    // over the system view until the pointer moves off the stack.
    hideMapTooltip();

    const dur = tw ? 0.6 : 0;
    if (tw) {
      tw.to(this.baseConnections, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.routeOverlay, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.cxMarkers, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.glowContainer, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.gatewayArcs, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.gatewayIndicators, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.settledRingsStatic, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.settledRingsAnimated, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.resourceIndicators, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.empireBaseRings, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      tw.to(this.empireShipStacks, "alpha", SYSTEM_VIEW_LINES_ALPHA, dur);
      // Fade out ambient labels then hide
      tw.to(this.ambientLabels, "alpha", 0, 0.3);
    } else {
      this.baseConnections.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.routeOverlay.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.cxMarkers.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.glowContainer.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.gatewayArcs.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.gatewayIndicators.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.settledRingsStatic.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.settledRingsAnimated.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.resourceIndicators.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.empireBaseRings.alpha = SYSTEM_VIEW_LINES_ALPHA;
      this.empireShipStacks.alpha = SYSTEM_VIEW_LINES_ALPHA;
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
    this.twinkleActive = !this.highlightedSystems;
    this.clearLabelEmphasis();

    const hl = this.highlightedSystems;
    const dur = tw ? 0.4 : 0;

    // Container-level elements restore to full unless highlight is active
    const containerAlpha = 1;
    const resourceAlpha = this.resourceIndicators.visible ? containerAlpha : 0;
    if (tw) {
      tw.to(this.baseConnections, "alpha", containerAlpha, dur);
      tw.to(this.routeOverlay, "alpha", containerAlpha, dur);
      tw.to(this.glowContainer, "alpha", containerAlpha, dur);
      tw.to(this.gatewayArcs, "alpha", containerAlpha, dur);
      tw.to(this.gatewayIndicators, "alpha", containerAlpha, dur);
      // CX markers dim per-system when highlight is active
      tw.to(this.cxMarkers, "alpha", containerAlpha, dur);
      const settledAlpha = this.settledVisible ? containerAlpha : 0;
      tw.to(this.settledRingsStatic, "alpha", settledAlpha, dur);
      tw.to(this.settledRingsAnimated, "alpha", settledAlpha, dur);
      tw.to(this.resourceIndicators, "alpha", resourceAlpha, dur);
      tw.to(this.empireBaseRings, "alpha", containerAlpha, dur);
      tw.to(this.empireShipStacks, "alpha", containerAlpha, dur);
    } else {
      this.baseConnections.alpha = containerAlpha;
      this.routeOverlay.alpha = containerAlpha;
      this.glowContainer.alpha = containerAlpha;
      this.gatewayArcs.alpha = containerAlpha;
      this.gatewayIndicators.alpha = containerAlpha;
      this.cxMarkers.alpha = containerAlpha;
      this.settledRingsStatic.alpha = this.settledVisible ? containerAlpha : 0;
      this.settledRingsAnimated.alpha = this.settledVisible ? containerAlpha : 0;
      this.resourceIndicators.alpha = resourceAlpha;
      this.empireBaseRings.alpha = containerAlpha;
      this.empireShipStacks.alpha = containerAlpha;
    }

    // Per-star alpha: respect highlight filter when active
    for (const [id, star] of this.starGraphics) {
      const targetAlpha = hl && !hl.has(id) ? DIM_HIGHLIGHT_ALPHA : 1;
      if (tw) {
        tw.to(star, "alpha", targetAlpha, dur);
      } else {
        star.alpha = targetAlpha;
      }
    }
    for (const [id, glow] of this.glowGraphics) {
      const targetAlpha = hl && !hl.has(id) ? GLOW_ALPHA * DIM_HIGHLIGHT_ALPHA : GLOW_ALPHA;
      if (tw) {
        tw.to(glow, "alpha", targetAlpha, dur);
      } else {
        glow.alpha = targetAlpha;
      }
    }

    // After restore tween completes, redraw connections/arcs with per-line alpha if highlight active
    if (hl) {
      const applyAfter = () => this.redrawWithHighlight();
      if (tw) {
        setTimeout(applyAfter, dur * 1000 + 50);
      } else {
        applyAfter();
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

    const hl = this.highlightedSystems;
    for (const [id, label] of this.ambientLabelMap) {
      const target = hl && !hl.has(id) ? DIM_HIGHLIGHT_ALPHA : 1;
      this.tweens.to(label, "alpha", target, 0.2);
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

  setGatewayIndicatorsVisible(visible: boolean): void {
    this.gatewayIndicators.visible = visible;
  }

  /**
   * Set which systems should stay bright (empire highlight filter).
   * Pass null to clear the filter and restore all systems.
   */
  setHighlightedSystems(ids: Set<string> | null): void {
    this.highlightedSystems = ids;
    if (this.isDimmedForSystemView) return; // system view has its own dimming
    this.applyHighlightFilter();
  }

  private applyHighlightFilter(): void {
    const hl = this.highlightedSystems;

    // Kill any in-flight tweens (e.g. from hover highlight) before
    // overwriting all star/glow/label alphas — stale tweens would
    // overwrite the values we're about to set.
    this.tweens.clear();

    if (!hl) {
      // Clear filter — restore all to full alpha
      this.twinkleActive = true;
      for (const star of this.starGraphics.values()) {
        star.alpha = 1;
      }
      for (const glow of this.glowGraphics.values()) {
        glow.alpha = GLOW_ALPHA;
      }
      for (const label of this.ambientLabelMap.values()) {
        label.alpha = 1;
      }
      // Redraw connections at full alpha
      this.lastConnectionScale = 0;
      this.redrawConnections(this.currentViewportScale);
      this.lastGatewayArcScale = 0;
      this.redrawGatewayArcs(this.currentViewportScale);
      return;
    }

    // Pause twinkle — dimmed stars shouldn't animate
    this.twinkleActive = false;

    // Per-star alpha
    for (const [id, star] of this.starGraphics) {
      star.alpha = hl.has(id) ? 1 : DIM_HIGHLIGHT_ALPHA;
    }
    for (const [id, glow] of this.glowGraphics) {
      glow.alpha = hl.has(id) ? GLOW_ALPHA : GLOW_ALPHA * DIM_HIGHLIGHT_ALPHA;
    }

    // Per-label alpha
    for (const [id, label] of this.ambientLabelMap) {
      label.alpha = hl.has(id) ? 1 : DIM_HIGHLIGHT_ALPHA;
    }

    // Redraw connections and arcs with per-line alpha
    this.redrawWithHighlight();
  }

  /** Redraw connections and gateway arcs with per-line highlight alpha. */
  private redrawWithHighlight(): void {
    const hl = this.highlightedSystems;
    if (!hl) return;

    const theme = getTheme();
    const scale = this.currentViewportScale;
    const width = scaledWidth(LINE_BASE, LINE_MIN, LINE_MAX, scale);

    // Base connections — bright if both endpoints highlighted, dim otherwise
    this.baseConnections.clear();
    let hasBright = false;
    let hasDim = false;

    // Collect lines by brightness
    const brightLines: Array<[number, number, number, number]> = [];
    const dimLines: Array<[number, number, number, number]> = [];

    for (const conn of this.connections) {
      const from = this.systemLookup.get(conn.fromId);
      const to = this.systemLookup.get(conn.toId);
      if (!from || !to) continue;

      if (hl.has(conn.fromId) && hl.has(conn.toId)) {
        brightLines.push([from.worldX, from.worldY, to.worldX, to.worldY]);
        hasBright = true;
      } else {
        dimLines.push([from.worldX, from.worldY, to.worldX, to.worldY]);
        hasDim = true;
      }
    }

    if (hasDim) {
      for (const [x1, y1, x2, y2] of dimLines) {
        this.baseConnections.moveTo(x1, y1);
        this.baseConnections.lineTo(x2, y2);
      }
      this.baseConnections.stroke({
        width,
        color: theme.jumpLine,
        alpha: theme.jumpLineAlpha * DIM_HIGHLIGHT_ALPHA,
      });
    }
    if (hasBright) {
      for (const [x1, y1, x2, y2] of brightLines) {
        this.baseConnections.moveTo(x1, y1);
        this.baseConnections.lineTo(x2, y2);
      }
      this.baseConnections.stroke({ width, color: theme.jumpLine, alpha: theme.jumpLineAlpha });
    }

    this.lastConnectionScale = scale;

    // Gateway arcs — same treatment
    const gwConns = getGalaxyGatewayConnections();
    const gwWidth = scaledWidth(GATEWAY_ARC_BASE, GATEWAY_ARC_MIN, GATEWAY_ARC_MAX, scale);

    this.gatewayArcs.clear();
    const brightArcs: Array<() => void> = [];
    const dimArcs: Array<() => void> = [];

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

      const drawArc = () => {
        this.gatewayArcs.moveTo(from.worldX, from.worldY);
        this.gatewayArcs.quadraticCurveTo(midX, midY - arcHeight, to.worldX, to.worldY);
      };

      if (hl.has(gw.fromSystemId) && hl.has(gw.toSystemId)) {
        brightArcs.push(drawArc);
      } else {
        dimArcs.push(drawArc);
      }
    }

    if (dimArcs.length > 0) {
      for (const draw of dimArcs) draw();
      this.gatewayArcs.stroke({
        width: gwWidth,
        color: GATEWAY_COLOUR,
        alpha: GATEWAY_ARC_ALPHA * DIM_HIGHLIGHT_ALPHA,
      });
    }
    if (brightArcs.length > 0) {
      for (const draw of brightArcs) draw();
      this.gatewayArcs.stroke({ width: gwWidth, color: GATEWAY_COLOUR, alpha: GATEWAY_ARC_ALPHA });
    }

    this.lastGatewayArcScale = scale;
  }

  /** Remove resource concentration dots without touching highlight state. */
  clearResourceIndicators(): void {
    this.resourceIndicators.removeChildren();
    this.resourceIndicators.visible = false;
  }

  /**
   * Draw resource concentration dots for the given matches.
   * Pass null (or empty) to clear. Does not touch dim state — composition
   * in main.ts owns the dim pass via setHighlightedSystems.
   */
  setResourceConcentrations(matches: Array<{ systemId: string; bestFactor: number }> | null): void {
    this.resourceConcentrationGen++;
    this.resourceIndicators.removeChildren();

    if (!matches || matches.length === 0) {
      this.resourceIndicators.visible = false;
      return;
    }

    for (const m of matches) {
      const system = this.systemLookup.get(m.systemId);
      if (!system) continue;

      const radius = RESOURCE_DOT_MIN_RADIUS + m.bestFactor * (RESOURCE_DOT_MAX_RADIUS - RESOURCE_DOT_MIN_RADIUS);
      const dot = new Graphics();
      dot.circle(0, 0, radius);
      dot.fill({ color: RESOURCE_COLOUR, alpha: RESOURCE_DOT_ALPHA });
      dot.x = system.worldX;
      dot.y = system.worldY;
      this.resourceIndicators.addChild(dot);
    }

    this.resourceIndicators.visible = true;
  }

  /**
   * Chunk-yielding concentration draw for the picker's spinner-painted path.
   * Generation counter bails out when a newer run supersedes this one —
   * prevents interleaved dots from rapid picker changes.
   */
  async setResourceConcentrationsAsync(matches: Array<{ systemId: string; bestFactor: number }> | null): Promise<void> {
    const gen = ++this.resourceConcentrationGen;
    await yieldToMain();
    if (gen !== this.resourceConcentrationGen) return;

    this.resourceIndicators.removeChildren();

    if (!matches || matches.length === 0) {
      this.resourceIndicators.visible = false;
      return;
    }

    const DOT_BATCH = 30;
    for (let i = 0; i < matches.length; i++) {
      if (gen !== this.resourceConcentrationGen) return;
      const m = matches[i]!;
      const system = this.systemLookup.get(m.systemId);
      if (!system) continue;

      const radius = RESOURCE_DOT_MIN_RADIUS + m.bestFactor * (RESOURCE_DOT_MAX_RADIUS - RESOURCE_DOT_MIN_RADIUS);
      const dot = new Graphics();
      dot.circle(0, 0, radius);
      dot.fill({ color: RESOURCE_COLOUR, alpha: RESOURCE_DOT_ALPHA });
      dot.x = system.worldX;
      dot.y = system.worldY;
      this.resourceIndicators.addChild(dot);

      if ((i + 1) % DOT_BATCH === 0) {
        await yieldToMain();
        if (gen !== this.resourceConcentrationGen) return;
      }
    }

    this.resourceIndicators.visible = true;
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
