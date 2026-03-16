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
  buildRequirements: { ticker: string; amount: number }[];
}

// Sector hex grid positions (grid-snapped to ideal hex lattice)
export interface SectorHex {
  sectorId: string;
  sectorCode: string; // two-letter code from system NaturalId (e.g. "UV", "ZV")
  worldX: number;
  worldY: number;
}

// FIO CX station from GET /exchange/station
export interface FioCxStation {
  ComexCode: string;
  NaturalId: string;
  Name: string;
  SystemId: string;
  SystemNaturalId: string;
  SystemName: string;
  CountryCode: string;
  CurrencyCode: string;
}

// FIO material from GET /material/allmaterials
export interface FioMaterial {
  MaterialId: string;
  Ticker: string;
  Name: string;
  CategoryName: string;
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

// Gateway types

export interface GatewayJsonEntry {
  name: string;
  fromPlanet: string;
  fromSystem: string;
  toPlanet: string;
  toSystem: string;
}

export interface GatewayConnection {
  fromSystemId: string;
  toSystemId: string;
  name: string;
}

export interface GatewayEndpoint {
  planetNaturalId: string;
  destinationPlanetNaturalId: string;
  destinationSystemNaturalId: string;
  destinationSystemId: string;
  name: string;
}

// CX distance precomputed result
export interface CxDistanceEntry {
  code: string;        // ComexCode, e.g. "AI1"
  label: string;       // NaturalId, e.g. "ANT", "MOR"
  systemId: string;    // CX system UUID for routing
  currency: string;    // CurrencyCode, e.g. "AIC"
  jumps: number;       // jump count, -1 if unreachable
  viaGateway: boolean; // true if shortest path crosses a gateway edge
}

// FIO exchange/all response
export interface FioExchangeAll {
  MaterialTicker: string;
  ExchangeCode: string;
  MMBuy: number | null;
  MMSell: number | null;
  PriceAverage: number;
  AskCount: number;
  Ask: number | null;
  Supply: number;
  BidCount: number;
  Bid: number | null;
  Demand: number;
}

// Processed exchange price
export interface ExchangePrice {
  ticker: string;
  exchangeCode: string;
  currency: string;
  ask: number | null;
  bid: number | null;
  supply: number;
  demand: number;
  priceAverage: number;
}

// FIO settled planet response
export interface FioSettledPlanet {
  Name: string;
  NaturalId: string;
  BaseCount: number;
  HasADM: boolean;
  HasLM: boolean;
  HasWarehouse: boolean;
  HasCOGC: boolean;
  GovernorUsername: string | null;
  GovernorCorporationName: string | null;
  GovernorCorporationCode: string | null;
  FactionCode: string | null;
}

// Governor info
export interface GovernorInfo {
  username: string | null;
  corporationName: string | null;
  corporationCode: string | null;
}

// FIO infrastructure per-planet response
export interface FioInfrastructureReport {
  SimulationPeriod: number;
  NextPopulationPioneer: number;
  NextPopulationSettler: number;
  NextPopulationTechnician: number;
  NextPopulationEngineer: number;
  NextPopulationScientist: number;
  AverageHappinessPioneer: number;
  AverageHappinessSettler: number;
  AverageHappinessTechnician: number;
  AverageHappinessEngineer: number;
  AverageHappinessScientist: number;
  UnemploymentRatePioneer: number;
  UnemploymentRateSettler: number;
  UnemploymentRateTechnician: number;
  UnemploymentRateEngineer: number;
  UnemploymentRateScientist: number;
}

export interface FioInfrastructureProject {
  Ticker: string;
  Name: string;
  Level: number;
  ActiveLevel: number;
  CurrentLevel: number;
  UpgradeStatus: string | null;
}

export interface FioInfrastructurePlanet {
  InfrastructureProjects: FioInfrastructureProject[];
  InfrastructureReports: FioInfrastructureReport[];
}

// Processed infrastructure data
export interface InfrastructureData {
  population: { tier: string; count: number; happiness: number; unemployment: number }[];
  projects: { ticker: string; name: string; level: number }[];
}

// Resource filter types

export interface ResourceMatch {
  systemId: string;
  bestFactor: number;
  planetCount: number;
}

export interface PlanetResourceMatch {
  planetNaturalId: string;
  systemId: string;
  factor: number;
  resourceType: string;
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
  hexStroke: number;
  planetRocky: number[];
  planetGas: number[];
}
