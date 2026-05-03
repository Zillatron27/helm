import { Container, Graphics } from "pixi.js";

/**
 * Right-pointing chevron stack — the "ships here" visual signature used
 * by the empire overlay in both galaxy and system views. The count rule:
 *   1 ship  → 1 chevron
 *   2+ ships → 3 overlapping chevrons (a fixed signature, not a count)
 *
 * Glyphs are filled isoceles triangles drawn at integer offsets so the
 * stack reads as motion / direction rather than a single shape.
 */

export const CHEVRON_GLYPH_SIZE = 8;
export const CHEVRON_GLYPH_OFFSET = 3;

/** Number of glyphs drawn for a given ship count. */
export function chevronGlyphCount(shipCount: number): number {
  return shipCount >= 2 ? 3 : 1;
}

/**
 * Draw a chevron stack into `container` anchored at its local origin
 * (the leftmost glyph's centre is at x=0). Returns the x-offset of the
 * cluster centre — useful for centring a hit area or tooltip anchor.
 */
export function drawChevronStack(
  container: Container,
  shipCount: number,
  color: number,
  alpha = 1,
): number {
  const glyphCount = chevronGlyphCount(shipCount);
  const half = CHEVRON_GLYPH_SIZE / 2;

  for (let i = 0; i < glyphCount; i++) {
    const glyph = new Graphics();
    glyph.moveTo(-half, -half);
    glyph.lineTo(half, 0);
    glyph.lineTo(-half, half);
    glyph.closePath();
    glyph.fill({ color, alpha });
    glyph.x = i * CHEVRON_GLYPH_OFFSET;
    container.addChild(glyph);
  }

  return ((glyphCount - 1) * CHEVRON_GLYPH_OFFSET) / 2;
}
