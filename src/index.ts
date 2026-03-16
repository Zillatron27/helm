// Factory
export { createMap } from "./factory.js";
export type { HelmInstance, CameraState, CameraAnimationOptions } from "./factory.js";

// Re-export Container type for consumers to type overlay layers without importing pixi.js
export type { Container } from "pixi.js";

// Data (read-only queries)
export {
  getSystems,
  getConnections,
  getWorldBounds,
  getSectorHexes,
  isLoaded,
  getSystemById,
  getPlanetsForSystem,
  getCxForSystem,
  getAllCxStations,
  getMaterialTicker,
  getNeighbours,
  getGalaxyGatewayConnections,
  getGatewaysForPlanet,
  isGatewaySystem,
  getSystemByNaturalId,
} from "./data/cache.js";

// Pathfinding
export { findRoute } from "./data/pathfinding.js";

// Search
export { search, getSystemUuidByNaturalId } from "./data/searchIndex.js";

// State
export {
  getViewLevel,
  getSelectedEntity,
  getFocusedSystemId,
  setViewLevel,
  setSelectedEntity,
  setFocusedSystem,
  getActiveRoute,
  setActiveRoute,
  getSearchFocused,
  setSearchFocused,
  onStateChange,
  getGatewaysVisible,
  setGatewaysVisible,
  offStateChange,
} from "./ui/state.js";

// Theme
export {
  getTheme,
  getSpectralColour,
  getActiveThemeId,
  setTheme,
  onThemeChange,
  offThemeChange,
  initTheme,
  applyCssProperties,
} from "./ui/theme.js";

export { themePresets } from "./themes/index.js";
export type { ThemePreset } from "./themes/index.js";

// Types
export type {
  FioSystemConnection,
  FioSystem,
  FioPlanetResource,
  FioPlanet,
  StarSystem,
  JumpConnection,
  WorldBounds,
  Planet,
  SectorHex,
  FioCxStation,
  FioMaterial,
  FioPlanetSummary,
  SearchEntry,
  Route,
  GatewayJsonEntry,
  GatewayConnection,
  GatewayEndpoint,
  ThemeTokens,
  SpectralType,
  ViewLevel,
  SelectedEntity,
} from "./types/index.js";
