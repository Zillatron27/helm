import { Container, Graphics, Text, Circle } from "pixi.js";
import type { StarSystem, Planet } from "../types/index.js";
import { getTheme, getSpectralColour } from "../ui/theme.js";
import { setSelectedEntity } from "../ui/state.js";

const CENTRAL_STAR_RADIUS = 30;
const GLOW_RADIUS = 50;
const GLOW_ALPHA = 0.15;
const RING_ALPHA = 0.2;
const RING_WIDTH = 0.5;
const LABEL_OFFSET_Y = 8;

export class SystemLayer {
  readonly container: Container;
  private planetGraphics: Map<string, Graphics> = new Map();

  constructor() {
    this.container = new Container();
    this.container.visible = false;
  }

  show(system: StarSystem, planets: Planet[]): void {
    this.clear();
    const theme = getTheme();
    const starColour = getSpectralColour(system.spectralType);

    // Central star glow
    const glow = new Graphics();
    glow.circle(0, 0, GLOW_RADIUS);
    glow.fill({ color: starColour, alpha: GLOW_ALPHA });
    this.container.addChild(glow);

    // Central star
    const centralStar = new Graphics();
    centralStar.circle(0, 0, CENTRAL_STAR_RADIUS);
    centralStar.fill(starColour);
    this.container.addChild(centralStar);

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

  private clear(): void {
    this.container.removeChildren();
    this.planetGraphics.clear();
  }
}
