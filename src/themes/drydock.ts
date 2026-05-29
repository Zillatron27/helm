import type { ThemeTokens } from "../types/index.js";

// Spectral colours based on astronomically accurate stellar tints
export const drydockTheme: ThemeTokens = {
  bgPrimary: 0x0a0a0a,
  bgSecondary: 0x111111,
  bgTertiary: 0x1a1a1a,
  accent: 0xff8c00,
  textPrimary: 0xe0e0e0,
  textSecondary: 0x666666,
  spectral: {
    O: 0x9bb0ff,
    B: 0xaabfff,
    A: 0xcad7ff,
    F: 0xf8f7ff,
    G: 0xfff4ea,
    K: 0xffddb4,
    M: 0xffbd6f,
  },
  fieldStar: 0x334455,
  jumpLine: 0x2a3a4a,
  jumpLineAlpha: 0.7,
  hexStroke: 0x4a8ab0,
  // Rocky planets: warm earth tones (browns, greens, grays)
  planetRocky: [0x8b7355, 0x6b8e5a, 0x9e8c6c, 0x7a7a7a, 0xa0785a],
  // Gas giants: blue-purple tones
  planetGas: [0x6a5acd, 0x4169e1, 0x7b68ee, 0x5b7ec2, 0x8470b8],

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
