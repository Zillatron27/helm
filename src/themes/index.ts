import type { ThemeTokens } from "../types/index.js";
import { drydockTheme } from "./drydock.js";

export interface ThemePreset {
  id: string;
  name: string;
  tokens: ThemeTokens;
}

const crtTheme: ThemeTokens = {
  bgPrimary: 0x0a100a,
  bgSecondary: 0x0c140c,
  bgTertiary: 0x111a11,
  accent: 0x33ff66,
  textPrimary: 0xb0ffb0,
  textSecondary: 0x447744,
  spectral: {
    O: 0x66ff99,
    B: 0x88ffaa,
    A: 0xaaffbb,
    F: 0xccffcc,
    G: 0xeeffdd,
    K: 0xbbdd88,
    M: 0x99bb55,
  },
  fieldStar: 0x224422,
  jumpLine: 0x1a331a,
  jumpLineAlpha: 0.6,
  hexStroke: 0x226622,
  planetRocky: [0x558844, 0x446633, 0x667755, 0x555555, 0x778855],
  planetGas: [0x339966, 0x448855, 0x55aa77, 0x336644, 0x44bb88],
};

const prunClassicTheme: ThemeTokens = {
  bgPrimary: 0x1a1f2e,
  bgSecondary: 0x202838,
  bgTertiary: 0x283040,
  accent: 0x4a90d9,
  textPrimary: 0xc8d0e0,
  textSecondary: 0x5a6478,
  spectral: {
    O: 0x8899cc,
    B: 0x99aadd,
    A: 0xb0bbee,
    F: 0xd0d8f0,
    G: 0xe8e0d0,
    K: 0xddcc99,
    M: 0xcc9966,
  },
  fieldStar: 0x2a3348,
  jumpLine: 0x283850,
  jumpLineAlpha: 0.5,
  hexStroke: 0x3a4a5a,
  planetRocky: [0x7a6b55, 0x5a7a50, 0x8a7a60, 0x6a6a6a, 0x8a6850],
  planetGas: [0x5a4ab0, 0x3a5ac0, 0x6a58c0, 0x4a6aa0, 0x7460a0],
};

const vividTheme: ThemeTokens = {
  bgPrimary: 0x080818,
  bgSecondary: 0x101028,
  bgTertiary: 0x181838,
  accent: 0xff6644,
  textPrimary: 0xf0f0f0,
  textSecondary: 0x7070a0,
  spectral: {
    O: 0x6688ff,
    B: 0x88aaff,
    A: 0xaaccff,
    F: 0xeeeeff,
    G: 0xffee88,
    K: 0xffaa44,
    M: 0xff6622,
  },
  fieldStar: 0x222244,
  jumpLine: 0x1a1a44,
  jumpLineAlpha: 0.7,
  hexStroke: 0x4444aa,
  planetRocky: [0xaa7744, 0x66aa44, 0xbb9955, 0x888888, 0xcc7744],
  planetGas: [0x7744cc, 0x4488ff, 0x8866ee, 0x5588dd, 0x9977cc],
};

const colorblindTheme: ThemeTokens = {
  bgPrimary: 0x0a0a0a,
  bgSecondary: 0x111111,
  bgTertiary: 0x1a1a1a,
  accent: 0x4a90d9,
  textPrimary: 0xe0e0e0,
  textSecondary: 0x666666,
  spectral: {
    O: 0x6688cc,
    B: 0x88aadd,
    A: 0xbbccee,
    F: 0xeeeeff,
    G: 0xffeecc,
    K: 0xddbb88,
    M: 0xcc9955,
  },
  fieldStar: 0x334455,
  jumpLine: 0x2a3a4a,
  jumpLineAlpha: 0.7,
  hexStroke: 0x4a7ab0,
  planetRocky: [0x8b7355, 0x6b8e5a, 0x9e8c6c, 0x7a7a7a, 0xa0785a],
  planetGas: [0x6a5acd, 0x4169e1, 0x7b68ee, 0x5b7ec2, 0x8470b8],
};

export const themePresets: ThemePreset[] = [
  { id: "drydock", name: "DryDock", tokens: drydockTheme },
  { id: "crt", name: "CRT", tokens: crtTheme },
  { id: "prun-classic", name: "PrUn Classic", tokens: prunClassicTheme },
  { id: "vivid", name: "Vivid", tokens: vividTheme },
  { id: "colorblind", name: "Colorblind Safe", tokens: colorblindTheme },
];

const presetMap = new Map(themePresets.map((p) => [p.id, p]));

export function getPresetById(id: string): ThemePreset {
  return presetMap.get(id) ?? themePresets[0]!;
}
