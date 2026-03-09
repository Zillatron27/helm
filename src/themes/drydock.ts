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
};
