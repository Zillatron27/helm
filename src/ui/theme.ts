import type { SpectralType, ThemeTokens } from "../types/index.js";
import { themePresets, getPresetById } from "../themes/index.js";

const STORAGE_KEY = "helm-theme";

type ThemeListener = () => void;

let activeTheme: ThemeTokens = themePresets[0]!.tokens;
let activePresetId: string = themePresets[0]!.id;
const listeners: Set<ThemeListener> = new Set();

// Existing API — preserved signatures

export function getTheme(): ThemeTokens {
  return activeTheme;
}

export function getSpectralColour(type: SpectralType): number {
  return activeTheme.spectral[type];
}

// New API

export function getActiveThemeId(): string {
  return activePresetId;
}

export function setTheme(id: string): void {
  const preset = getPresetById(id);
  activePresetId = preset.id;
  activeTheme = preset.tokens;
  applyCssProperties(activeTheme);
  try {
    localStorage.setItem(STORAGE_KEY, preset.id);
  } catch {
    // localStorage unavailable — ignore
  }
  for (const fn of listeners) {
    fn();
  }
}

export function onThemeChange(fn: ThemeListener): void {
  listeners.add(fn);
}

export function offThemeChange(fn: ThemeListener): void {
  listeners.delete(fn);
}

/** Load saved theme from localStorage and apply CSS custom properties. */
export function initTheme(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const preset = getPresetById(saved);
      activePresetId = preset.id;
      activeTheme = preset.tokens;
    }
  } catch {
    // localStorage unavailable — use default
  }
  applyCssProperties(activeTheme);
}

// CSS custom property helpers

function hexToRgbChannels(hex: number): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `${r}, ${g}, ${b}`;
}

function hexToCssHex(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function computeBorder(bgTertiary: number, textSecondary: number): string {
  const t = 0.6;
  const r = lerpChannel((bgTertiary >> 16) & 0xff, (textSecondary >> 16) & 0xff, t);
  const g = lerpChannel((bgTertiary >> 8) & 0xff, (textSecondary >> 8) & 0xff, t);
  const b = lerpChannel(bgTertiary & 0xff, textSecondary & 0xff, t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function applyCssProperties(tokens: ThemeTokens): void {
  const root = document.documentElement.style;

  root.setProperty("--bg-primary", hexToCssHex(tokens.bgPrimary));
  root.setProperty("--bg-secondary", hexToCssHex(tokens.bgSecondary));
  root.setProperty("--bg-tertiary", hexToCssHex(tokens.bgTertiary));
  root.setProperty("--bg-primary-rgb", hexToRgbChannels(tokens.bgPrimary));
  root.setProperty("--bg-secondary-rgb", hexToRgbChannels(tokens.bgSecondary));
  root.setProperty("--bg-tertiary-rgb", hexToRgbChannels(tokens.bgTertiary));

  root.setProperty("--accent", hexToCssHex(tokens.accent));
  root.setProperty("--accent-rgb", hexToRgbChannels(tokens.accent));
  root.setProperty("--text-primary", hexToCssHex(tokens.textPrimary));
  root.setProperty("--text-primary-rgb", hexToRgbChannels(tokens.textPrimary));
  root.setProperty("--text-secondary", hexToCssHex(tokens.textSecondary));
  root.setProperty("--text-secondary-rgb", hexToRgbChannels(tokens.textSecondary));

  root.setProperty("--border", computeBorder(tokens.bgTertiary, tokens.textSecondary));

  // Positive/negative colours — colorblind theme uses blue/orange
  if (activePresetId === "colorblind") {
    root.setProperty("--color-positive", "#0088ff");
    root.setProperty("--color-negative", "#ff8833");
  } else {
    root.setProperty("--color-positive", "#32cd32");
    root.setProperty("--color-negative", "#cd5c5c");
  }
}
