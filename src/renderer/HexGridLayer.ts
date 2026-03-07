import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { SectorHex } from "../types/index.js";

const HEX_STROKE_COLOUR = 0x4a8ab0;
const HEX_STROKE_ALPHA = 0.6;

// Base stroke width and clamp range for zoom-responsive scaling
const HEX_BASE = 1.5;
const HEX_MIN = 0.5;
const HEX_MAX = 5.0;

const LABEL_COLOUR = "#4a8ab0";
const LABEL_ALPHA = 0.5;
const LABEL_FONT_SIZE = 72;

// Redraw threshold — skip if scale changed less than 20%
const REDRAW_THRESHOLD_LOW = 0.8;
const REDRAW_THRESHOLD_HIGH = 1.2;

// Flat-top hex vertex angles: 0, 60, 120, 180, 240, 300 degrees
const HEX_ANGLES: number[] = [];
for (let i = 0; i < 6; i++) {
  HEX_ANGLES.push((i * Math.PI) / 3);
}

const labelStyle = new TextStyle({
  fontFamily: "IBM Plex Mono",
  fontSize: LABEL_FONT_SIZE,
  fill: LABEL_COLOUR,
});

export class HexGridLayer {
  readonly container: Container;
  private hexes: SectorHex[];
  private circumradius: number;
  private gfx: Graphics;
  private lastRedrawScale = 0;

  constructor(hexes: SectorHex[], circumradius: number) {
    this.container = new Container();
    this.hexes = hexes;
    this.circumradius = circumradius;

    this.gfx = new Graphics();

    // Add labels (not redrawn — text scales naturally with viewport)
    for (const hex of hexes) {
      const label = new Text({ text: hex.sectorCode, style: labelStyle });
      label.anchor.set(0.5);
      label.x = hex.worldX;
      label.y = hex.worldY;
      label.alpha = LABEL_ALPHA;
      this.container.addChild(label);
    }

    this.container.addChild(this.gfx);
  }

  /** Redraw hex borders if zoom changed significantly (>20%). */
  redraw(scale: number): void {
    if (this.lastRedrawScale > 0) {
      const ratio = scale / this.lastRedrawScale;
      if (ratio > REDRAW_THRESHOLD_LOW && ratio < REDRAW_THRESHOLD_HIGH) return;
    }
    this.lastRedrawScale = scale;

    const width = Math.min(Math.max(HEX_BASE / scale, HEX_MIN), HEX_MAX);
    const r = this.circumradius;

    this.gfx.clear();
    for (const hex of this.hexes) {
      const x0 = hex.worldX + r * Math.cos(HEX_ANGLES[0]!);
      const y0 = hex.worldY + r * Math.sin(HEX_ANGLES[0]!);
      this.gfx.moveTo(x0, y0);

      for (let i = 1; i < 6; i++) {
        const x = hex.worldX + r * Math.cos(HEX_ANGLES[i]!);
        const y = hex.worldY + r * Math.sin(HEX_ANGLES[i]!);
        this.gfx.lineTo(x, y);
      }

      this.gfx.lineTo(x0, y0);
    }

    this.gfx.stroke({
      width,
      color: HEX_STROKE_COLOUR,
      alpha: HEX_STROKE_ALPHA,
    });
  }
}
