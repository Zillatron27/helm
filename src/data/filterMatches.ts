/**
 * Filter-match helpers — project filter UI state onto the data indices.
 *
 * Reads filter state (getResourceFilter / getCogcFilter) and index data
 * (getSystemsWithResource / getPlanetsWithResource / getSystemsWithCogcProgram),
 * returns derived match sets. Null when the filter is inactive OR matches
 * zero entries — both cases drop out of composition, matching pre-refactor
 * behaviour where an empty filter result disables dimming rather than
 * dimming everything. Empire is the only filter whose empty-state is
 * different (see empireIndex.ts).
 */

import { getResourceFilter, getCogcFilter } from "../ui/state.js";
import {
  getSystemsWithResource,
  getPlanetsWithResource,
  getSystemsWithCogcProgram,
  isResourceIndexReady,
} from "./resourceIndex.js";

export function getResourceSystemMatches(): Set<string> | null {
  const id = getResourceFilter();
  if (!id) return null;
  const matches = getSystemsWithResource(id);
  if (matches.length === 0) return null;
  return new Set(matches.map((m) => m.systemId));
}

export function getResourcePlanetMatches(): Set<string> | null {
  const id = getResourceFilter();
  if (!id) return null;
  const matches = getPlanetsWithResource(id);
  if (matches.length === 0) return null;
  return new Set(matches.map((m) => m.planetNaturalId));
}

export function getCogcSystemMatches(): Set<string> | null {
  const cat = getCogcFilter();
  if (!cat) return null;
  if (!isResourceIndexReady()) return null;
  const matches = getSystemsWithCogcProgram(cat);
  if (matches.size === 0) return null;
  return matches;
}
