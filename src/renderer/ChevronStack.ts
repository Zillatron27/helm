import { Graphics, Rectangle } from "pixi.js";

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
 *
 * Hit area is a padded Rectangle covering the full glyph extent — a
 * Circle centred on the cluster missed the corners of the leftmost
 * glyph in the 3-glyph case, so hovering near the left edge would lose
 * the tooltip.
 */

export const CHEVRON_GLYPH_SIZE = 8;
export const CHEVRON_GLYPH_OFFSET = 3;
const HIT_PADDING = 3;

/** Number of glyphs drawn for a given ship count. */
export function chevronGlyphCount(shipCount: number): number {
  return shipCount >= 2 ? 3 : 1;
}

export interface ChevronStackResult {
  graphics: Graphics;
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

  const totalWidth = (glyphCount - 1) * CHEVRON_GLYPH_OFFSET + CHEVRON_GLYPH_SIZE;
  g.hitArea = new Rectangle(
    -half - HIT_PADDING,
    -half - HIT_PADDING,
    totalWidth + HIT_PADDING * 2,
    CHEVRON_GLYPH_SIZE + HIT_PADDING * 2,
  );

  return { graphics: g };
}
