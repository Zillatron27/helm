import type { StarSystem, FioPlanetSummary, SearchEntry } from "../types/index.js";
import { isResourceIndexReady, getActiveCogcCategories } from "./resourceIndex.js";

let entries: SearchEntry[] = [];
const naturalIdToUuid: Map<string, string> = new Map();

// FIO ProgramType → in-game display name (all 14 real COGC programs)
const COGC_DISPLAY_NAMES: Record<string, string> = {
  ADVERTISING_MANUFACTURING: "Manufacturing",
  WORKFORCE_PIONEERS: "Pioneers",
  WORKFORCE_SETTLERS: "Settlers",
  WORKFORCE_TECHNICIANS: "Technicians",
  WORKFORCE_ENGINEERS: "Engineers",
  WORKFORCE_SCIENTISTS: "Scientists",
  ADVERTISING_AGRICULTURE: "Agriculture",
  ADVERTISING_CHEMISTRY: "Chemistry",
  ADVERTISING_CONSTRUCTION: "Construction",
  ADVERTISING_ELECTRONICS: "Electronics",
  ADVERTISING_FOOD_INDUSTRIES: "Food Industries",
  ADVERTISING_FUEL_REFINING: "Fuel Refining",
  ADVERTISING_METALLURGY: "Metallurgy",
  ADVERTISING_RESOURCE_EXTRACTION: "Resource Extraction",
};

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
  const cogcMatches: SearchEntry[] = [];
  const substring: SearchEntry[] = [];

  for (const entry of entries) {
    const nameLower = (entry.name ?? "").toLowerCase();
    const idLower = entry.naturalId.toLowerCase();

    if (nameLower === q || idLower === q) {
      exact.push(entry);
    } else if (nameLower.startsWith(q)) {
      namePrefix.push(entry);
    } else if (idLower.startsWith(q)) {
      idPrefix.push(entry);
    } else if (nameLower.includes(q) || idLower.includes(q)) {
      substring.push(entry);
    }
  }

  // Query COGC programs at search time (available once resource index loads)
  if (isResourceIndexReady()) {
    for (const category of getActiveCogcCategories()) {
      const displayName = COGC_DISPLAY_NAMES[category] ?? category.replace(/_/g, " ");
      const cogcLabel = `COGC: ${displayName}`;
      const cogcLower = cogcLabel.toLowerCase();

      if (cogcLower === q) {
        exact.push({ type: "cogc", id: category, name: cogcLabel, naturalId: category, systemId: "" });
      } else if (cogcLower.startsWith(q) || displayName.toLowerCase().startsWith(q)) {
        cogcMatches.push({ type: "cogc", id: category, name: cogcLabel, naturalId: category, systemId: "" });
      } else if (cogcLower.includes(q)) {
        cogcMatches.push({ type: "cogc", id: category, name: cogcLabel, naturalId: category, systemId: "" });
      }
    }
  }

  return [...exact, ...namePrefix, ...idPrefix, ...cogcMatches, ...substring].slice(0, limit);
}

export function getSystemUuidByNaturalId(naturalId: string): string | undefined {
  return naturalIdToUuid.get(naturalId);
}
