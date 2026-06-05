import { Graphics, Rectangle } from "pixi.js";

/**
 * In-flight ship glyph — a dart/arrowhead pointing along +x (heading 0), so
 * the caller rotates it to the ship's travel direction. Deliberately distinct
 * from the docked-ship chevron *stack* (ChevronStack.ts): a single swept delta
 * reads as a moving vessel with a heading, where the chevron stack reads as a
 * static "ships present here" marker.
 *
 * Drawn as one Graphics (no Container) for the same hit-testing reliability
 * reason documented in ChevronStack.ts. Hit area is a padded square covering
 * the glyph at any rotation.
 */

export const SHIP_GLYPH_SIZE = 7;
const HIT_PADDING = 3;

export function buildShipGlyph(color: number, alpha = 1): Graphics {
  const s = SHIP_GLYPH_SIZE;
  const g = new Graphics();

  // Swept delta: nose forward (+x), swept-back wings, a tail notch so it reads
  // as an arrowhead rather than a plain triangle.
  g.moveTo(s, 0);
  g.lineTo(-s * 0.7, s * 0.65);
  g.lineTo(-s * 0.3, 0);
  g.lineTo(-s * 0.7, -s * 0.65);
  g.closePath();
  g.fill({ color, alpha });

  const reach = s + HIT_PADDING;
  g.hitArea = new Rectangle(-reach, -reach, reach * 2, reach * 2);

  return g;
}
