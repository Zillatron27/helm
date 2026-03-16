import type { FioSystem, FioPlanet, FioPlanetSummary, FioCxStation, FioMaterial, FioExchangeAll, FioSettledPlanet, FioInfrastructurePlanet } from "../types/index.js";

const FIO_BASE = "https://rest.fnar.net";

export async function fetchSystems(): Promise<FioSystem[]> {
  const response = await fetch(`${FIO_BASE}/systemstars`);

  if (!response.ok) {
    throw new Error(
      `FIO API error: ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("FIO API returned empty or invalid system data");
  }

  // Validate first item has required fields
  const sample = data[0] as Record<string, unknown>;
  const required = [
    "SystemId",
    "Name",
    "Type",
    "PositionX",
    "PositionY",
    "Connections",
  ];
  for (const field of required) {
    if (!(field in sample)) {
      throw new Error(`FIO API response missing required field: ${field}`);
    }
  }

  return data as FioSystem[];
}

export async function fetchSystemPlanets(
  naturalId: string
): Promise<FioPlanet[]> {
  const response = await fetch(`${FIO_BASE}/planet/system/${naturalId}`);

  if (!response.ok) {
    throw new Error(
      `FIO planet API error: ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("FIO planet API returned invalid data");
  }

  // Empty array is valid — some systems may have no planets
  if (data.length === 0) {
    return [];
  }

  // Validate first item has required fields
  const sample = data[0] as Record<string, unknown>;
  const required = [
    "PlanetId",
    "PlanetNaturalId",
    "SystemId",
    "Surface",
    "Gravity",
    "Temperature",
    "Fertility",
    "Resources",
    "OrbitIndex",
  ];
  for (const field of required) {
    if (!(field in sample)) {
      throw new Error(
        `FIO planet response missing required field: ${field}`
      );
    }
  }

  return data as FioPlanet[];
}

export async function fetchAllPlanetNames(): Promise<FioPlanetSummary[]> {
  const response = await fetch(`${FIO_BASE}/planet/allplanets`);

  if (!response.ok) {
    throw new Error(
      `FIO planet index API error: ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("FIO planet index API returned empty or invalid data");
  }

  // Validate first item has required fields
  const sample = data[0] as Record<string, unknown>;
  if (!("PlanetNaturalId" in sample) || !("PlanetName" in sample)) {
    throw new Error(
      "FIO planet index response missing required fields: PlanetNaturalId, PlanetName"
    );
  }

  return data as FioPlanetSummary[];
}

export async function fetchCxStations(): Promise<FioCxStation[]> {
  const response = await fetch(`${FIO_BASE}/exchange/station`);

  if (!response.ok) {
    throw new Error(
      `FIO CX station API error: ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("FIO CX station API returned empty or invalid data");
  }

  const sample = data[0] as Record<string, unknown>;
  const required = ["ComexCode", "NaturalId", "Name", "SystemId", "CountryCode", "CurrencyCode"];
  for (const field of required) {
    if (!(field in sample)) {
      throw new Error(`FIO CX station response missing required field: ${field}`);
    }
  }

  return data as FioCxStation[];
}

export interface FioPlanetSiteCount {
  PlanetNaturalId: string;
  SitesCount: number;
}

export async function fetchExchangeAll(): Promise<FioExchangeAll[]> {
  const response = await fetch(`${FIO_BASE}/exchange/all`);
  if (!response.ok) throw new Error(`FIO exchange/all: ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("FIO exchange/all returned invalid data");
  return data as FioExchangeAll[];
}

export async function fetchSettledPlanets(): Promise<FioSettledPlanet[]> {
  const response = await fetch(`${FIO_BASE}/planet/allplanets/settled`);
  if (!response.ok) throw new Error(`FIO settled planets: ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("FIO settled planets returned invalid data");
  return data as FioSettledPlanet[];
}

export async function fetchPlanetInfrastructure(planetNaturalId: string): Promise<FioInfrastructurePlanet> {
  const response = await fetch(`${FIO_BASE}/infrastructure/${planetNaturalId}`);
  if (!response.ok) throw new Error(`FIO infrastructure/${planetNaturalId}: ${response.status}`);
  return response.json() as Promise<FioInfrastructurePlanet>;
}

export async function fetchAllPlanetsFull(): Promise<FioPlanet[]> {
  const response = await fetch(`${FIO_BASE}/planet/allplanets/full`);
  if (!response.ok) throw new Error(`FIO allplanets/full: ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("FIO allplanets/full returned invalid data");
  return data as FioPlanet[];
}

export async function fetchPlanetSites(): Promise<FioPlanetSiteCount[]> {
  const response = await fetch(`${FIO_BASE}/planet/sites/all`);

  if (!response.ok) {
    throw new Error(
      `FIO planet sites API error: ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("FIO planet sites API returned invalid data");
  }

  if (data.length === 0) return [];

  const sample = data[0] as Record<string, unknown>;
  if (!("PlanetNaturalId" in sample) || !("SitesCount" in sample)) {
    throw new Error(
      "FIO planet sites response missing required fields: PlanetNaturalId, SitesCount"
    );
  }

  return data as FioPlanetSiteCount[];
}

export async function fetchMaterials(): Promise<FioMaterial[]> {
  const response = await fetch(`${FIO_BASE}/material/allmaterials`);

  if (!response.ok) {
    throw new Error(
      `FIO materials API error: ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("FIO materials API returned empty or invalid data");
  }

  const sample = data[0] as Record<string, unknown>;
  if (!("MaterialId" in sample) || !("Ticker" in sample)) {
    throw new Error(
      "FIO materials response missing required fields: MaterialId, Ticker"
    );
  }

  return data as FioMaterial[];
}
