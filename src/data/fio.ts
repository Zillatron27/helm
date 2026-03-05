import type { FioSystem, FioPlanet, FioPlanetSummary } from "../types/index.js";

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
