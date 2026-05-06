/**
 * Filter-match helpers — project filter UI state onto the data indices.
 *
 * Reads filter state (getResourceFilters / getCogcFilter) and the
 * resource/COGC indices, returns derived match sets. Null when the
 * filter is inactive OR matches zero entries — both cases drop out of
 * composition, matching pre-refactor behaviour where an empty filter
 * result disables dimming rather than dimming everything. Empire is the
 * only filter whose empty-state is different (see empireIndex.ts).
 *
 * Resource filter is multi-select with AND-across-system semantics: a
 * SYSTEM matches iff every selected material is present on at least
 * one of its planets (the production-chain use case). The bright
 * planet set is every planet in a qualifying system that contributes
 * any of the selected materials.
 */

import { getResourceFilters, getCogcFilter } from "../ui/state.js";
import {
  getSystemsWithAllResources,
  getQualifyingPlanetIds,
  getSystemsWithCogcProgram,
  isResourceIndexReady,
} from "./resourceIndex.js";

export function getResourceSystemMatches(): Set<string> | null {
  const ids = getResourceFilters();
  if (ids.length === 0) return null;
  const matches = getSystemsWithAllResources(ids);
  if (matches.length === 0) return null;
  return new Set(matches.map((m) => m.systemId));
}

export function getResourcePlanetMatches(): Set<string> | null {
  const ids = getResourceFilters();
  if (ids.length === 0) return null;
  const planetIds = getQualifyingPlanetIds(ids);
  if (planetIds.size === 0) return null;
  return planetIds;
}

export function getCogcSystemMatches(): Set<string> | null {
  const cat = getCogcFilter();
  if (!cat) return null;
  if (!isResourceIndexReady()) return null;
  const matches = getSystemsWithCogcProgram(cat);
  if (matches.size === 0) return null;
  return matches;
}
