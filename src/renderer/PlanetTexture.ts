import { CanvasSource, Texture } from "pixi.js";
import type { Planet } from "../types/index.js";

const textureCache: Map<string, Texture> = new Map();

const CANVAS_MIN = 32;
const CANVAS_MAX = 128;

// Light source offset (top-left, ~30% of radius)
const LIGHT_OFFSET = -0.3;

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function blend(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function scaleColour(c: RGB, factor: number): RGB {
  return {
    r: Math.min(255, Math.round(c.r * factor)),
    g: Math.min(255, Math.round(c.g * factor)),
    b: Math.min(255, Math.round(c.b * factor)),
  };
}

function rgbString(c: RGB, alpha = 1): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

function hexToRgb(hex: number): RGB {
  return {
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff,
  };
}

function getRockyBaseColour(planet: Planet): RGB {
  if (planet.temperature > 75) {
    // Hot: volcanic reds/oranges
    const t = Math.min((planet.temperature - 75) / 200, 1);
    return blend({ r: 180, g: 80, b: 40 }, { r: 120, g: 40, b: 20 }, t);
  } else if (planet.temperature < -25) {
    // Cold: icy blues/whites
    const t = Math.min((-25 - planet.temperature) / 200, 1);
    return blend({ r: 180, g: 200, b: 220 }, { r: 140, g: 160, b: 190 }, t);
  } else {
    // Temperate: fertility drives palette
    if (planet.fertility > 0.3) {
      const t = Math.min((planet.fertility - 0.3) / 0.7, 1);
      return blend({ r: 100, g: 110, b: 60 }, { r: 80, g: 130, b: 70 }, t);
    } else if (planet.fertility >= 0) {
      return blend({ r: 160, g: 140, b: 100 }, { r: 130, g: 110, b: 80 }, 0.5);
    } else {
      return blend({ r: 120, g: 120, b: 120 }, { r: 90, g: 90, b: 90 }, 0.5);
    }
  }
}

function drawSphereLighting(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  baseColour: RGB,
): void {
  const lightX = cx + LIGHT_OFFSET * radius;
  const lightY = cy + LIGHT_OFFSET * radius;

  const grad = ctx.createRadialGradient(lightX, lightY, 0, cx, cy, radius);
  grad.addColorStop(0, rgbString(scaleColour(baseColour, 1.2), 0.4));
  grad.addColorStop(0.4, rgbString(baseColour, 0.2));
  grad.addColorStop(0.85, rgbString(scaleColour(baseColour, 0.6), 0.4));
  grad.addColorStop(1, rgbString(scaleColour(baseColour, 0.35), 0.6));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cx * 2, cy * 2);
}

function drawRockyDetail(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  baseColour: RGB,
  rng: () => number,
): void {
  const detailCount = 8 + Math.floor(rng() * 8);

  for (let i = 0; i < detailCount; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * radius * 0.7;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const patchRadius = radius * (0.1 + rng() * 0.2);
    const shade = rng() > 0.5 ? 1.15 : 0.85;
    const patchColour = scaleColour(baseColour, shade);

    ctx.beginPath();
    ctx.arc(x, y, patchRadius, 0, Math.PI * 2);
    ctx.fillStyle = rgbString(patchColour, 0.3);
    ctx.fill();
  }
}

function drawAtmosphereHaze(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  pressure: number,
): void {
  if (pressure <= 0.5) return;

  const hazeAlpha = Math.min(pressure / 5, 0.25);
  const hazeGrad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius);
  hazeGrad.addColorStop(0, "rgba(100, 150, 255, 0)");
  hazeGrad.addColorStop(1, `rgba(100, 150, 255, ${hazeAlpha})`);
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(0, 0, cx * 2, cy * 2);
}

function drawGasBands(
  ctx: CanvasRenderingContext2D,
  size: number,
  baseColour: RGB,
  rng: () => number,
): void {
  const bandCount = 6 + Math.floor(rng() * 6);
  const half = size / 2;

  for (let i = 0; i < bandCount; i++) {
    // Bands with slight random offset and varying height
    const t = i / bandCount;
    const y = t * size + (rng() - 0.5) * (size / bandCount) * 0.3;
    const bandHeight = (size / bandCount) * (0.6 + rng() * 0.8);
    const shade = 0.85 + rng() * 0.3;
    const bandColour = scaleColour(baseColour, shade);

    // Feathered band — radial alpha falloff from equator
    const distFromEquator = Math.abs(y + bandHeight / 2 - half) / half;
    const bandAlpha = 0.15 + (1 - distFromEquator) * 0.1;

    ctx.fillStyle = rgbString(bandColour, bandAlpha);
    ctx.fillRect(0, y, size, bandHeight);
  }
}

function drawStormSpot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  baseColour: RGB,
  rng: () => number,
): void {
  // Only on larger gas giants (roughly half the time based on seed)
  if (rng() < 0.5) return;

  const angle = rng() * Math.PI * 2;
  const dist = radius * (0.2 + rng() * 0.3);
  const sx = cx + Math.cos(angle) * dist;
  const sy = cy + Math.sin(angle) * dist;
  const spotW = radius * (0.15 + rng() * 0.1);
  const spotH = spotW * (0.5 + rng() * 0.3);
  const spotColour = scaleColour(baseColour, 1.3);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle * 0.3);
  ctx.beginPath();
  ctx.ellipse(0, 0, spotW, spotH, 0, 0, Math.PI * 2);
  ctx.fillStyle = rgbString(spotColour, 0.35);
  ctx.fill();
  ctx.restore();
}

let cloudTexture: Texture | null = null;
export function getCloudTexture(): Texture {
  if (cloudTexture) return cloudTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const half = size / 2;
  // Soft irregular blob — two offset radial gradients blended
  const g1 = ctx.createRadialGradient(half * 0.8, half * 0.9, 0, half, half, half);
  g1.addColorStop(0, "rgba(255, 255, 255, 0.7)");
  g1.addColorStop(0.3, "rgba(255, 255, 255, 0.3)");
  g1.addColorStop(0.6, "rgba(255, 255, 255, 0.08)");
  g1.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, size, size);
  const g2 = ctx.createRadialGradient(half * 1.2, half * 1.1, 0, half, half, half * 0.7);
  g2.addColorStop(0, "rgba(255, 255, 255, 0.4)");
  g2.addColorStop(0.4, "rgba(255, 255, 255, 0.15)");
  g2.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, size, size);
  cloudTexture = new Texture({ source: new CanvasSource({ resource: canvas }) });
  return cloudTexture;
}

export function getCloudTint(planet: Planet): number {
  if (planet.surface) {
    if (planet.temperature > 75) return 0xff8844; // molten orange
    if (planet.temperature < -25) return 0x88bbff; // bright icy blue
    if (planet.fertility > 0.3) return 0x66dd88; // vivid green
    return 0xccaa88; // dusty gold
  }
  // Gas: contrasting lighter/shifted version of planet colour
  const r = Math.min(255, ((planet.colour >> 16) & 0xff) + 100);
  const g = Math.min(255, ((planet.colour >> 8) & 0xff) + 100);
  const b = Math.min(255, (planet.colour & 0xff) + 100);
  return (r << 16) | (g << 8) | b;
}

const starTextureCache: Map<number, Texture> = new Map();

export function generateStarTexture(colour: number, radius: number): Texture {
  const cached = starTextureCache.get(colour);
  if (cached) return cached;

  const size = Math.min(Math.max(Math.round(radius * 4), CANVAS_MIN), CANVAS_MAX);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const r = size / 2 - 1;
  const baseColour = hexToRgb(colour);

  // Clip to circle
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, Math.PI * 2);
  ctx.clip();

  // Base fill
  ctx.fillStyle = rgbString(baseColour);
  ctx.fillRect(0, 0, size, size);

  // Sphere lighting — bright hot spot top-left, darker limb
  const lightX = cx + LIGHT_OFFSET * r;
  const lightY = cx + LIGHT_OFFSET * r;
  const grad = ctx.createRadialGradient(lightX, lightY, 0, cx, cx, r);
  grad.addColorStop(0, rgbString(scaleColour(baseColour, 1.6), 0.9));
  grad.addColorStop(0.3, rgbString(scaleColour(baseColour, 1.2), 0.4));
  grad.addColorStop(0.7, rgbString(baseColour, 0.15));
  grad.addColorStop(1, rgbString(scaleColour(baseColour, 0.5), 0.5));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new Texture({ source: new CanvasSource({ resource: canvas }) });
  starTextureCache.set(colour, texture);
  return texture;
}

export function generatePlanetTexture(planet: Planet, displayRadius: number): Texture {
  const cached = textureCache.get(planet.id);
  if (cached) return cached;

  const size = Math.min(Math.max(Math.round(displayRadius * 4), CANVAS_MIN), CANVAS_MAX);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 1; // 1px inset to avoid clipping at edge

  // Clip to circle
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  const rng = seededRandom(hashString(planet.id));

  if (planet.surface) {
    // Rocky planet
    const baseColour = getRockyBaseColour(planet);

    // Base sphere fill
    ctx.fillStyle = rgbString(baseColour);
    ctx.fillRect(0, 0, size, size);

    // Surface detail patches
    drawRockyDetail(ctx, cx, cy, radius, baseColour, rng);

    // Sphere lighting overlay
    drawSphereLighting(ctx, cx, cy, radius, baseColour);

    // Atmosphere haze
    drawAtmosphereHaze(ctx, cx, cy, radius, planet.pressure);
  } else {
    // Gas giant
    const baseColour = hexToRgb(planet.colour);

    // Base fill
    ctx.fillStyle = rgbString(baseColour);
    ctx.fillRect(0, 0, size, size);

    // Horizontal banding
    drawGasBands(ctx, size, baseColour, rng);

    // Storm spot
    drawStormSpot(ctx, cx, cy, radius, baseColour, rng);

    // Sphere lighting overlay
    drawSphereLighting(ctx, cx, cy, radius, baseColour);
  }

  const texture = new Texture({ source: new CanvasSource({ resource: canvas }) });
  textureCache.set(planet.id, texture);
  return texture;
}

export function clearPlanetTextureCache(): void {
  textureCache.clear();
  starTextureCache.clear();
}
