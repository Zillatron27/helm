import type {
  FioSystem,
  FioPlanet,
  FioCxStation,
  FioMaterial,
  StarSystem,
  JumpConnection,
  SpectralType,
  WorldBounds,
  Planet,
  SectorHex,
  GatewayJsonEntry,
  GatewayConnection,
  GatewayEndpoint,
} from "../types/index.js";
import { fetchSystems, fetchSystemPlanets, fetchCxStations, fetchMaterials } from "./fio.js";
import { getTheme } from "../ui/theme.js";
import gatewayData from "./gateways.json" with { type: "json" };

const WORLD_SCALE = 4;
const VALID_SPECTRAL: Set<string> = new Set(["O", "B", "A", "F", "G", "K", "M"]);

// Orbital ring visual range (world units from centre of system view)
const RING_MIN = 80;
const RING_MAX = 400;

// Planet display radius ranges
const ROCKY_RADIUS_MIN = 10;
const ROCKY_RADIUS_MAX = 16;
const GAS_RADIUS_MIN = 18;
const GAS_RADIUS_MAX = 26;

// Hex grid constants (raw FIO coordinate space, R = 100)
const HEX_COL_SPACING = 150; // 3/2 * R
const HEX_ROW_SPACING = 173.205; // sqrt(3) * R
const HEX_COL_OFFSET = 86.603; // sqrt(3)/2 * R

let systems: StarSystem[] = [];
let connections: JumpConnection[] = [];
let sectorHexes: SectorHex[] = [];
let worldBounds: WorldBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
let loaded = false;

// O(1) lookups by UUID
const systemById: Map<string, StarSystem> = new Map();

// Planet cache keyed by system natural ID
const planetsBySystem: Map<string, Planet[]> = new Map();

// Track in-flight fetches to avoid duplicate requests
const pendingFetches: Map<string, Promise<Planet[]>> = new Map();

// CX stations keyed by SystemId
const cxBySystem: Map<string, FioCxStation> = new Map();

// Material ticker lookup: MaterialId → Ticker
const materialTickers: Map<string, string> = new Map();

// Full material list for resource picker
let allMaterials: FioMaterial[] = [];
const materialByTicker: Map<string, FioMaterial> = new Map();

// Merged adjacency index (jump connections + gateway connections)
const adjacency: Map<string, Set<string>> = new Map();

// Gateway data
const systemByNaturalId: Map<string, StarSystem> = new Map();
let galaxyGatewayConnections: GatewayConnection[] = [];
const gatewaysByPlanet: Map<string, GatewayEndpoint[]> = new Map();
const gatewaySystemIds: Set<string> = new Set();

function validateSpectralType(type: string): SpectralType {
  if (VALID_SPECTRAL.has(type)) {
    return type as SpectralType;
  }
  console.warn(`Unknown spectral type "${type}", defaulting to G`);
  return "G";
}

function processSystems(raw: FioSystem[]): {
  systems: StarSystem[];
  connections: JumpConnection[];
  bounds: WorldBounds;
  hexes: SectorHex[];
} {
  // Compute centroid for centering
  let sumX = 0;
  let sumY = 0;
  for (const s of raw) {
    sumX += s.PositionX;
    sumY += s.PositionY;
  }
  const centroidX = sumX / raw.length;
  const centroidY = sumY / raw.length;

  // Build star systems with centred, scaled coordinates
  const starSystems: StarSystem[] = raw.map((s) => ({
    id: s.SystemId,
    name: s.Name,
    naturalId: s.NaturalId,
    spectralType: validateSpectralType(s.Type),
    worldX: (s.PositionX - centroidX) * WORLD_SCALE,
    worldY: -(s.PositionY - centroidY) * WORLD_SCALE,
    connectionIds: s.Connections.map((c) => c.ConnectingId),
  }));

  // Build systemById index
  for (const s of starSystems) {
    systemById.set(s.id, s);
  }

  // Compute world bounds
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of starSystems) {
    if (s.worldX < minX) minX = s.worldX;
    if (s.worldX > maxX) maxX = s.worldX;
    if (s.worldY < minY) minY = s.worldY;
    if (s.worldY > maxY) maxY = s.worldY;
  }
  const bounds: WorldBounds = {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };

  // Deduplicate connections — sort each pair lexicographically for unique key
  const edgeSet = new Set<string>();
  const jumpConnections: JumpConnection[] = [];
  for (const s of raw) {
    for (const c of s.Connections) {
      const [a, b] =
        s.SystemId < c.ConnectingId
          ? [s.SystemId, c.ConnectingId]
          : [c.ConnectingId, s.SystemId];
      const key = `${a}:${b}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        jumpConnections.push({ key, fromId: a, toId: b });
      }
    }
  }

  // Compute sector hex positions: group by SectorId, centroid, grid-snap
  const sectorSystems = new Map<string, FioSystem[]>();
  for (const s of raw) {
    let group = sectorSystems.get(s.SectorId);
    if (!group) {
      group = [];
      sectorSystems.set(s.SectorId, group);
    }
    group.push(s);
  }

  const hexes: SectorHex[] = [];
  for (const [sectorId, group] of sectorSystems) {
    // Sector code: two-letter prefix from any system's NaturalId (e.g. "UV-351a" → "UV")
    const sectorCode = group[0]!.NaturalId.split("-")[0]!;

    // Raw centroid of systems in this sector
    let sx = 0;
    let sy = 0;
    for (const s of group) {
      sx += s.PositionX;
      sy += s.PositionY;
    }
    const rawCx = sx / group.length;
    const rawCy = sy / group.length;

    // Grid-snap to ideal hex lattice (flat-top, R=100, origin at 0,0)
    const col = Math.round(rawCx / HEX_COL_SPACING);
    const oddCol = col % 2 !== 0;
    const row = Math.round((rawCy - (oddCol ? HEX_COL_OFFSET : 0)) / HEX_ROW_SPACING);
    const snapX = col * HEX_COL_SPACING;
    const snapY = row * HEX_ROW_SPACING + (oddCol ? HEX_COL_OFFSET : 0);

    // Transform to world coords (same centroid + scale as star systems)
    hexes.push({
      sectorId,
      sectorCode,
      worldX: (snapX - centroidX) * WORLD_SCALE,
      worldY: -(snapY - centroidY) * WORLD_SCALE,
    });
  }

  return { systems: starSystems, connections: jumpConnections, bounds, hexes };
}

function processPlanets(raw: FioPlanet[]): Planet[] {
  if (raw.length === 0) return [];

  const theme = getTheme();

  // Sort by OrbitIndex ascending
  const sorted = [...raw].sort((a, b) => a.OrbitIndex - b.OrbitIndex);

  // Log-scale the orbital radii for visual ring placement
  const axes = sorted.map((p) => Math.max(p.OrbitSemiMajorAxis, 1));
  const logMin = Math.log(Math.min(...axes));
  const logMax = Math.log(Math.max(...axes));
  const logRange = logMax - logMin;

  return sorted.map((p, i) => {
    // Ring radius: log-scaled between RING_MIN and RING_MAX
    let ringRadius: number;
    if (sorted.length === 1 || logRange === 0) {
      ringRadius = (RING_MIN + RING_MAX) / 2;
    } else {
      const logVal = Math.log(Math.max(p.OrbitSemiMajorAxis, 1));
      const t = (logVal - logMin) / logRange;
      ringRadius = RING_MIN + t * (RING_MAX - RING_MIN);
    }

    // Display radius based on type and planet Radius field
    // Normalize Radius: typical range ~4000-70000, log-scale to visual range
    const logR = Math.log(Math.max(p.Radius, 1));
    const normR = Math.min(Math.max((logR - 8) / 3, 0), 1); // ~2980 to ~59874

    let displayRadius: number;
    let colour: number;

    if (p.Surface) {
      // Rocky planet
      displayRadius = ROCKY_RADIUS_MIN + normR * (ROCKY_RADIUS_MAX - ROCKY_RADIUS_MIN);
      // Colour from rocky palette, pick based on fertility/temperature
      const colourIndex = Math.abs(Math.round(p.Fertility * 2 + p.Temperature * 0.01)) % theme.planetRocky.length;
      colour = theme.planetRocky[colourIndex] ?? theme.planetRocky[0]!;
    } else {
      // Gas giant
      displayRadius = GAS_RADIUS_MIN + normR * (GAS_RADIUS_MAX - GAS_RADIUS_MIN);
      const colourIndex = Math.abs(Math.round(i * 1.7)) % theme.planetGas.length;
      colour = theme.planetGas[colourIndex] ?? theme.planetGas[0]!;
    }

    return {
      id: p.PlanetId,
      name: p.PlanetName,
      naturalId: p.PlanetNaturalId,
      systemId: p.SystemId,
      surface: p.Surface,
      gravity: p.Gravity,
      temperature: p.Temperature,
      pressure: p.Pressure,
      radiation: p.Radiation,
      fertility: p.Fertility,
      radius: p.Radius,
      sunlight: p.Sunlight,
      magneticField: p.MagneticField,
      resources: p.Resources,
      orbitIndex: p.OrbitIndex,
      ringRadius,
      displayRadius,
      colour,
      tier: p.PlanetTier,
      factionCode: p.FactionCode,
      factionName: p.FactionName,
      hasLocalMarket: p.HasLocalMarket,
      hasChamberOfCommerce: p.HasChamberOfCommerce,
      hasWarehouse: p.HasWarehouse,
      hasAdministrationCenter: p.HasAdministrationCenter,
      hasShipyard: p.HasShipyard,
      buildRequirements: (p.BuildRequirements as Array<{ MaterialTicker: string; MaterialAmount: number }>).map((br) => ({
        ticker: br.MaterialTicker,
        amount: br.MaterialAmount,
      })),
    };
  });
}

function processGateways(): void {
  // Build NaturalId → system lookup
  for (const s of systems) {
    systemByNaturalId.set(s.naturalId, s);
  }

  const entries = gatewayData.gateways as GatewayJsonEntry[];

  // Deduplicated system-to-system pairs for galaxy view
  const pairSet = new Set<string>();
  const connections: GatewayConnection[] = [];

  for (const entry of entries) {
    const fromSys = systemByNaturalId.get(entry.fromSystem);
    const toSys = systemByNaturalId.get(entry.toSystem);
    if (!fromSys || !toSys) {
      console.warn(`Gateway: could not resolve systems for "${entry.name}"`);
      continue;
    }

    // Galaxy-level: deduplicated system pairs
    const [a, b] = fromSys.id < toSys.id ? [fromSys.id, toSys.id] : [toSys.id, fromSys.id];
    const pairKey = `${a}:${b}`;
    if (!pairSet.has(pairKey)) {
      pairSet.add(pairKey);
      connections.push({ fromSystemId: fromSys.id, toSystemId: toSys.id, name: entry.name });
    }

    // Track gateway systems
    gatewaySystemIds.add(fromSys.id);
    gatewaySystemIds.add(toSys.id);

    // System-level: per-planet endpoints (both directions)
    const fromEndpoint: GatewayEndpoint = {
      planetNaturalId: entry.fromPlanet,
      destinationPlanetNaturalId: entry.toPlanet,
      destinationSystemNaturalId: entry.toSystem,
      destinationSystemId: toSys.id,
      name: entry.name,
    };
    const toEndpoint: GatewayEndpoint = {
      planetNaturalId: entry.toPlanet,
      destinationPlanetNaturalId: entry.fromPlanet,
      destinationSystemNaturalId: entry.fromSystem,
      destinationSystemId: fromSys.id,
      name: entry.name,
    };

    const fromList = gatewaysByPlanet.get(entry.fromPlanet);
    if (fromList) { fromList.push(fromEndpoint); } else { gatewaysByPlanet.set(entry.fromPlanet, [fromEndpoint]); }
    const toList = gatewaysByPlanet.get(entry.toPlanet);
    if (toList) { toList.push(toEndpoint); } else { gatewaysByPlanet.set(entry.toPlanet, [toEndpoint]); }
  }

  galaxyGatewayConnections = connections;
  console.log(`Loaded ${connections.length} gateway connections, ${gatewaySystemIds.size} gateway systems`);
}

export async function loadSystemData(): Promise<void> {
  const raw = await fetchSystems();
  const result = processSystems(raw);
  systems = result.systems;
  connections = result.connections;
  sectorHexes = result.hexes;
  worldBounds = result.bounds;
  loaded = true;

  processGateways();

  // Build merged adjacency index: jump connections + gateway connections
  for (const s of systems) {
    const set = new Set<string>(s.connectionIds);
    adjacency.set(s.id, set);
  }
  for (const gw of galaxyGatewayConnections) {
    adjacency.get(gw.fromSystemId)?.add(gw.toSystemId);
    adjacency.get(gw.toSystemId)?.add(gw.fromSystemId);
  }

  console.log(
    `Loaded ${systems.length} systems, ${connections.length} connections`
  );
  console.log(
    `World bounds: ${worldBounds.width.toFixed(0)} x ${worldBounds.height.toFixed(0)}`
  );
}

export function getSystems(): StarSystem[] {
  return systems;
}

export function getConnections(): JumpConnection[] {
  return connections;
}

export function getWorldBounds(): WorldBounds {
  return worldBounds;
}

export function getSectorHexes(): SectorHex[] {
  return sectorHexes;
}

export function isLoaded(): boolean {
  return loaded;
}

export function getSystemById(id: string): StarSystem | undefined {
  return systemById.get(id);
}

export function getPlanetsForSystem(naturalId: string): Planet[] | null {
  return planetsBySystem.get(naturalId) ?? null;
}

export async function loadPlanetsForSystem(naturalId: string): Promise<Planet[]> {
  // Return cached if available
  const cached = planetsBySystem.get(naturalId);
  if (cached) return cached;

  // Return in-flight fetch if one exists
  const pending = pendingFetches.get(naturalId);
  if (pending) return pending;

  const promise = fetchSystemPlanets(naturalId)
    .then((raw) => {
      const planets = processPlanets(raw);
      planetsBySystem.set(naturalId, planets);
      pendingFetches.delete(naturalId);
      return planets;
    })
    .catch((err) => {
      pendingFetches.delete(naturalId);
      console.error(`Failed to load planets for ${naturalId}:`, err);
      // Cache empty array on failure so we don't retry indefinitely
      planetsBySystem.set(naturalId, []);
      return [] as Planet[];
    });

  pendingFetches.set(naturalId, promise);
  return promise;
}

export async function loadCxStations(): Promise<void> {
  const stations = await fetchCxStations();
  for (const s of stations) {
    cxBySystem.set(s.SystemId, s);
  }
  console.log(`Loaded ${stations.length} CX stations`);
}

export function getCxForSystem(systemId: string): FioCxStation | null {
  return cxBySystem.get(systemId) ?? null;
}

export function getAllCxStations(): FioCxStation[] {
  return Array.from(cxBySystem.values());
}

export async function loadMaterials(): Promise<void> {
  const materials = await fetchMaterials();
  allMaterials = materials;
  for (const m of materials) {
    materialTickers.set(m.MaterialId, m.Ticker);
    materialByTicker.set(m.Ticker, m);
  }
  console.log(`Loaded ${materials.length} material tickers`);
}

export function getMaterialTicker(materialId: string): string {
  return materialTickers.get(materialId) ?? materialId;
}

export function getAllMaterials(): FioMaterial[] {
  return allMaterials;
}

export function getMaterialByTicker(ticker: string): FioMaterial | null {
  return materialByTicker.get(ticker) ?? null;
}

export function getNeighbours(systemId: string): string[] {
  const set = adjacency.get(systemId);
  return set ? Array.from(set) : [];
}

export function getGalaxyGatewayConnections(): GatewayConnection[] {
  return galaxyGatewayConnections;
}

export function getGatewaysForPlanet(planetNaturalId: string): GatewayEndpoint[] | null {
  return gatewaysByPlanet.get(planetNaturalId) ?? null;
}

export function isGatewaySystem(systemId: string): boolean {
  return gatewaySystemIds.has(systemId);
}

export function getSystemByNaturalId(naturalId: string): StarSystem | undefined {
  return systemByNaturalId.get(naturalId);
}

/** Re-apply theme colours to all cached planets without re-fetching from FIO. */
export function recolourCachedPlanets(): void {
  const theme = getTheme();
  for (const planets of planetsBySystem.values()) {
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i]!;
      if (p.surface) {
        const colourIndex = Math.abs(Math.round(p.fertility * 2 + p.temperature * 0.01)) % theme.planetRocky.length;
        p.colour = theme.planetRocky[colourIndex] ?? theme.planetRocky[0]!;
      } else {
        const colourIndex = Math.abs(Math.round(i * 1.7)) % theme.planetGas.length;
        p.colour = theme.planetGas[colourIndex] ?? theme.planetGas[0]!;
      }
    }
  }
}
