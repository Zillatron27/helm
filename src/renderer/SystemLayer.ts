import { CanvasSource, Container, Graphics, Sprite, Text, Texture, Circle } from "pixi.js";
import type { StarSystem, Planet } from "../types/index.js";
import { getTheme, getSpectralColour } from "../ui/theme.js";
import { setSelectedEntity } from "../ui/state.js";

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
const LABEL_OFFSET_Y = 8;

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
  private planetGraphics: Map<string, Graphics> = new Map();
  private ambientParticles: AmbientParticle[] = [];
  private particleGfx: Graphics;
  private particleColour = 0xffffff;

  constructor() {
    this.container = new Container();
    this.container.visible = false;
    this.particleGfx = new Graphics();
    this.particleGfx.eventMode = "none";
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

    // Central star
    const centralStar = new Graphics();
    centralStar.circle(0, 0, CENTRAL_STAR_RADIUS);
    centralStar.fill(starColour);
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
        fontSize: 14,
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

      // Planet body
      const planetGfx = new Graphics();
      planetGfx.circle(0, 0, planet.displayRadius);
      planetGfx.fill(planet.colour);
      planetGfx.x = px;
      planetGfx.y = py;

      // Interaction
      planetGfx.eventMode = "static";
      planetGfx.cursor = "pointer";
      planetGfx.hitArea = new Circle(0, 0, Math.max(planet.displayRadius + 5, 15));

      const planetId = planet.id;
      planetGfx.on("pointertap", (e) => {
        e.stopPropagation();
        setSelectedEntity({ type: "planet", id: planetId });
      });

      planetGfx.on("pointerover", () => {
        planetGfx.scale.set(1.3);
      });
      planetGfx.on("pointerout", () => {
        planetGfx.scale.set(1);
      });

      this.planetGraphics.set(planet.id, planetGfx);
      this.container.addChild(planetGfx);

      // Planet label
      const label = new Text({
        text: planet.name || planet.naturalId,
        style: {
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: 10,
          fill: theme.textSecondary,
        },
      });
      label.anchor.set(0.5, 0);
      label.x = px;
      label.y = py + planet.displayRadius + LABEL_OFFSET_Y;
      this.container.addChild(label);
    }

    this.container.visible = true;
  }

  hide(): void {
    this.clear();
    this.container.visible = false;
  }

  update(dt: number, elapsed: number): void {
    if (!this.container.visible || this.ambientParticles.length === 0) return;

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

  private clear(): void {
    this.container.removeChildren();
    this.planetGraphics.clear();
    this.ambientParticles = [];
    this.particleGfx.clear();
  }
}
