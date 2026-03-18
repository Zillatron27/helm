import type { ResourceMatch, PlanetResourceMatch, CogcMatch } from "../types/index.js";
import { fetchAllPlanetsFull } from "./fio.js";

// Precomputed index: MaterialId → systems containing that resource
const systemIndex: Map<string, ResourceMatch[]> = new Map();

// Precomputed index: MaterialId → planets with that resource
const planetIndex: Map<string, PlanetResourceMatch[]> = new Map();

// All material IDs that appear as extractable resources on planets
const extractableMaterialIds: Set<string> = new Set();

// COGC index: category → planets with that active program
const cogcIndex: Map<string, CogcMatch[]> = new Map();

let ready = false;
const readyCallbacks: Array<() => void> = [];

export function isResourceIndexReady(): boolean {
  return ready;
}

export function onResourceIndexReady(fn: () => void): void {
  if (ready) {
    fn();
  } else {
    readyCallbacks.push(fn);
  }
}

export async function initResourceIndex(): Promise<void> {
  const planets = await fetchAllPlanetsFull();

  // Temporary accumulator: materialId → systemId → { bestFactor, planetCount }
  const systemAccum: Map<string, Map<string, { bestFactor: number; planetCount: number }>> = new Map();

  for (const planet of planets) {
    // Resolve systemId from the planet's SystemId field
    // The FIO full planet data has SystemId as a UUID
    const systemId = planet.SystemId;
    if (!systemId) continue;

    for (const resource of planet.Resources) {
      const matId = resource.MaterialId;
      extractableMaterialIds.add(matId);

      // Planet-level entry
      let planetList = planetIndex.get(matId);
      if (!planetList) {
        planetList = [];
        planetIndex.set(matId, planetList);
      }
      planetList.push({
        planetNaturalId: planet.PlanetNaturalId,
        systemId,
        factor: resource.Factor,
        resourceType: resource.ResourceType,
      });

      // System-level accumulator
      let sysMap = systemAccum.get(matId);
      if (!sysMap) {
        sysMap = new Map();
        systemAccum.set(matId, sysMap);
      }
      const existing = sysMap.get(systemId);
      if (existing) {
        existing.bestFactor = Math.max(existing.bestFactor, resource.Factor);
        existing.planetCount++;
      } else {
        sysMap.set(systemId, { bestFactor: resource.Factor, planetCount: 1 });
      }
    }
  }

  // Build COGC index from COGCPrograms on each planet
  const now = Date.now();
  for (const planet of planets) {
    const programs = planet.COGCPrograms;
    if (!programs) continue;
    for (const prog of programs) {
      if (!prog.ProgramType) continue;
      if (now >= prog.StartEpochMs && now <= prog.EndEpochMs) {
        let list = cogcIndex.get(prog.ProgramType);
        if (!list) {
          list = [];
          cogcIndex.set(prog.ProgramType, list);
        }
        list.push({
          planetNaturalId: planet.PlanetNaturalId,
          systemId: planet.SystemId,
          endsAt: prog.EndEpochMs,
        });
      }
    }
  }

  // Flatten system accumulator into sorted arrays
  for (const [matId, sysMap] of systemAccum) {
    const matches: ResourceMatch[] = [];
    for (const [systemId, data] of sysMap) {
      matches.push({ systemId, bestFactor: data.bestFactor, planetCount: data.planetCount });
    }
    matches.sort((a, b) => b.bestFactor - a.bestFactor);
    systemIndex.set(matId, matches);
  }

  ready = true;
  console.log(`Resource index: ${extractableMaterialIds.size} materials across ${planets.length} planets`);

  for (const fn of readyCallbacks) {
    fn();
  }
  readyCallbacks.length = 0;
}

export function getSystemsWithResource(materialId: string): ResourceMatch[] {
  return systemIndex.get(materialId) ?? [];
}

export function getPlanetsWithResource(materialId: string): PlanetResourceMatch[] {
  return planetIndex.get(materialId) ?? [];
}

export function getExtractableResourceMaterialIds(): Set<string> {
  return extractableMaterialIds;
}

export function getCogcProgramPlanets(category: string): CogcMatch[] {
  return cogcIndex.get(category) ?? [];
}

export function getActiveCogcCategories(): string[] {
  return Array.from(cogcIndex.keys());
}

export function getSystemsWithCogcProgram(category: string): Set<string> {
  const matches = cogcIndex.get(category);
  if (!matches) return new Set();
  return new Set(matches.map((m) => m.systemId));
}
