import type { ThemeTokens } from "../types/index.js";
import { drydockTheme } from "./drydock.js";

export interface ThemePreset {
  id: string;
  name: string;
  tokens: ThemeTokens;
}

const crtTheme: ThemeTokens = {
  bgPrimary: 0x050a05,
  bgSecondary: 0x0a140a,
  bgTertiary: 0x0f1e0f,
  accent: 0x33ff33,
  textPrimary: 0xccffcc,
  textSecondary: 0x448844,
  spectral: {
    O: 0x66ff99,
    B: 0x55ee88,
    A: 0x77ffaa,
    F: 0x99ffbb,
    G: 0xbbffcc,
    K: 0xaaff99,
    M: 0x88ee66,
  },
  fieldStar: 0x1a3a1a,
  jumpLine: 0x1a3a1a,
  jumpLineAlpha: 0.6,
  hexStroke: 0x226622,
  planetRocky: [0x2a5a2a, 0x3a6a2a, 0x4a5a3a, 0x3a4a3a, 0x5a6a4a],
  planetGas: [0x2a4a3a, 0x1a5a4a, 0x3a5a5a, 0x2a6a4a, 0x1a4a5a],
  route: 0xff8c00,
  routeGateway: 0xffdd00,
  highlight: 0xff8c00,
  gateway: 0xbb77ff,
  settled: 0xc4a35a,
  resource: 0x00ccaa,
  cogc: 0x7799ff,
  systemHalo: 0x3399ff,
  label: 0xaaaaaa,
  labelEmphasis: 0xe0e0e0,
  positive: 0x32cd32,
  negative: 0xcd5c5c,
  planetCloud: { hot: 0xff8844, cold: 0x88bbff, fertile: 0x66dd88, neutral: 0xccaa88 },
  nebula: {
    warm: 0x443322,
    cool: 0x223344,
    clouds: [0xaa44aa, 0x4488cc, 0x44aaaa, 0xcc6644, 0x6644cc, 0xcc8833, 0x4466aa, 0x8844aa],
  },
};

const prunClassicTheme: ThemeTokens = {
  // Backgrounds darkened from spec for contrast (spec: 0x1a1f25, 0x252b31, 0x2f363d)
  bgPrimary: 0x0e1118,
  bgSecondary: 0x141a24,
  bgTertiary: 0x1c2430,
  accent: 0xe0a030,
  textPrimary: 0xbbc4cc,
  textSecondary: 0x667888,
  spectral: {
    O: 0x7788bb,
    B: 0x8899cc,
    A: 0xaabbdd,
    F: 0xccddee,
    G: 0xeeddaa,
    K: 0xddbb77,
    M: 0xcc8855,
  },
  fieldStar: 0x1e2830,
  jumpLine: 0x3a5570,
  jumpLineAlpha: 0.7,
  hexStroke: 0x4a6080,
  planetRocky: [0x6a6050, 0x5a7060, 0x7a7060, 0x606060, 0x806a50],
  planetGas: [0x4a5a7a, 0x3a4a6a, 0x5a6a8a, 0x4a5a6a, 0x3a5a7a],
  route: 0xff8c00,
  routeGateway: 0xffdd00,
  highlight: 0xff8c00,
  gateway: 0xbb77ff,
  settled: 0xc4a35a,
  resource: 0x00ccaa,
  cogc: 0x7799ff,
  systemHalo: 0x3399ff,
  label: 0xaaaaaa,
  labelEmphasis: 0xe0e0e0,
  positive: 0x32cd32,
  negative: 0xcd5c5c,
  planetCloud: { hot: 0xff8844, cold: 0x88bbff, fertile: 0x66dd88, neutral: 0xccaa88 },
  nebula: {
    warm: 0x443322,
    cool: 0x223344,
    clouds: [0xaa44aa, 0x4488cc, 0x44aaaa, 0xcc6644, 0x6644cc, 0xcc8833, 0x4466aa, 0x8844aa],
  },
};

const vividTheme: ThemeTokens = {
  bgPrimary: 0x08080f,
  bgSecondary: 0x101018,
  bgTertiary: 0x181822,
  accent: 0xff6644,
  textPrimary: 0xf0f0f0,
  textSecondary: 0x8888aa,
  spectral: {
    O: 0x6688ff,
    B: 0x88aaff,
    A: 0xccddff,
    F: 0xffffff,
    G: 0xffee88,
    K: 0xffaa44,
    M: 0xff6633,
  },
  fieldStar: 0x2a2a44,
  jumpLine: 0x2a2a44,
  jumpLineAlpha: 0.8,
  hexStroke: 0x4444aa,
  planetRocky: [0xaa7744, 0x66aa55, 0xbbaa66, 0x888888, 0xcc8855],
  planetGas: [0x7755dd, 0x4488ff, 0x9977ff, 0x6699dd, 0xaa88cc],
  route: 0xff8c00,
  routeGateway: 0xffdd00,
  highlight: 0xff8c00,
  gateway: 0xbb77ff,
  settled: 0xc4a35a,
  resource: 0x00ccaa,
  cogc: 0x7799ff,
  systemHalo: 0x3399ff,
  label: 0xaaaaaa,
  labelEmphasis: 0xe0e0e0,
  positive: 0x32cd32,
  negative: 0xcd5c5c,
  planetCloud: { hot: 0xff8844, cold: 0x88bbff, fertile: 0x66dd88, neutral: 0xccaa88 },
  nebula: {
    warm: 0x443322,
    cool: 0x223344,
    clouds: [0xaa44aa, 0x4488cc, 0x44aaaa, 0xcc6644, 0x6644cc, 0xcc8833, 0x4466aa, 0x8844aa],
  },
};

const colorblindTheme: ThemeTokens = {
  bgPrimary: 0x0a0a0a,
  bgSecondary: 0x111111,
  bgTertiary: 0x1a1a1a,
  accent: 0x0088ff,
  textPrimary: 0xe0e0e0,
  textSecondary: 0x888888,
  spectral: {
    O: 0x4477cc,
    B: 0x5588dd,
    A: 0x88aaee,
    F: 0xdddddd,
    G: 0xffcc44,
    K: 0xff9933,
    M: 0xcc6622,
  },
  fieldStar: 0x2a3344,
  jumpLine: 0x2a3344,
  jumpLineAlpha: 0.7,
  hexStroke: 0x4a7ab0,
  planetRocky: [0x9a8a6a, 0x6a8a9a, 0xaa9a7a, 0x7a7a7a, 0xba8a6a],
  planetGas: [0x5a6aaa, 0x3a5aaa, 0x6a7abb, 0x4a6a9a, 0x7a7aaa],
  // CVD-safe overlay palette (Okabe-Ito). First pass — tunable. The search
  // chips (systemHalo / settled / cogc) must stay mutually distinct since
  // they appear side by side in results.
  route: 0xe69f00, // orange
  routeGateway: 0xf0e442, // yellow
  highlight: 0x56b4e9, // sky blue
  gateway: 0xcc79a7, // reddish purple
  settled: 0xd55e00, // vermillion
  resource: 0x009e73, // bluish green
  cogc: 0xf0e442, // yellow (chip context — distinct from systemHalo/settled)
  systemHalo: 0x56b4e9, // sky blue
  label: 0xaaaaaa,
  labelEmphasis: 0xe0e0e0,
  positive: 0x0088ff,
  negative: 0xff8833,
  planetCloud: { hot: 0xe69f00, cold: 0x56b4e9, fertile: 0x009e73, neutral: 0xccaa88 },
  nebula: {
    warm: 0x332211,
    cool: 0x112233,
    clouds: [0x4466aa, 0x335577, 0x446688, 0x5566aa, 0x224466, 0x447799, 0x335588, 0x556699],
  },
};

export const themePresets: ThemePreset[] = [
  { id: "drydock", name: "DryDock", tokens: drydockTheme },
  { id: "crt", name: "CRT", tokens: crtTheme },
  { id: "prun-classic", name: "PrUn", tokens: prunClassicTheme },
  { id: "vivid", name: "Vivid", tokens: vividTheme },
  { id: "colorblind", name: "Colorblind", tokens: colorblindTheme },
];

const presetMap = new Map(themePresets.map((p) => [p.id, p]));

export function getPresetById(id: string): ThemePreset {
  return presetMap.get(id) ?? themePresets[0]!;
}
