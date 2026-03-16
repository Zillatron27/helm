import type { ThemeTokens } from "../../types/index.js";

function hexToCSS(hex: number): string {
  return "#" + hex.toString(16).padStart(6, "0");
}

function hexToRGBA(hex: number, alpha: number): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

function injectAnimations(): void {
  if (document.getElementById("helm-loader-animations")) return;
  const style = document.createElement("style");
  style.id = "helm-loader-animations";
  style.textContent = `
@keyframes helm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes helm-spin-r { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
@keyframes helm-star-glow { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }
@keyframes helm-text-fade { 0%,100% { opacity: 0.4; } 50% { opacity: 0.85; } }
`;
  document.head.appendChild(style);
}

interface OrbitDef {
  radius: number;
  planetSize: number;
  colour: number;
  duration: string;
  reverse: boolean;
}

function buildSolarSystem(
  size: number,
  starSize: number,
  orbits: OrbitDef[],
  theme: ThemeTokens,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:relative;width:${size}px;height:${size}px;`;

  const cx = size / 2;
  const cy = size / 2;

  // Star
  const star = document.createElement("div");
  const glowSize = starSize * 2.5;
  star.style.cssText = `
    position:absolute;
    left:${cx - starSize / 2}px;top:${cy - starSize / 2}px;
    width:${starSize}px;height:${starSize}px;
    border-radius:50%;
    background:${hexToCSS(theme.accent)};
    box-shadow:0 0 ${glowSize}px ${glowSize / 2}px ${hexToRGBA(theme.accent, 0.35)};
    animation:helm-star-glow 2.5s ease-in-out infinite;
  `;
  wrapper.appendChild(star);

  // Orbit rings + planets
  for (const orbit of orbits) {
    // Ring
    const ring = document.createElement("div");
    const ringSize = orbit.radius * 2;
    ring.style.cssText = `
      position:absolute;
      left:${cx - orbit.radius}px;top:${cy - orbit.radius}px;
      width:${ringSize}px;height:${ringSize}px;
      border-radius:50%;
      border:0.5px solid ${hexToRGBA(theme.accent, 0.08)};
      pointer-events:none;
    `;
    wrapper.appendChild(ring);

    // Planet orbit container (rotates around centre)
    const orbitContainer = document.createElement("div");
    const dir = orbit.reverse ? "helm-spin-r" : "helm-spin";
    orbitContainer.style.cssText = `
      position:absolute;
      left:${cx - orbit.radius}px;top:${cy - orbit.radius}px;
      width:${ringSize}px;height:${ringSize}px;
      animation:${dir} ${orbit.duration} linear infinite;
      pointer-events:none;
    `;

    // Planet dot — positioned at top of orbit (0, -radius relative to centre)
    const planet = document.createElement("div");
    planet.style.cssText = `
      position:absolute;
      left:${orbit.radius - orbit.planetSize / 2}px;
      top:${-orbit.planetSize / 2}px;
      width:${orbit.planetSize}px;height:${orbit.planetSize}px;
      border-radius:50%;
      background:${hexToCSS(orbit.colour)};
    `;
    orbitContainer.appendChild(planet);
    wrapper.appendChild(orbitContainer);
  }

  return wrapper;
}

export function createLoader(theme: ThemeTokens, version?: string): HTMLElement {
  injectAnimations();

  const container = document.createElement("div");
  container.style.cssText = `
    position:fixed;inset:0;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:${hexToCSS(theme.bgPrimary)};
    z-index:100;
    font-family:'IBM Plex Mono',monospace;
  `;

  const orbits: OrbitDef[] = [
    { radius: 24, planetSize: 5, colour: theme.spectral.B, duration: "3s", reverse: false },
    { radius: 40, planetSize: 6, colour: theme.planetRocky[0]!, duration: "5.5s", reverse: false },
    { radius: 56, planetSize: 7, colour: theme.planetRocky[1] ?? theme.planetRocky[0]!, duration: "9s", reverse: true },
    { radius: 72, planetSize: 8, colour: theme.planetGas[0]!, duration: "14s", reverse: false },
  ];

  const solar = buildSolarSystem(160, 16, orbits, theme);
  container.appendChild(solar);

  // Loading text
  const text = document.createElement("div");
  text.style.cssText = `
    margin-top:32px;
    font-size:12px;
    text-transform:uppercase;
    letter-spacing:0.15em;
    color:${hexToRGBA(theme.accent, 0.6)};
    animation:helm-text-fade 3s ease-in-out infinite;
  `;
  text.textContent = "Loading galaxy data";
  container.appendChild(text);

  // Version text
  if (version) {
    const ver = document.createElement("div");
    ver.style.cssText = `
      margin-top:8px;
      font-size:11px;
      color:${hexToRGBA(theme.accent, 0.25)};
    `;
    ver.textContent = `helm v${version}`;
    container.appendChild(ver);
  }

  return container;
}

export function createMiniLoader(theme: ThemeTokens): HTMLElement {
  injectAnimations();

  const orbits: OrbitDef[] = [
    { radius: 6, planetSize: 2, colour: theme.spectral.B, duration: "1.5s", reverse: false },
    { radius: 9, planetSize: 2.5, colour: theme.planetRocky[0]!, duration: "2.5s", reverse: false },
    { radius: 12, planetSize: 3, colour: theme.planetRocky[1] ?? theme.planetRocky[0]!, duration: "3.5s", reverse: true },
  ];

  return buildSolarSystem(24, 4, orbits, theme);
}
