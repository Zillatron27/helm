import { Graphics } from "pixi.js";

/**
 * Right-pointing chevron stack — the "ships here" visual signature used
 * by the empire overlay in both galaxy and system views. The count rule:
 *   1 ship  → 1 chevron
 *   2+ ships → 3 overlapping chevrons (a fixed signature, not a count)
 *
 * Glyphs are filled isoceles triangles drawn at integer offsets so the
 * stack reads as motion / direction rather than a single shape.
 *
 * Returns a single Graphics so the caller can place + hit-test it
 * without an intermediate Container — Pixi v8 hit-testing on a
 * Container-with-Graphics-children proved unreliable as a child of
 * deeply-nested viewport layers (worked in system view, missed in
 * galaxy view), so the stack is now drawn as one shape.
 */

export const CHEVRON_GLYPH_SIZE = 8;
export const CHEVRON_GLYPH_OFFSET = 3;

/** Number of glyphs drawn for a given ship count. */
export function chevronGlyphCount(shipCount: number): number {
  return shipCount >= 2 ? 3 : 1;
}

export interface ChevronStackResult {
  graphics: Graphics;
  /** x-offset of the cluster centre (for centring hit areas / tooltips). */
  clusterCentre: number;
  /** Outer extent of the stack from the anchor (for hit-area sizing). */
  width: number;
}

export function buildChevronStack(
  shipCount: number,
  color: number,
  alpha = 1,
): ChevronStackResult {
  const glyphCount = chevronGlyphCount(shipCount);
  const half = CHEVRON_GLYPH_SIZE / 2;
  const g = new Graphics();

  for (let i = 0; i < glyphCount; i++) {
    const cx = i * CHEVRON_GLYPH_OFFSET;
    g.moveTo(cx - half, -half);
    g.lineTo(cx + half, 0);
    g.lineTo(cx - half, half);
    g.closePath();
  }
  g.fill({ color, alpha });

  const clusterCentre = ((glyphCount - 1) * CHEVRON_GLYPH_OFFSET) / 2;
  // From left edge of leftmost glyph to right tip of rightmost glyph
  const width = (glyphCount - 1) * CHEVRON_GLYPH_OFFSET + CHEVRON_GLYPH_SIZE;

  return { graphics: g, clusterCentre, width };
}
