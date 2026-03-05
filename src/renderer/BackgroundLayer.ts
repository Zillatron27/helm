import { Container, Graphics } from "pixi.js";
import type { Viewport } from "pixi-viewport";
import { getTheme } from "../ui/theme.js";
import type { WorldBounds } from "../types/index.js";

// Parallax factor — background moves at this fraction of viewport movement
const PARALLAX = 0.15;
const STAR_COUNT = 1000;

// Brightness tiers: dim 60%, medium 30%, bright 10%
const TIERS = [
  { fraction: 0.6, alpha: 0.2, radius: 0.5 },
  { fraction: 0.3, alpha: 0.5, radius: 0.8 },
  { fraction: 0.1, alpha: 0.9, radius: 1.2 },
];

export class BackgroundLayer {
  readonly container: Container;
  private readonly gfx: Graphics;
  private fieldWidth: number;
  private fieldHeight: number;

  constructor(bounds: WorldBounds) {
    this.container = new Container();

    // Cover 3x the world area so parallax doesn't run out
    this.fieldWidth = bounds.width * 3;
    this.fieldHeight = bounds.height * 3;

    const theme = getTheme();
    this.gfx = new Graphics();

    // Seed-based pseudo-random for reproducible star field
    let seed = 42;
    const rand = (): number => {
      seed = (seed * 16807 + 0) % 2147483647;
      return seed / 2147483647;
    };

    for (const tier of TIERS) {
      const count = Math.round(STAR_COUNT * tier.fraction);
      for (let i = 0; i < count; i++) {
        const x = (rand() - 0.5) * this.fieldWidth;
        const y = (rand() - 0.5) * this.fieldHeight;
        this.gfx.circle(x, y, tier.radius);
      }
      this.gfx.fill({ color: theme.fieldStar, alpha: tier.alpha });
    }

    this.container.addChild(this.gfx);
  }

  // Call on viewport "moved" event to update parallax offset
  updateParallax(viewport: Viewport): void {
    this.container.x = -viewport.x * PARALLAX;
    this.container.y = -viewport.y * PARALLAX;
  }
}
