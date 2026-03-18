import type { InfrastructureData } from "../types/index.js";
import { fetchPlanetInfrastructure } from "./fio.js";
import { getPlanetCogcProgram } from "./resourceIndex.js";

const cache = new Map<string, InfrastructureData>();
const pending = new Map<string, Promise<InfrastructureData | null>>();

const TIER_NAMES = ["Pioneer", "Settler", "Technician", "Engineer", "Scientist"];

export function getPlanetInfrastructure(planetNaturalId: string): InfrastructureData | null {
  return cache.get(planetNaturalId) ?? null;
}

/** Lazy-load infrastructure for a planet. Returns cached data or fetches. */
export async function loadPlanetInfrastructure(planetNaturalId: string): Promise<InfrastructureData | null> {
  const cached = cache.get(planetNaturalId);
  if (cached) return cached;

  // Deduplicate concurrent requests
  const existing = pending.get(planetNaturalId);
  if (existing) return existing;

  const promise = fetchAndProcess(planetNaturalId);
  pending.set(planetNaturalId, promise);

  try {
    return await promise;
  } finally {
    pending.delete(planetNaturalId);
  }
}

async function fetchAndProcess(planetNaturalId: string): Promise<InfrastructureData | null> {
  try {
    const raw = await fetchPlanetInfrastructure(planetNaturalId);

    // Get latest report (highest SimulationPeriod)
    const reports = raw.InfrastructureReports;
    if (!reports || reports.length === 0) return null;

    const latest = reports.reduce((a, b) => a.SimulationPeriod > b.SimulationPeriod ? a : b);

    const popFields = [
      latest.NextPopulationPioneer,
      latest.NextPopulationSettler,
      latest.NextPopulationTechnician,
      latest.NextPopulationEngineer,
      latest.NextPopulationScientist,
    ];
    const happyFields = [
      latest.AverageHappinessPioneer,
      latest.AverageHappinessSettler,
      latest.AverageHappinessTechnician,
      latest.AverageHappinessEngineer,
      latest.AverageHappinessScientist,
    ];
    const unemployFields = [
      latest.UnemploymentRatePioneer,
      latest.UnemploymentRateSettler,
      latest.UnemploymentRateTechnician,
      latest.UnemploymentRateEngineer,
      latest.UnemploymentRateScientist,
    ];

    const population = TIER_NAMES.map((tier, i) => ({
      tier,
      count: popFields[i] ?? 0,
      happiness: happyFields[i] ?? 0,
      unemployment: unemployFields[i] ?? 0,
    })).filter((t) => t.count > 0);

    // Deduplicate projects by ticker — keep highest level per ticker
    const projectMap = new Map<string, { ticker: string; name: string; level: number }>();
    for (const p of raw.InfrastructureProjects ?? []) {
      if (p.Level <= 0) continue;
      const existing = projectMap.get(p.Ticker);
      if (!existing || p.Level > existing.level) {
        projectMap.set(p.Ticker, { ticker: p.Ticker, name: p.Name, level: p.Level });
      }
    }
    const projects = Array.from(projectMap.values());

    // COGC program comes from the full planet data (COGCPrograms), not
    // InfrastructurePrograms which only contains population programs.
    const cogcProgram = getPlanetCogcProgram(planetNaturalId);

    const data: InfrastructureData = { population, projects, cogcProgram };
    cache.set(planetNaturalId, data);
    return data;
  } catch (err) {
    console.warn(`Infrastructure fetch failed for ${planetNaturalId}:`, err);
    return null;
  }
}
