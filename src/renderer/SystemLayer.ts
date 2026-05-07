import { CanvasSource, Container, Graphics, Sprite, Text, Texture, Circle } from "pixi.js";
import type { StarSystem, Planet } from "../types/index.js";
import { getTheme, getSpectralColour } from "../ui/theme.js";
import { setSelectedEntity, getSelectedEntity, onStateChange, onBridgeSnapshotChange, getBridgeSnapshot } from "../ui/state.js";
import { getGatewaysForPlanet, getSystemById } from "../data/cache.js";
import { getEmpirePlanetIds, onEmpireIndexChange } from "../data/empireIndex.js";
import type { GatewayEndpoint } from "../types/index.js";
import type { ShipSummary } from "../data/bridge-types.js";
import { generatePlanetTexture, generateStarTexture, getCloudTexture, getCloudTint } from "./PlanetTexture.js";
import { showMapTooltip, hideMapTooltip } from "../ui/MapTooltip.js";
import { buildChevronStack, CHEVRON_GLYPH_SIZE } from "./ChevronStack.js";
import { formatDockedShipTooltip } from "../data/shipTooltip.js";

const CENTRAL_STAR_RADIUS = 30;
const GLOW_RADIUS = 110;
const GLOW_ALPHA = 0.5;

let systemGlowTexture: Texture | null = null;
function getSystemGlowTexture(): Texture {
  if (systemGlowTexture) return systemGlowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
  gradient.addColorStop(0.25, "rgba(255, 255, 255, 0.5)");
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.15)");
  gradient.addColorStop(0.75, "rgba(255, 255, 255, 0.04)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  systemGlowTexture = new Texture({ source: new CanvasSource({ resource: canvas }) });
  return systemGlowTexture;
}
const RING_ALPHA = 0.2;
const RING_WIDTH = 0.5;
const LABEL_OFFSET_Y = 12;

// Ambient star particle parameters
const AMBIENT_COUNT = 20;
const AMBIENT_MIN_RADIUS = 20;
const AMBIENT_MAX_RADIUS = 70;
const AMBIENT_ANGULAR_SPEED_MIN = 0.3;
const AMBIENT_ANGULAR_SPEED_MAX = 0.8;
const AMBIENT_RADIAL_DRIFT = 3;
const AMBIENT_PARTICLE_SIZE = 1.8;
const AMBIENT_ALPHA = 0.6;
const AMBIENT_TRAIL_LENGTH = 30;
const AMBIENT_TRAIL_ALPHA_DECAY = 0.88;
const AMBIENT_TRAIL_SIZE_DECAY = 0.95;

// Planet cloud drift parameters
const CLOUD_ALPHA = 0.4;
const CLOUD_SCALE = 1.8; // cloud blob size relative to planet
const CLOUD_DRIFT_SPEED_MIN = 0.4;
const CLOUD_DRIFT_SPEED_MAX = 0.8;
const CLOUD_DRIFT_RADIUS = 0.5; // fraction of displayRadius

// Gateway ring visual parameters
const GATEWAY_COLOUR = 0xbb77ff;
const GATEWAY_RING_RADIUS = 5;
const GATEWAY_RING_STROKE = 1.0;
const GATEWAY_RING_ALPHA = 0.9;
const GATEWAY_RING_OFFSET_Y = -20; // above the planet so HUD empire overlays drawn on-planet (base rings, etc.) don't collide
const GATEWAY_RING_SPACING = 14; // horizontal spacing for multiple rings
const GATEWAY_LINE_LENGTH = 60;
const GATEWAY_LINE_SEGMENTS = 4;

// Selection halo — Elite Dangerous-style blue arc
const HALO_COLOUR = 0x3399ff;
const HALO_ALPHA = 0.7;
const HALO_STROKE = 2.0;
const HALO_GAP = 6; // gap between planet edge and halo
const HALO_ARC_SPAN = Math.PI * 0.7; // each arc covers 70% of a semicircle
const HALO_PULSE_FREQUENCY = 1.0;
const HALO_PULSE_AMPLITUDE = 0.2;

// Empire planet ring — drawn around user-owned planets whenever the bridge
// snapshot is present. Sits inside the selection halo (HALO_GAP = 6) so
// a selected empire planet nests cleanly: planet → empire ring → halo.
const EMPIRE_PLANET_RING_GAP = 4;
const EMPIRE_PLANET_RING_STROKE = 1.5;
const EMPIRE_PLANET_RING_ALPHA = 0.7;

// Docked-ship indicator — chevron stack beside any planet with 1+ docked
// ships in the snapshot. Glyph count adapts to fleet size: 1 ship → 1
// chevron, 2+ ships → fixed 3-glyph stack. Anchored just outside the
// empire ring (or planet edge if no ring). Ships docked at the system's
// CX (locationPlanetNaturalId === null) get their own stack beside the
// central star — no per-planet anchor exists for them.
const SHIP_STACK_OFFSET_FROM_RING = 6;
const SHIP_STACK_ALPHA = 1.0;

interface PlanetCloud {
  sprite: Sprite;
  mask: Graphics;
  baseX: number;
  baseY: number;
  driftRadius: number;
  speedX: number;
  speedY: number;
  phaseX: number;
  phaseY: number;
}

interface AmbientParticle {
  angle: number;
  baseRadius: number;
  radius: number;
  angularSpeed: number;
  driftPhase: number;
  driftSpeed: number;
  trail: { x: number; y: number }[];
}

export class SystemLayer {
  readonly container: Container;
  private planetSprites: Map<string, Sprite> = new Map();
  private planetPositions: Map<string, { x: number; y: number; radius: number }> = new Map();
  private planetClouds: PlanetCloud[] = [];
  private ambientParticles: AmbientParticle[] = [];
  private particleGfx: Graphics;
  private particleColour = 0xffffff;
  private gatewayHoverLabel: Text | null = null;
  private selectionHalo: Graphics;
  private selectedPlanetId: string | null = null;

  // Composed planet dim set (naturalIds in the set stay bright; others dim).
  // null = no dim filter active, all planets at full alpha.
  private dimmedPlanets: Set<string> | null = null;
  private planetContainers: Map<string, Container> = new Map(); // naturalId → planet container

  // Cached system + planets so snapshot/index changes can re-apply the
  // empire overlay without re-running the whole system view.
  private currentSystem: StarSystem | null = null;
  private currentPlanets: Planet[] = [];
  private empireOverlayContainer: Container | null = null;

  // Bridge API: click interceptor (set by MapRenderer)
  planetClickInterceptor: ((naturalId: string, screenX: number, screenY: number) => boolean) | null = null;

  constructor() {
    this.container = new Container();
    this.container.visible = false;
    this.particleGfx = new Graphics();
    this.particleGfx.eventMode = "none";
    this.selectionHalo = new Graphics();
    this.selectionHalo.eventMode = "none";

    // Listen for selection changes to update halo
    onStateChange(() => {
      const entity = getSelectedEntity();
      const newId = entity?.type === "planet" ? entity.id : null;
      if (newId !== this.selectedPlanetId) {
        this.selectedPlanetId = newId;
        this.updateHalo();
      }
    });

    // Re-apply the empire overlay when the bridge snapshot updates or the
    // empire index recomputes — but only while the system view is showing.
    // The double subscription (snapshot + index) is intentional: ship updates
    // arrive via snapshot but don't change the empire index, while site
    // updates change both. Both call into the same idempotent rebuild.
    const reapplyOverlay = (): void => {
      if (!this.container.visible || !this.currentSystem) return;
      this.applyEmpireOverlay();
    };
    onBridgeSnapshotChange(reapplyOverlay);
    onEmpireIndexChange(reapplyOverlay);
  }

  show(system: StarSystem, planets: Planet[]): void {
    this.clear();
    const theme = getTheme();
    const starColour = getSpectralColour(system.spectralType);

    // Central star glow — soft radial gradient
    const glow = new Sprite(getSystemGlowTexture());
    glow.anchor.set(0.5);
    glow.width = GLOW_RADIUS * 2;
    glow.height = GLOW_RADIUS * 2;
    glow.tint = starColour;
    glow.alpha = GLOW_ALPHA;
    this.container.addChild(glow);

    // Central star — procedural sphere texture
    const starTexture = generateStarTexture(starColour, CENTRAL_STAR_RADIUS);
    const centralStar = new Sprite(starTexture);
    centralStar.anchor.set(0.5);
    centralStar.width = CENTRAL_STAR_RADIUS * 2;
    centralStar.height = CENTRAL_STAR_RADIUS * 2;
    this.container.addChild(centralStar);

    // Ambient orbiting particles
    this.particleColour = starColour;
    this.ambientParticles = [];
    for (let i = 0; i < AMBIENT_COUNT; i++) {
      const baseRadius = AMBIENT_MIN_RADIUS + Math.random() * (AMBIENT_MAX_RADIUS - AMBIENT_MIN_RADIUS);
      this.ambientParticles.push({
        angle: Math.random() * Math.PI * 2,
        baseRadius,
        radius: baseRadius,
        angularSpeed: (AMBIENT_ANGULAR_SPEED_MIN + Math.random() * (AMBIENT_ANGULAR_SPEED_MAX - AMBIENT_ANGULAR_SPEED_MIN))
          * (Math.random() < 0.5 ? 1 : -1),
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.5 + Math.random() * 0.5,
        trail: [],
      });
    }
    this.container.addChild(this.particleGfx);

    // Star label
    const starLabel = new Text({
      text: system.name,
      style: {
        fontFamily: "Audiowide, sans-serif",
        fontSize: 18,
        fill: theme.textPrimary,
      },
    });
    starLabel.anchor.set(0.5, 0);
    starLabel.y = CENTRAL_STAR_RADIUS + 10;
    this.container.addChild(starLabel);

    // Planets and orbital rings
    for (let i = 0; i < planets.length; i++) {
      const planet = planets[i]!;

      // Orbital ring (cosmetic)
      const ring = new Graphics();
      ring.circle(0, 0, planet.ringRadius);
      ring.stroke({
        width: RING_WIDTH,
        color: theme.jumpLine,
        alpha: RING_ALPHA,
      });
      this.container.addChild(ring);

      // Distribute planets at angles around their rings
      const angle = (i / Math.max(planets.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(angle) * planet.ringRadius;
      const py = Math.sin(angle) * planet.ringRadius;

      // Planet container — holds body + cloud, masked to circle
      const planetContainer = new Container();
      planetContainer.x = px;
      planetContainer.y = py;

      // Planet body — procedural texture sprite
      const texture = generatePlanetTexture(planet, planet.displayRadius);
      const planetSprite = new Sprite(texture);
      planetSprite.anchor.set(0.5);
      planetSprite.width = planet.displayRadius * 2;
      planetSprite.height = planet.displayRadius * 2;
      planetContainer.addChild(planetSprite);

      // Cloud wisp — drifts slowly across the planet surface
      const cloudSprite = new Sprite(getCloudTexture());
      cloudSprite.anchor.set(0.5);
      const cloudSize = planet.displayRadius * CLOUD_SCALE;
      cloudSprite.width = cloudSize;
      cloudSprite.height = cloudSize;
      cloudSprite.tint = getCloudTint(planet);
      cloudSprite.alpha = CLOUD_ALPHA;

      // Circle mask to clip cloud to planet bounds
      const cloudMask = new Graphics();
      cloudMask.circle(0, 0, planet.displayRadius);
      cloudMask.fill(0xffffff);
      planetContainer.addChild(cloudMask);
      planetContainer.addChild(cloudSprite);
      cloudSprite.mask = cloudMask;

      // Seeded drift parameters from planet ID
      let hash = 0;
      for (let ci = 0; ci < planet.id.length; ci++) {
        hash = ((hash << 5) - hash + planet.id.charCodeAt(ci)) | 0;
      }
      hash = Math.abs(hash);
      const rng0 = (hash % 1000) / 1000;
      const rng1 = ((hash >> 10) % 1000) / 1000;
      const rng2 = ((hash >> 20) % 1000) / 1000;

      this.planetClouds.push({
        sprite: cloudSprite,
        mask: cloudMask,
        baseX: 0,
        baseY: 0,
        driftRadius: planet.displayRadius * CLOUD_DRIFT_RADIUS,
        speedX: CLOUD_DRIFT_SPEED_MIN + rng0 * (CLOUD_DRIFT_SPEED_MAX - CLOUD_DRIFT_SPEED_MIN),
        speedY: CLOUD_DRIFT_SPEED_MIN + rng1 * (CLOUD_DRIFT_SPEED_MAX - CLOUD_DRIFT_SPEED_MIN),
        phaseX: rng2 * Math.PI * 2,
        phaseY: rng0 * Math.PI * 2 + 1.0,
      });

      // Interaction on the container
      planetContainer.eventMode = "static";
      planetContainer.cursor = "pointer";
      planetContainer.hitArea = new Circle(0, 0, Math.max(planet.displayRadius + 5, 15));

      const planetId = planet.id;
      const planetNaturalId = planet.naturalId;
      planetContainer.on("pointertap", (e) => {
        e.stopPropagation();
        if (this.planetClickInterceptor?.(planetNaturalId, e.globalX, e.globalY)) return;
        setSelectedEntity({ type: "planet", id: planetId });
      });

      this.planetSprites.set(planet.id, planetSprite);
      this.planetPositions.set(planet.id, { x: px, y: py, radius: planet.displayRadius });
      // Also store by naturalId for search-based selection
      this.planetPositions.set(planet.naturalId, { x: px, y: py, radius: planet.displayRadius });
      this.planetContainers.set(planet.naturalId, planetContainer);
      this.container.addChild(planetContainer);

      // Planet label
      const label = new Text({
        text: planet.name || planet.naturalId,
        style: {
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: 14,
          fill: theme.textSecondary,
        },
      });
      label.anchor.set(0.5, 0);
      label.x = px;
      label.y = py + planet.displayRadius + LABEL_OFFSET_Y;
      this.container.addChild(label);

      // Gateway rings for this planet
      const gateways = getGatewaysForPlanet(planet.naturalId);
      if (gateways && gateways.length > 0) {
        this.renderGatewayRings(gateways, px, py, planet.displayRadius, system);
      }
    }

    // Selection halo — on top of everything
    this.container.addChild(this.selectionHalo);
    this.updateHalo();

    // Replay composed planet dim if active
    this.applyPlanetDim();

    // Cache for snapshot-driven re-applies, then paint the empire overlay
    this.currentSystem = system;
    this.currentPlanets = planets;
    this.applyEmpireOverlay();

    this.container.visible = true;
  }

  hide(): void {
    this.selectedPlanetId = null;
    this.currentSystem = null;
    this.currentPlanets = [];
    this.clear();
    this.container.visible = false;
  }

  update(dt: number, elapsed: number): void {
    if (!this.container.visible) return;

    // Animate planet cloud drift
    for (const cloud of this.planetClouds) {
      cloud.sprite.x = cloud.baseX + Math.sin(elapsed * cloud.speedX + cloud.phaseX) * cloud.driftRadius;
      cloud.sprite.y = cloud.baseY + Math.sin(elapsed * cloud.speedY + cloud.phaseY) * cloud.driftRadius;
    }

    // Pulse selection halo
    if (this.selectedPlanetId) {
      const pulse = Math.sin(elapsed * HALO_PULSE_FREQUENCY * Math.PI * 2);
      this.selectionHalo.alpha = HALO_ALPHA + HALO_PULSE_AMPLITUDE * pulse;
    }

    if (this.ambientParticles.length === 0) return;

    this.particleGfx.clear();
    for (const p of this.ambientParticles) {
      p.angle += p.angularSpeed * dt;
      p.radius = p.baseRadius + Math.sin(elapsed * p.driftSpeed + p.driftPhase) * AMBIENT_RADIAL_DRIFT;

      const x = Math.cos(p.angle) * p.radius;
      const y = Math.sin(p.angle) * p.radius;

      // Record trail position
      p.trail.push({ x, y });
      if (p.trail.length > AMBIENT_TRAIL_LENGTH) {
        p.trail.shift();
      }

      const distFrac = p.radius / AMBIENT_MAX_RADIUS;
      const headAlpha = AMBIENT_ALPHA * (1.0 - distFrac * 0.5);

      // Draw trail (oldest first, behind head)
      for (let i = 0; i < p.trail.length - 1; i++) {
        const pt = p.trail[i]!;
        const stepsFromHead = p.trail.length - 1 - i;
        const trailAlpha = headAlpha * Math.pow(AMBIENT_TRAIL_ALPHA_DECAY, stepsFromHead);
        const trailSize = AMBIENT_PARTICLE_SIZE * Math.pow(AMBIENT_TRAIL_SIZE_DECAY, stepsFromHead);
        this.particleGfx.circle(pt.x, pt.y, trailSize);
        this.particleGfx.fill({ color: this.particleColour, alpha: trailAlpha });
      }

      // Draw head
      this.particleGfx.circle(x, y, AMBIENT_PARTICLE_SIZE);
      this.particleGfx.fill({ color: this.particleColour, alpha: headAlpha });
    }
  }

  private updateHalo(): void {
    this.selectionHalo.clear();
    if (!this.selectedPlanetId || !this.container.visible) return;

    const pos = this.planetPositions.get(this.selectedPlanetId);
    if (!pos) return;

    const haloRadius = pos.radius + HALO_GAP;

    // Draw two arcs — left and right, with gaps at top and bottom
    // Right arc: from -HALO_ARC_SPAN/2 to +HALO_ARC_SPAN/2
    this.selectionHalo.arc(pos.x, pos.y, haloRadius, -HALO_ARC_SPAN / 2, HALO_ARC_SPAN / 2);
    this.selectionHalo.stroke({ width: HALO_STROKE, color: HALO_COLOUR, alpha: HALO_ALPHA });

    // Left arc: from PI - HALO_ARC_SPAN/2 to PI + HALO_ARC_SPAN/2
    this.selectionHalo.arc(pos.x, pos.y, haloRadius, Math.PI - HALO_ARC_SPAN / 2, Math.PI + HALO_ARC_SPAN / 2);
    this.selectionHalo.stroke({ width: HALO_STROKE, color: HALO_COLOUR, alpha: HALO_ALPHA });
  }

  private renderGatewayRings(
    gateways: GatewayEndpoint[],
    planetX: number,
    planetY: number,
    planetRadius: number,
    system: StarSystem,
  ): void {
    const count = gateways.length;
    // Centre the row of rings above the planet
    const totalWidth = (count - 1) * GATEWAY_RING_SPACING;
    const startX = planetX - totalWidth / 2;
    const ringY = planetY + GATEWAY_RING_OFFSET_Y - planetRadius;

    for (let gi = 0; gi < count; gi++) {
      const gw = gateways[gi]!;
      const ringX = startX + gi * GATEWAY_RING_SPACING;

      // Ring — stroke-only circle
      const established = gw.linkStatus === "ESTABLISHED";

      const ring = new Graphics();
      if (established) {
        ring.circle(0, 0, GATEWAY_RING_RADIUS);
        ring.stroke({ width: GATEWAY_RING_STROKE, color: GATEWAY_COLOUR, alpha: GATEWAY_RING_ALPHA });
      } else {
        // Dotted ring for under-construction / unlinked gateways. Pixi v8
        // has no native dashed stroke — draw arc segments with gaps.
        const segs = 12;
        const arcSpan = (Math.PI * 2) / segs;
        const dashFraction = 0.45;
        for (let s = 0; s < segs; s++) {
          const start = s * arcSpan;
          const end = start + arcSpan * dashFraction;
          ring.moveTo(Math.cos(start) * GATEWAY_RING_RADIUS, Math.sin(start) * GATEWAY_RING_RADIUS);
          ring.arc(0, 0, GATEWAY_RING_RADIUS, start, end);
          ring.stroke({ width: GATEWAY_RING_STROKE, color: GATEWAY_COLOUR, alpha: GATEWAY_RING_ALPHA });
        }
      }
      ring.x = ringX;
      ring.y = ringY;

      // Direction line toward destination system (established only).
      const destSys = established && gw.destinationSystemId
        ? getSystemById(gw.destinationSystemId)
        : null;
      if (destSys) {
        const dx = destSys.worldX - system.worldX;
        const dy = destSys.worldY - system.worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          const dirX = dx / dist;
          const dirY = dy / dist;
          // Draw fading line segments
          for (let si = 0; si < GATEWAY_LINE_SEGMENTS; si++) {
            const segStart = (si / GATEWAY_LINE_SEGMENTS) * GATEWAY_LINE_LENGTH;
            const segEnd = ((si + 1) / GATEWAY_LINE_SEGMENTS) * GATEWAY_LINE_LENGTH;
            const alpha = GATEWAY_RING_ALPHA * (1 - si / GATEWAY_LINE_SEGMENTS) * 0.5;
            ring.moveTo(dirX * segStart, dirY * segStart);
            ring.lineTo(dirX * segEnd, dirY * segEnd);
            ring.stroke({ width: 0.8, color: GATEWAY_COLOUR, alpha });
          }
        }
      }

      // Interaction — hover to show destination label
      ring.eventMode = "static";
      ring.cursor = "pointer";
      ring.hitArea = new Circle(0, 0, GATEWAY_RING_RADIUS + 6);

      const destName = destSys?.name ?? gw.destinationSystemNaturalId ?? "Unknown";
      const labelText = established
        ? `\u2192 ${destName} (${gw.destinationSystemNaturalId ?? "?"})`
        : `${gw.name} (under construction)`;

      ring.on("pointerover", () => {
        this.showGatewayLabel(ringX, ringY - GATEWAY_RING_RADIUS - 4, labelText);
      });
      ring.on("pointerout", () => {
        this.hideGatewayLabel();
      });

      this.container.addChild(ring);
    }
  }

  private showGatewayLabel(x: number, y: number, text: string): void {
    this.hideGatewayLabel();
    const label = new Text({
      text,
      style: {
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 15,
        fill: GATEWAY_COLOUR,
      },
    });
    label.anchor.set(0.5, 1);
    label.x = x;
    label.y = y;
    label.eventMode = "none";
    this.container.addChild(label);
    this.gatewayHoverLabel = label;
  }

  private hideGatewayLabel(): void {
    if (this.gatewayHoverLabel) {
      this.container.removeChild(this.gatewayHoverLabel);
      this.gatewayHoverLabel = null;
    }
  }

  setDimmedPlanets(naturalIds: Set<string> | null): void {
    this.dimmedPlanets = naturalIds;
    this.applyPlanetDim();
  }

  private applyPlanetDim(): void {
    const ids = this.dimmedPlanets;
    if (!ids) {
      for (const pc of this.planetContainers.values()) {
        pc.alpha = 1;
      }
      return;
    }
    for (const [naturalId, pc] of this.planetContainers) {
      pc.alpha = ids.has(naturalId) ? 1 : 0.2;
    }
  }

  private clear(): void {
    this.container.removeChildren();
    this.planetSprites.clear();
    this.planetPositions.clear();
    this.planetContainers.clear();
    this.planetClouds = [];
    this.ambientParticles = [];
    this.particleGfx.clear();
    this.selectionHalo.clear();
    this.gatewayHoverLabel = null;
    this.empireOverlayContainer = null;
    // Any open ship tooltip is for a stack we're about to destroy.
    hideMapTooltip();
  }

  /**
   * Build (or rebuild) the empire overlay for the current system: a ring
   * around each user-owned planet, and a fixed three-chevron stack beside
   * any planet that has docked ships. Runs from show() and from snapshot/
   * index subscriptions while the system view is visible. The selection
   * halo stays on top by being removed and re-added after the overlay.
   */
  private applyEmpireOverlay(): void {
    if (!this.currentSystem) return;

    if (this.empireOverlayContainer) {
      this.container.removeChild(this.empireOverlayContainer);
      this.empireOverlayContainer.destroy({ children: true });
      this.empireOverlayContainer = null;
    }
    // Any open tooltip is for a stack we're about to destroy and rebuild.
    hideMapTooltip();

    const overlay = new Container();
    overlay.eventMode = "passive";

    const empirePlanetSet = getEmpirePlanetIds();
    const accent = getTheme().accent;

    // Group docked ships into per-planet stacks + a system-level stack
    // for CX-docked ships (locationPlanetNaturalId === null). Ships in
    // flight are omitted (handled by Cap 4 in-flight chevrons).
    const shipsAtPlanet = new Map<string, ShipSummary[]>();
    const cxDockedShips: ShipSummary[] = [];
    const snapshot = getBridgeSnapshot();
    const systemNid = this.currentSystem.naturalId;
    if (snapshot) {
      for (const ship of snapshot.ships) {
        if (ship.status === "IN_FLIGHT") continue;
        if (ship.locationPlanetNaturalId === null) {
          if (ship.locationSystemNaturalId === systemNid) cxDockedShips.push(ship);
          continue;
        }
        const list = shipsAtPlanet.get(ship.locationPlanetNaturalId);
        if (list) list.push(ship);
        else shipsAtPlanet.set(ship.locationPlanetNaturalId, [ship]);
      }
    }

    for (const planet of this.currentPlanets) {
      const pos = this.planetPositions.get(planet.naturalId);
      if (!pos) continue;

      // Ring radius is consistent whether or not the planet is empire-owned
      // — keeps the ship-stack anchor at a uniform distance from the planet.
      const ringRadius = pos.radius + EMPIRE_PLANET_RING_GAP;

      // Capability 2: empire ring on owned planets.
      if (empirePlanetSet.has(planet.naturalId)) {
        const ring = new Graphics();
        ring.circle(0, 0, ringRadius);
        ring.stroke({
          width: EMPIRE_PLANET_RING_STROKE,
          color: accent,
          alpha: EMPIRE_PLANET_RING_ALPHA,
        });
        ring.x = pos.x;
        ring.y = pos.y;
        overlay.addChild(ring);
      }

      // Capability 3: docked-ship stack beside any planet with 1+ ships.
      const ships = shipsAtPlanet.get(planet.naturalId);
      if (ships && ships.length > 0) {
        const half = CHEVRON_GLYPH_SIZE / 2;
        const { graphics: stack } = buildChevronStack(
          ships.length,
          accent,
          SHIP_STACK_ALPHA,
        );
        stack.x = pos.x + ringRadius + SHIP_STACK_OFFSET_FROM_RING + half;
        stack.y = pos.y;

        stack.eventMode = "static";
        stack.cursor = "default";

        const tooltip = formatDockedShipTooltip(ships);
        stack.on("pointerover", (e) => {
          // Pixi event globals are screen-space; perfect for an HTML overlay.
          showMapTooltip(e.globalX, e.globalY, tooltip);
        });
        stack.on("pointerout", () => {
          hideMapTooltip();
        });

        overlay.addChild(stack);
      }
    }

    // System-level stack for CX-docked ships — anchored beside the central
    // star (the star sits at container origin). Same chevron signature as
    // per-planet stacks; tooltip uses the system-context header to make
    // clear these ships aren't attached to any one planet.
    if (cxDockedShips.length > 0) {
      const half = CHEVRON_GLYPH_SIZE / 2;
      const { graphics: stack } = buildChevronStack(
        cxDockedShips.length,
        accent,
        SHIP_STACK_ALPHA,
      );
      stack.x = CENTRAL_STAR_RADIUS + SHIP_STACK_OFFSET_FROM_RING + half;
      stack.y = 0;

      stack.eventMode = "static";
      stack.cursor = "default";

      const tooltip = formatDockedShipTooltip(cxDockedShips, { systemNaturalId: systemNid });
      stack.on("pointerover", (e) => {
        showMapTooltip(e.globalX, e.globalY, tooltip);
      });
      stack.on("pointerout", () => {
        hideMapTooltip();
      });

      overlay.addChild(stack);
    }

    // Insert before the selection halo so the halo stays on top.
    this.container.removeChild(this.selectionHalo);
    this.container.addChild(overlay);
    this.container.addChild(this.selectionHalo);

    this.empireOverlayContainer = overlay;
  }

}
