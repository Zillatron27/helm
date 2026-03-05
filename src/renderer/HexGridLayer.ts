import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { SectorHex } from "../types/index.js";

const HEX_STROKE_COLOUR = 0x4a8ab0;
const HEX_STROKE_ALPHA = 0.6;
const HEX_STROKE_WIDTH = 1.5;

const LABEL_COLOUR = "#4a8ab0";
const LABEL_ALPHA = 0.5;
const LABEL_FONT_SIZE = 72;

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

  constructor(hexes: SectorHex[], circumradius: number) {
    this.container = new Container();

    const gfx = new Graphics();

    for (const hex of hexes) {
      // First vertex
      const x0 = hex.worldX + circumradius * Math.cos(HEX_ANGLES[0]!);
      const y0 = hex.worldY + circumradius * Math.sin(HEX_ANGLES[0]!);
      gfx.moveTo(x0, y0);

      // Remaining vertices
      for (let i = 1; i < 6; i++) {
        const x = hex.worldX + circumradius * Math.cos(HEX_ANGLES[i]!);
        const y = hex.worldY + circumradius * Math.sin(HEX_ANGLES[i]!);
        gfx.lineTo(x, y);
      }

      // Close the polygon
      gfx.lineTo(x0, y0);

      // Sector label at hex centre
      const label = new Text({ text: hex.sectorCode, style: labelStyle });
      label.anchor.set(0.5);
      label.x = hex.worldX;
      label.y = hex.worldY;
      label.alpha = LABEL_ALPHA;
      this.container.addChild(label);
    }

    gfx.stroke({
      width: HEX_STROKE_WIDTH,
      color: HEX_STROKE_COLOUR,
      alpha: HEX_STROKE_ALPHA,
    });

    this.container.addChild(gfx);
  }
}
