import { fetchPlanetSites } from "./fio.js";
import { getSystemUuidByNaturalId } from "./searchIndex.js";

const planetCounts = new Map<string, number>();
const systemCounts = new Map<string, number>();

function extractSystemNaturalId(planetNaturalId: string): string | null {
  const match = planetNaturalId.match(/^(.+\d)[a-z]$/);
  return match ? match[1]! : null;
}

export async function loadSiteCounts(): Promise<void> {
  const sites = await fetchPlanetSites();

  planetCounts.clear();
  systemCounts.clear();

  for (const entry of sites) {
    planetCounts.set(entry.PlanetNaturalId, entry.SitesCount);

    const sysNatId = extractSystemNaturalId(entry.PlanetNaturalId);
    if (!sysNatId) continue;

    const systemId = getSystemUuidByNaturalId(sysNatId);
    if (!systemId) continue;

    systemCounts.set(systemId, (systemCounts.get(systemId) ?? 0) + entry.SitesCount);
  }

  console.log(`Loaded site counts for ${planetCounts.size} planets across ${systemCounts.size} systems`);
}

export function getSystemBaseCount(systemId: string): number {
  return systemCounts.get(systemId) ?? 0;
}

export function getPlanetBaseCount(planetNaturalId: string): number {
  return planetCounts.get(planetNaturalId) ?? 0;
}

export function isSettledSystem(systemId: string): boolean {
  return (systemCounts.get(systemId) ?? 0) > 0;
}
