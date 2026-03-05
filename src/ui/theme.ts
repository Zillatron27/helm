import type { SpectralType, ThemeTokens } from "../types/index.js";
import { drydockTheme } from "../themes/drydock.js";

export function getTheme(): ThemeTokens {
  return drydockTheme;
}

export function getSpectralColour(type: SpectralType): number {
  return drydockTheme.spectral[type];
}
