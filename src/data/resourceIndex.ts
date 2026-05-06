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

/**
 * Per-system AND match: a system qualifies when every selected
 * material is present on at least one of its planets (not necessarily
 * the same planet — the production-chain use case is "I want a system
 * with both ALO and HAL anywhere I can build bases on").
 *
 * Bottleneck = min over selected materials of (best factor that
 * material reaches anywhere in the system). It's the limiting
 * resource for a chain that wants the highest-yield base for each.
 *
 * Output shape matches single-resource ResourceMatch so the
 * concentration-dot pipeline can consume single- or multi-resource
 * input uniformly. With 1 selected material this degenerates to the
 * single-material case (best factor = best planet factor in system).
 */
export function getSystemsWithAllResources(materialIds: readonly string[]): ResourceMatch[] {
  if (materialIds.length === 0) return [];

  // Per material → systemId → best factor in that system.
  const perMaterial: Map<string, Map<string, number>> = new Map();
  for (const matId of materialIds) {
    const list = planetIndex.get(matId);
    if (!list || list.length === 0) return []; // any material absent → AND empty
    const sysMap = new Map<string, number>();
    for (const p of list) {
      const existing = sysMap.get(p.systemId);
      if (existing === undefined || p.factor > existing) sysMap.set(p.systemId, p.factor);
    }
    perMaterial.set(matId, sysMap);
  }

  // System qualifies when it appears in every per-material map.
  const seedMap = perMaterial.get(materialIds[0]!)!;
  const out: ResourceMatch[] = [];
  for (const sysId of seedMap.keys()) {
    let bottleneck = Infinity;
    let qualifies = true;
    for (const matId of materialIds) {
      const f = perMaterial.get(matId)!.get(sysId);
      if (f === undefined) { qualifies = false; break; }
      if (f < bottleneck) bottleneck = f;
    }
    if (!qualifies) continue;
    // planetCount is the per-system planet count for the FIRST material,
    // kept for parity with single-resource ResourceMatch — not really
    // meaningful in multi mode, but only used as supplemental info.
    const planetCount = systemIndex.get(materialIds[0]!)?.find((m) => m.systemId === sysId)?.planetCount ?? 1;
    out.push({ systemId: sysId, bestFactor: bottleneck, planetCount });
  }
  out.sort((a, b) => b.bestFactor - a.bestFactor);
  return out;
}

/**
 * Planet IDs to include in the bright set for the AND filter — every
 * planet in a qualifying system that contributes any of the selected
 * materials. (Planets in qualifying systems that have none of the
 * selected materials are dimmed; non-qualifying systems are dimmed
 * entirely.)
 */
export function getQualifyingPlanetIds(materialIds: readonly string[]): Set<string> {
  if (materialIds.length === 0) return new Set();
  const matches = getSystemsWithAllResources(materialIds);
  if (matches.length === 0) return new Set();
  const qualifyingSystems = new Set(matches.map((m) => m.systemId));
  const out = new Set<string>();
  for (const matId of materialIds) {
    const list = planetIndex.get(matId);
    if (!list) continue;
    for (const p of list) {
      if (qualifyingSystems.has(p.systemId)) out.add(p.planetNaturalId);
    }
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
 * selected materials, with each planet's per-material factor (or
 * absent in the map if the planet doesn't have that material).
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
