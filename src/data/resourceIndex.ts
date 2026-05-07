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

// Reverse lookup: planetNaturalId → active COGC program
const planetCogcLookup: Map<string, { category: string; endsAt: number }> = new Map();

// Planet display name lookup: planetNaturalId → PlanetName (or naturalId
// if no specific name). Used by the results sidebar for rows across the
// universe — planets aren't lazy-loaded per system there.
const planetNameByNaturalId: Map<string, string> = new Map();

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

    // Cache the display name for sidebar rows; FIO falls back to natural
    // id when no specific name is set, which is what we want as default.
    if (planet.PlanetName) {
      planetNameByNaturalId.set(planet.PlanetNaturalId, planet.PlanetName);
    }

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
      // Only index actual COGC programs — excludes migration/education programs
      if (!prog.ProgramType.startsWith("ADVERTISING_")) continue;
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
        planetCogcLookup.set(planet.PlanetNaturalId, {
          category: prog.ProgramType,
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

/**
 * Per-system OR match: a system qualifies when at least one selected
 * material is present on at least one of its planets. Use case: scout
 * for any of these resources — empire scouting / base-site shopping.
 *
 * bestFactor = max factor across any selected material on any planet
 * in the system (the system's best yield for any picked resource).
 * planetCount = distinct planets in the system contributing any
 * selected material.
 *
 * Output shape matches single-resource ResourceMatch so the
 * concentration-dot pipeline consumes single- or multi-resource input
 * uniformly. With 1 selected material this degenerates to the
 * single-material case.
 */
export function getSystemsWithAnyResource(materialIds: readonly string[]): ResourceMatch[] {
  if (materialIds.length === 0) return [];

  // systemId → { bestFactor, planetIds (for distinct count) }
  const accum = new Map<string, { bestFactor: number; planets: Set<string> }>();
  for (const matId of materialIds) {
    const list = planetIndex.get(matId);
    if (!list) continue;
    for (const p of list) {
      const entry = accum.get(p.systemId);
      if (entry) {
        if (p.factor > entry.bestFactor) entry.bestFactor = p.factor;
        entry.planets.add(p.planetNaturalId);
      } else {
        accum.set(p.systemId, { bestFactor: p.factor, planets: new Set([p.planetNaturalId]) });
      }
    }
  }

  const out: ResourceMatch[] = [];
  for (const [systemId, data] of accum) {
    out.push({ systemId, bestFactor: data.bestFactor, planetCount: data.planets.size });
  }
  out.sort((a, b) => b.bestFactor - a.bestFactor);
  return out;
}

/** A single (planet, material) contribution row. */
export interface PlanetMaterialMatch {
  planetNaturalId: string;
  systemId: string;
  materialId: string;
  factor: number;
}

/**
 * Flat list of every (planet, material) contribution across the
 * universe for the selected materials. A planet with multiple
 * selected materials appears once per material. Used by the results
 * sidebar — same shape as the multi-resource panel rows but global,
 * not per-system.
 */
export function getResourceContributions(materialIds: readonly string[]): PlanetMaterialMatch[] {
  const out: PlanetMaterialMatch[] = [];
  for (const matId of materialIds) {
    const list = planetIndex.get(matId);
    if (!list) continue;
    for (const p of list) {
      out.push({
        planetNaturalId: p.planetNaturalId,
        systemId: p.systemId,
        materialId: matId,
        factor: p.factor,
      });
    }
  }
  return out;
}

/**
 * Every planet (by naturalId) that contributes at least one of the
 * selected materials. Bright set for the OR filter — planets in
 * matching systems that have none of the selected materials are
 * dimmed alongside non-matching systems.
 */
export function getPlanetsWithAnyResource(materialIds: readonly string[]): Set<string> {
  if (materialIds.length === 0) return new Set();
  const out = new Set<string>();
  for (const matId of materialIds) {
    const list = planetIndex.get(matId);
    if (!list) continue;
    for (const p of list) out.add(p.planetNaturalId);
  }
  return out;
}

/** Per-planet contribution row for the panel view. */
export interface PlanetFactorRow {
  planetNaturalId: string;
  /** factor keyed by MaterialId; absent key = planet doesn't have that material */
  factors: Map<string, number>;
}

/**
 * For a given system, list every planet that has at least one of the
 * selected materials, with each planet's per-material factor.
 */
export function getMatchingPlanetsInSystem(
  systemId: string,
  materialIds: readonly string[],
): PlanetFactorRow[] {
  if (materialIds.length === 0) return [];
  const accum = new Map<string, Map<string, number>>();
  for (const matId of materialIds) {
    const list = planetIndex.get(matId);
    if (!list) continue;
    for (const p of list) {
      if (p.systemId !== systemId) continue;
      let entry = accum.get(p.planetNaturalId);
      if (!entry) {
        entry = new Map();
        accum.set(p.planetNaturalId, entry);
      }
      entry.set(matId, p.factor);
    }
  }
  const rows: PlanetFactorRow[] = [];
  for (const [planetNaturalId, factors] of accum) {
    rows.push({ planetNaturalId, factors });
  }
  // Sort so planets contributing high-factor resources come first.
  rows.sort((a, b) => maxFactor(b.factors) - maxFactor(a.factors));
  return rows;
}

function maxFactor(factors: Map<string, number>): number {
  let max = 0;
  for (const f of factors.values()) if (f > max) max = f;
  return max;
}

export function getExtractableResourceMaterialIds(): Set<string> {
  return extractableMaterialIds;
}

export function getPlanetDisplayName(planetNaturalId: string): string {
  return planetNameByNaturalId.get(planetNaturalId) ?? planetNaturalId;
}

export function getCogcProgramPlanets(category: string): CogcMatch[] {
  return cogcIndex.get(category) ?? [];
}

export function getActiveCogcCategories(): string[] {
  return Array.from(cogcIndex.keys());
}

/** Get the active COGC program for a specific planet, if any. */
export function getPlanetCogcProgram(planetNaturalId: string): { category: string; endsAt: number } | null {
  return planetCogcLookup.get(planetNaturalId) ?? null;
}

export function getSystemsWithCogcProgram(category: string): Set<string> {
  const matches = cogcIndex.get(category);
  if (!matches) return new Set();
  return new Set(matches.map((m) => m.systemId));
}
