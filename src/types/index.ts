// FIO API response types — verified against live /systemstars endpoint

export interface FioSystemConnection {
  SystemConnectionId: string;
  ConnectingId: string;
}

export interface FioSystem {
  SystemId: string;
  Name: string;
  NaturalId: string;
  Type: string;
  PositionX: number;
  PositionY: number;
  PositionZ: number;
  SectorId: string;
  SubSectorId: string;
  Connections: FioSystemConnection[];
  UserNameSubmitted: string;
  Timestamp: string;
}

// FIO planet API types — verified against live /planet/system/{naturalId}

export interface FioPlanetResource {
  MaterialId: string;
  ResourceType: string;
  Factor: number;
}

export interface FioPlanet {
  PlanetId: string;
  PlanetNaturalId: string;
  PlanetName: string;
  SystemId: string;
  Gravity: number;
  MagneticField: number;
  Mass: number;
  MassEarth: number;
  Pressure: number;
  Radiation: number;
  Radius: number;
  Sunlight: number;
  Surface: boolean;
  Temperature: number;
  Fertility: number;
  Resources: FioPlanetResource[];
  BuildRequirements: unknown[];
  ProductionFees: unknown[];
  HasLocalMarket: boolean;
  HasChamberOfCommerce: boolean;
  HasWarehouse: boolean;
  HasAdministrationCenter: boolean;
  HasShipyard: boolean;
  FactionCode: string | null;
  FactionName: string | null;
  CurrencyCode: string | null;
  PlanetTier: number;
  COGCProgramStatus: string | null;
  // Orbital fields (undocumented in FIO reference, verified from live API)
  OrbitIndex: number;
  OrbitSemiMajorAxis: number;
  OrbitEccentricity: number;
  OrbitInclination: number;
  OrbitRightAscension: number;
  OrbitPeriapsis: number;
}

// Internal processed types

export type SpectralType = "O" | "B" | "A" | "F" | "G" | "K" | "M";

export interface StarSystem {
  id: string;
  name: string;
  naturalId: string;
  spectralType: SpectralType;
  worldX: number;
  worldY: number;
  connectionIds: string[];
}

export interface JumpConnection {
  key: string;
  fromId: string;
  toId: string;
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

// Processed planet type for rendering and panels
export interface Planet {
  id: string;
  name: string;
  naturalId: string;
  systemId: string;
  surface: boolean;
  gravity: number;
  temperature: number;
  pressure: number;
  radiation: number;
  fertility: number;
  radius: number;
  sunlight: number;
  magneticField: number;
  resources: FioPlanetResource[];
  orbitIndex: number;
  ringRadius: number;
  displayRadius: number;
  colour: number;
  tier: number;
  factionCode: string | null;
  factionName: string | null;
  hasLocalMarket: boolean;
  hasChamberOfCommerce: boolean;
  hasWarehouse: boolean;
  hasAdministrationCenter: boolean;
  hasShipyard: boolean;
}

// Sector hex grid positions (grid-snapped to ideal hex lattice)
export interface SectorHex {
  sectorId: string;
  sectorCode: string; // two-letter code from system NaturalId (e.g. "UV", "ZV")
  worldX: number;
  worldY: number;
}

// Lightweight planet index from GET /planet/allplanets
export interface FioPlanetSummary {
  PlanetNaturalId: string;
  PlanetName: string;
}

// Unified search result
export interface SearchEntry {
  type: "system" | "planet";
  id: string; // UUID for systems, PlanetNaturalId for planets
  name: string; // Display name
  naturalId: string;
  systemId: string; // Parent system UUID (same as id for systems)
}

// Pathfinding result
export interface Route {
  systemIds: string[]; // Ordered UUIDs from start to end
  jumpCount: number;
}

// UI state types

export type ViewLevel = "galaxy" | "system";

export type SelectedEntity =
  | { type: "system"; id: string }
  | { type: "planet"; id: string }
  | null;

// Theme types

export interface ThemeTokens {
  bgPrimary: number;
  bgSecondary: number;
  bgTertiary: number;
  accent: number;
  textPrimary: number;
  textSecondary: number;
  spectral: Record<SpectralType, number>;
  fieldStar: number;
  jumpLine: number;
  jumpLineAlpha: number;
  planetRocky: number[];
  planetGas: number[];
}
