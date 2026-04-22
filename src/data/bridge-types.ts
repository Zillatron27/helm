/**
 * Helm Extension bridge envelope + summary types.
 *
 * Canonical source: helm-extension/types/bridge.ts.
 * Keep in sync — both sides must agree on envelope shape.
 *
 * See helm-extension-bridge-protocol.md §4 for envelope semantics.
 */

// ============================================================================
// Summary Types (flat, serializable)
// ============================================================================

export interface SiteSummary {
  siteId: string;
  planetName: string | null;
  planetNaturalId: string | null;
  systemNaturalId: string | null;
  platformCount: number;
  area: number;
}

export interface CargoItem {
  ticker: string;
  category: string;
  amount: number;
  weight: number;
  volume: number;
}

export interface FlightSegmentSummary {
  type: string;
  originSystemNaturalId: string | null;
  destinationSystemNaturalId: string | null;
  originPlanetNaturalId: string | null;
  destinationPlanetNaturalId: string | null;
  departureTimestamp: number;
  arrivalTimestamp: number;
}

export interface ShipSummary {
  shipId: string;
  name: string;
  registration: string;
  blueprintNaturalId: string;
  condition: number;
  status: string;
  locationSystemNaturalId: string | null;
  locationPlanetNaturalId: string | null;
  cargo: {
    weightUsed: number;
    weightCapacity: number;
    volumeUsed: number;
    volumeCapacity: number;
    items: CargoItem[];
  } | null;
  fuel: {
    stlUnits: number;
    stlUnitCapacity: number;
    ftlUnits: number;
    ftlUnitCapacity: number;
  } | null;
}

export interface FlightSummary {
  flightId: string;
  shipId: string;
  originSystemNaturalId: string | null;
  destinationSystemNaturalId: string | null;
  originPlanetNaturalId: string | null;
  destinationPlanetNaturalId: string | null;
  departureTimestamp: number;
  arrivalTimestamp: number;
  segments: FlightSegmentSummary[];
  currentSegmentIndex: number;
}

export interface StorageSummary {
  storageId: string;
  addressableId: string;
  type: string;
  weightUsed: number;
  weightCapacity: number;
  volumeUsed: number;
  volumeCapacity: number;
}

export interface ProductionSummary {
  siteId: string;
  planetNaturalId: string | null;
  systemNaturalId: string | null;
  totalLines: number;
  activeLines: number;
  idleLines: number;
  nextCompletionTimestamp: number | null;
}

export interface WorkforceSummary {
  siteId: string;
  planetNaturalId: string | null;
  systemNaturalId: string | null;
  overallSatisfaction: number;
  burnStatus: "critical" | "warning" | "ok" | "unknown";
  lowestBurnDays: number | null;
}

export interface ContractSummary {
  contractId: string;
  localId: string;
  partnerName: string;
  status: string;
  dueDateTimestamp: number | null;
  isOverdue: boolean;
}

export interface CurrencyAmount {
  currency: string;
  amount: number;
}

export interface ScreenInfo {
  id: string;
  name: string;
  hidden: boolean;
}

export interface BurnThresholds {
  critical: number;
  warning: number;
  resupply: number;
}

export interface WarehouseLocation {
  warehouseId: string;
  storeId: string;
  systemNaturalId: string;
  stationNaturalId: string | null;
}

export interface BurnMaterialSummary {
  materialTicker: string;
  materialName: string | null;
  type: "input" | "output" | "workforce";
  inventoryAmount: number;
  dailyAmount: number;
  daysRemaining: number;
  need: number;
  urgency: "critical" | "warning" | "ok" | "surplus";
}

export interface BridgeSiteBurnSummary {
  siteId: string;
  planetNaturalId: string | null;
  systemNaturalId: string | null;
  planetName: string | null;
  burns: BurnMaterialSummary[];
  burnStatus: "critical" | "warning" | "ok" | "unknown";
  lowestBurnDays: number | null;
}

// ============================================================================
// Full Snapshot (sent on init and reconnect)
// ============================================================================

export interface BridgeSnapshot {
  sites: SiteSummary[];
  ships: ShipSummary[];
  flights: FlightSummary[];
  storage: StorageSummary[];
  production: ProductionSummary[];
  workforce: WorkforceSummary[];
  contracts: ContractSummary[];
  balances: CurrencyAmount[];
  screens: ScreenInfo[];
  screenAssignments: Record<string, string>;
  burnThresholds: BurnThresholds;
  companyName: string | null;
  primaryCurrency: string | null;
  warehouses: WarehouseLocation[];
  siteBurns: BridgeSiteBurnSummary[];
  rprunDetected: boolean;
  rprunFeaturesDisabled: boolean;
  timestamp: number;
}

// ============================================================================
// Incremental Update
// ============================================================================

export type BridgeEntityType = keyof Omit<
  BridgeSnapshot,
  | "timestamp"
  | "screenAssignments"
  | "burnThresholds"
  | "companyName"
  | "primaryCurrency"
  | "rprunDetected"
  | "rprunFeaturesDisabled"
>;

export interface BridgeUpdate {
  entityType: BridgeEntityType;
  data:
    | SiteSummary[]
    | ShipSummary[]
    | FlightSummary[]
    | StorageSummary[]
    | ProductionSummary[]
    | WorkforceSummary[]
    | ContractSummary[]
    | CurrencyAmount[]
    | ScreenInfo[]
    | WarehouseLocation[]
    | BridgeSiteBurnSummary[];
  timestamp: number;
}

// ============================================================================
// Message Protocol (envelopes on the wire)
// ============================================================================

export interface HelmExtensionHelloMessage {
  type: "helm-extension-hello";
  version: string;
}

export interface HelmExtensionHelloAckMessage {
  type: "helm-extension-hello-ack";
  version: string;
  tier?: 2 | 3;
}

export interface HelmInitMessage {
  type: "helm-init";
  snapshot: BridgeSnapshot;
}

export interface HelmUpdateMessage {
  type: "helm-update";
  update: BridgeUpdate;
}

export interface HelmBufferCommandMessage {
  type: "helm-buffer-command";
  command: string;
}

export interface HelmScreenSwitchMessage {
  type: "helm-screen-switch";
  screenId: string;
}

export interface HelmScreenAssignMessage {
  type: "helm-screen-assign";
  planetNaturalId: string;
  screenId: string | null;
}

export interface HelmSettingsUpdateMessage {
  type: "helm-settings-update";
  settings: {
    burnThresholds?: BurnThresholds;
    rprunFeaturesDisabled?: boolean;
  };
}

export type HelmBridgeMessage =
  | HelmExtensionHelloMessage
  | HelmExtensionHelloAckMessage
  | HelmInitMessage
  | HelmUpdateMessage
  | HelmBufferCommandMessage
  | HelmScreenSwitchMessage
  | HelmScreenAssignMessage
  | HelmSettingsUpdateMessage;
