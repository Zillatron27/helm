import { Container, Graphics } from "pixi.js";

const SPAWN_RATE = 10;
const PARTICLE_LIFETIME = 1.5;
const LIFETIME_VARIANCE = 0.3;
const INITIAL_RADIUS = 8;
const INITIAL_RADIUS_VARIANCE = 3;
const ANGULAR_SPEED = 2.5;
const ANGULAR_SPEED_VARIANCE = 1.0;
const RADIAL_SPEED = 8;
const RADIAL_SPEED_VARIANCE = 3;
const PARTICLE_SIZE = 1.5;
const INITIAL_ALPHA = 0.8;

// Trail parameters
const TRAIL_LENGTH = 6;
const TRAIL_ALPHA_DECAY = 0.6;
const TRAIL_SIZE_DECAY = 0.85;

interface TrailPoint {
  x: number;
  y: number;
}

interface Particle {
  angle: number;
  radius: number;
  angularSpeed: number;
  radialSpeed: number;
  life: number;
  maxLife: number;
  size: number;
  trail: TrailPoint[];
}

function rand(base: number, variance: number): number {
  return base + (Math.random() * 2 - 1) * variance;
}

export class StarParticles {
  readonly container: Container;
  private particles: Particle[] = [];
  private gfx: Graphics;
  private active = false;
  private colour = 0xffffff;
  private starX = 0;
  private starY = 0;
  private spawnAccumulator = 0;

  constructor() {
    this.container = new Container();
    this.container.visible = false;
    this.container.eventMode = "none";
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  start(worldX: number, worldY: number, spectralColour: number): void {
    this.starX = worldX;
    this.starY = worldY;
    this.colour = spectralColour;
    this.active = true;
    this.spawnAccumulator = 0;
    this.container.visible = true;
  }

  stop(): void {
    this.active = false;
  }

  clear(): void {
    this.active = false;
    this.particles.length = 0;
    this.gfx.clear();
    this.container.visible = false;
  }

  update(dt: number): void {
    if (!this.container.visible) return;

    // Spawn new particles
    if (this.active) {
      this.spawnAccumulator += dt;
      const spawnInterval = 1 / SPAWN_RATE;
      while (this.spawnAccumulator >= spawnInterval) {
        this.spawnAccumulator -= spawnInterval;
        const maxLife = rand(PARTICLE_LIFETIME, LIFETIME_VARIANCE);
        this.particles.push({
          angle: Math.random() * Math.PI * 2,
          radius: rand(INITIAL_RADIUS, INITIAL_RADIUS_VARIANCE),
          angularSpeed: rand(ANGULAR_SPEED, ANGULAR_SPEED_VARIANCE),
          radialSpeed: rand(RADIAL_SPEED, RADIAL_SPEED_VARIANCE),
          life: maxLife,
          maxLife,
          size: PARTICLE_SIZE,
          trail: [],
        });
      }
    }

    // Update and cull
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;

      // Record current position before moving
      const x = Math.cos(p.angle) * p.radius;
      const y = Math.sin(p.angle) * p.radius;
      p.trail.push({ x, y });
      if (p.trail.length > TRAIL_LENGTH) {
        p.trail.shift();
      }

      p.angle += p.angularSpeed * dt;
      p.radius += p.radialSpeed * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Hide container when fully wound down
    if (!this.active && this.particles.length === 0) {
      this.gfx.clear();
      this.container.visible = false;
      return;
    }

    // Redraw
    this.gfx.clear();
    for (const p of this.particles) {
      const headAlpha = (p.life / p.maxLife) * INITIAL_ALPHA;

      // Draw trail (oldest first, behind head)
      for (let i = 0; i < p.trail.length; i++) {
        const pt = p.trail[i]!;
        const stepsFromHead = p.trail.length - i;
        const trailAlpha = headAlpha * Math.pow(TRAIL_ALPHA_DECAY, stepsFromHead);
        const trailSize = p.size * Math.pow(TRAIL_SIZE_DECAY, stepsFromHead);
        this.gfx.circle(this.starX + pt.x, this.starY + pt.y, trailSize);
        this.gfx.fill({ color: this.colour, alpha: trailAlpha });
      }

      // Draw particle head
      const hx = this.starX + Math.cos(p.angle) * p.radius;
      const hy = this.starY + Math.sin(p.angle) * p.radius;
      this.gfx.circle(hx, hy, p.size);
      this.gfx.fill({ color: this.colour, alpha: headAlpha });
    }
  }
}
