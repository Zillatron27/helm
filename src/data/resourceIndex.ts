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

/** Per-planet AND match across multiple materials. */
export interface MultiResourcePlanetMatch {
  planetNaturalId: string;
  systemId: string;
  /** min(factor) across all selected materials — the "bottleneck" the
   * planet imposes on a chain that needs every selected resource. */
  bottleneckFactor: number;
  /** Per-material factor for the planet, keyed by MaterialId. */
  factors: Map<string, number>;
}

/**
 * Return planets that contain every material in the input set, with the
 * bottleneck (minimum) factor across the materials and per-material
 * factors. With 0 materials, returns []. With 1, behaves identically to
 * getPlanetsWithResource projected into the multi shape.
 */
export function getMatchingPlanetsAll(materialIds: readonly string[]): MultiResourcePlanetMatch[] {
  if (materialIds.length === 0) return [];
  // Walk each material's planet list, accumulate per-planet factors.
  const accum = new Map<string, { systemId: string; factors: Map<string, number> }>();
  for (const matId of materialIds) {
    const list = planetIndex.get(matId);
    if (!list || list.length === 0) return []; // Any material absent → AND empty.
    for (const p of list) {
      let entry = accum.get(p.planetNaturalId);
      if (!entry) {
        entry = { systemId: p.systemId, factors: new Map() };
        accum.set(p.planetNaturalId, entry);
      }
      entry.factors.set(matId, p.factor);
    }
  }
  const out: MultiResourcePlanetMatch[] = [];
  for (const [planetNaturalId, { systemId, factors }] of accum) {
    if (factors.size !== materialIds.length) continue; // missing one or more
    let bottleneck = Infinity;
    for (const f of factors.values()) if (f < bottleneck) bottleneck = f;
    out.push({ planetNaturalId, systemId, bottleneckFactor: bottleneck, factors });
  }
  return out;
}

/**
 * Per-system summary for the AND match: each system's score is the best
 * bottleneck among its matching planets. Output shape matches single-
 * resource ResourceMatch so the concentration-dot pipeline can consume
 * either.
 */
export function getMatchingSystemsAll(materialIds: readonly string[]): ResourceMatch[] {
  if (materialIds.length === 0) return [];
  const matches = getMatchingPlanetsAll(materialIds);
  const sysAccum = new Map<string, { bestFactor: number; planetCount: number }>();
  for (const p of matches) {
    const existing = sysAccum.get(p.systemId);
    if (existing) {
      if (p.bottleneckFactor > existing.bestFactor) existing.bestFactor = p.bottleneckFactor;
      existing.planetCount++;
    } else {
      sysAccum.set(p.systemId, { bestFactor: p.bottleneckFactor, planetCount: 1 });
    }
  }
  const out: ResourceMatch[] = [];
  for (const [systemId, data] of sysAccum) {
    out.push({ systemId, bestFactor: data.bestFactor, planetCount: data.planetCount });
  }
  out.sort((a, b) => b.bestFactor - a.bestFactor);
  return out;
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

/** Get the active COGC program for a specific planet, if any. */
export function getPlanetCogcProgram(planetNaturalId: string): { category: string; endsAt: number } | null {
  return planetCogcLookup.get(planetNaturalId) ?? null;
}

export function getSystemsWithCogcProgram(category: string): Set<string> {
  const matches = cogcIndex.get(category);
  if (!matches) return new Set();
  return new Set(matches.map((m) => m.systemId));
}
