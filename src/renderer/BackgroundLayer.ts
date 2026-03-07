import { CanvasSource, Container, Sprite, Texture } from "pixi.js";
import type { Viewport } from "pixi-viewport";
import { getTheme } from "../ui/theme.js";
import type { WorldBounds } from "../types/index.js";

const DEEP_PARALLAX = 0.15;
const NEBULA_PARALLAX = 0.25;
const MID_PARALLAX = 0.4;

const DEEP_STAR_COUNT = 1300;
const MID_STAR_COUNT = 455;

const DEEP_TIERS = [
  { fraction: 0.6, alpha: 0.2, radius: 6 },
  { fraction: 0.3, alpha: 0.5, radius: 10 },
  { fraction: 0.1, alpha: 0.9, radius: 15 },
];

const MID_TIERS = [
  { fraction: 0.6, alpha: 0.15, radius: 8 },
  { fraction: 0.3, alpha: 0.3, radius: 12 },
  { fraction: 0.1, alpha: 0.5, radius: 18 },
];

// Subtle colour tints for mid-layer variety
const WARM_TINT = 0x443322;
const COOL_TINT = 0x223344;

// Nebula cloud parameters
const NEBULA_CLOUD_COUNT = 12;
const NEBULA_COLOURS = [
  0xaa44aa, 0x4488cc, 0x44aaaa, 0xcc6644,
  0x6644cc, 0xcc8833, 0x4466aa, 0x8844aa,
];

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, size);
  return new Texture({ source: new CanvasSource({ resource: canvas }) });
}

function createStarTexture(size: number): Texture {
  return canvasTexture(size, (ctx, s) => {
    const half = s / 2;
    ctx.beginPath();
    ctx.arc(half, half, half, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
  });
}

function createNebulaTexture(size: number): Texture {
  return canvasTexture(size, (ctx, s) => {
    const half = s / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    gradient.addColorStop(0.4, "rgba(255, 255, 255, 0.3)");
    gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.08)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, s, s);
  });
}

function makePrng(initialSeed: number): () => number {
  let seed = initialSeed;
  return () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };
}

export class BackgroundLayer {
  readonly container: Container;
  private readonly deepContainer: Container;
  private readonly nebulaContainer: Container;
  private readonly midContainer: Container;
  private fieldWidth: number;
  private fieldHeight: number;
  private initialVpX = 0;
  private initialVpY = 0;
  private parallaxReady = false;

  constructor(bounds: WorldBounds) {
    this.container = new Container();

    this.fieldWidth = bounds.width * 3;
    this.fieldHeight = bounds.height * 3;

    const theme = getTheme();
    const starTexture = createStarTexture(16);

    // Deep background star field — sprites instead of Graphics to avoid huge rasterization
    this.deepContainer = new Container();
    const deepRand = makePrng(42);

    for (const tier of DEEP_TIERS) {
      const count = Math.round(DEEP_STAR_COUNT * tier.fraction);
      for (let i = 0; i < count; i++) {
        const star = new Sprite(starTexture);
        star.anchor.set(0.5);
        star.x = (deepRand() - 0.5) * this.fieldWidth;
        star.y = (deepRand() - 0.5) * this.fieldHeight;
        star.width = tier.radius * 2;
        star.height = tier.radius * 2;
        star.tint = theme.fieldStar;
        star.alpha = tier.alpha;
        this.deepContainer.addChild(star);
      }
    }

    this.container.addChild(this.deepContainer);

    // Nebula clouds — Canvas2D radial gradient sprites for soft falloff
    this.nebulaContainer = new Container();
    const nebulaTexture = createNebulaTexture(256);
    const nebulaRand = makePrng(293);

    const nebulaSpreadX = bounds.width * 1.5;
    const nebulaSpreadY = bounds.height * 1.5;

    for (let i = 0; i < NEBULA_CLOUD_COUNT; i++) {
      const cx = (nebulaRand() - 0.5) * nebulaSpreadX;
      const cy = (nebulaRand() - 0.5) * nebulaSpreadY;
      const baseRadius = 1200 + nebulaRand() * 1800;
      const colour = NEBULA_COLOURS[Math.floor(nebulaRand() * NEBULA_COLOURS.length)]!;

      const blobCount = 4 + Math.floor(nebulaRand() * 3);
      for (let j = 0; j < blobCount; j++) {
        const offsetX = (nebulaRand() - 0.5) * baseRadius * 1.2;
        const offsetY = (nebulaRand() - 0.5) * baseRadius * 1.2;
        const blobRadius = 1200 + nebulaRand() * 2000;

        const sprite = new Sprite(nebulaTexture);
        sprite.anchor.set(0.5);
        sprite.x = cx + offsetX;
        sprite.y = cy + offsetY;
        sprite.width = blobRadius * 2;
        sprite.height = blobRadius * 2;
        sprite.tint = colour;
        sprite.alpha = 0.04 + nebulaRand() * 0.05;
        this.nebulaContainer.addChild(sprite);
      }
    }

    this.container.addChild(this.nebulaContainer);

    // Mid-depth star field
    this.midContainer = new Container();
    const midRand = makePrng(137);

    for (const tier of MID_TIERS) {
      const count = Math.round(MID_STAR_COUNT * tier.fraction);
      for (let i = 0; i < count; i++) {
        const tintRoll = midRand();
        const colour = tintRoll < 0.10 ? WARM_TINT
          : tintRoll < 0.15 ? COOL_TINT
          : theme.fieldStar;

        const star = new Sprite(starTexture);
        star.anchor.set(0.5);
        star.x = (midRand() - 0.5) * this.fieldWidth;
        star.y = (midRand() - 0.5) * this.fieldHeight;
        star.width = tier.radius * 2;
        star.height = tier.radius * 2;
        star.tint = colour;
        star.alpha = tier.alpha;
        this.midContainer.addChild(star);
      }
    }

    this.container.addChild(this.midContainer);
  }

  updateParallax(viewport: Viewport): void {
    // Capture initial viewport position (after fitWorld) so parallax is relative to start
    if (!this.parallaxReady) {
      this.initialVpX = viewport.x;
      this.initialVpY = viewport.y;
      this.parallaxReady = true;
    }

    const s = viewport.scaled;
    const dx = viewport.x - this.initialVpX;
    const dy = viewport.y - this.initialVpY;

    // Each layer matches viewport scale but drifts at a reduced rate when panning
    for (const [layer, factor] of [
      [this.deepContainer, DEEP_PARALLAX],
      [this.nebulaContainer, NEBULA_PARALLAX],
      [this.midContainer, MID_PARALLAX],
    ] as const) {
      layer.scale.set(s);
      layer.x = viewport.x - dx * factor;
      layer.y = viewport.y - dy * factor;
    }
  }
}
