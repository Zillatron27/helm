import type { StarSystem, FioPlanetSummary, SearchEntry } from "../types/index.js";

let entries: SearchEntry[] = [];
const naturalIdToUuid: Map<string, string> = new Map();

// Strip trailing lowercase letter from planet natural ID to get system natural ID.
// Planet IDs follow XX-NNNx format (e.g. UV-351a), system IDs are XX-NNN (e.g. UV-351).
// Regex requires a digit before the trailing letter to avoid false positives.
function extractSystemNaturalId(planetNaturalId: string): string | null {
  const match = planetNaturalId.match(/^(.+\d)[a-z]$/);
  return match ? match[1]! : null;
}

export function buildSearchIndex(
  systems: StarSystem[],
  planets: FioPlanetSummary[]
): void {
  entries = [];
  naturalIdToUuid.clear();

  // Build reverse map: naturalId → UUID
  for (const s of systems) {
    naturalIdToUuid.set(s.naturalId, s.id);
  }

  // Add system entries
  for (const s of systems) {
    entries.push({
      type: "system",
      id: s.id,
      name: s.name,
      naturalId: s.naturalId,
      systemId: s.id,
    });
  }

  // Add planet entries — map each planet to its parent system UUID
  for (const p of planets) {
    const sysNatId = extractSystemNaturalId(p.PlanetNaturalId);
    if (!sysNatId) continue;

    const sysUuid = naturalIdToUuid.get(sysNatId);
    if (!sysUuid) continue;

    entries.push({
      type: "planet",
      id: p.PlanetNaturalId,
      name: p.PlanetName,
      naturalId: p.PlanetNaturalId,
      systemId: sysUuid,
    });
  }
}

export function search(query: string, limit = 10): SearchEntry[] {
  if (!query) return [];

  const q = query.toLowerCase();
  const exact: SearchEntry[] = [];
  const namePrefix: SearchEntry[] = [];
  const idPrefix: SearchEntry[] = [];

  for (const entry of entries) {
    const nameLower = entry.name.toLowerCase();
    const idLower = entry.naturalId.toLowerCase();

    if (nameLower === q || idLower === q) {
      exact.push(entry);
    } else if (nameLower.startsWith(q)) {
      namePrefix.push(entry);
    } else if (idLower.startsWith(q)) {
      idPrefix.push(entry);
    }
  }

  return [...exact, ...namePrefix, ...idPrefix].slice(0, limit);
}

export function getSystemUuidByNaturalId(naturalId: string): string | undefined {
  return naturalIdToUuid.get(naturalId);
}
