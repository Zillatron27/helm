/**
 * Empire index — derived view of the bridge snapshot's sites[].
 *
 * Recomputes two sets on every snapshot change:
 *   empireSystemIds  — system UUIDs containing one or more user sites
 *   empirePlanetIds  — planet natural IDs that are user sites
 *
 * Public getters return null when empire-dim is inactive (toggle off or no
 * snapshot) so the filter drops out of composition. When active, they
 * return the (possibly empty) set; an empty empire intersects to the empty
 * set and dims everything — intentional per empire-overlay.md §1.
 */

import { getBridgeSnapshot, onBridgeSnapshotChange, getEmpireDim } from "../ui/state.js";
import { getSystemUuidByNaturalId } from "./searchIndex.js";

let empireSystemIds: Set<string> = new Set();
let empirePlanetIds: Set<string> = new Set();

type Listener = () => void;
const listeners: Set<Listener> = new Set();

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function recompute(): void {
  const snap = getBridgeSnapshot();
  const sysIds = new Set<string>();
  const planetIds = new Set<string>();
  if (snap) {
    for (const site of snap.sites) {
      if (site.systemNaturalId) {
        const uuid = getSystemUuidByNaturalId(site.systemNaturalId);
        if (uuid) sysIds.add(uuid);
      }
      if (site.planetNaturalId) planetIds.add(site.planetNaturalId);
    }
  }
  const changed =
    !setsEqual(sysIds, empireSystemIds) ||
    !setsEqual(planetIds, empirePlanetIds);
  empireSystemIds = sysIds;
  empirePlanetIds = planetIds;
  if (changed) {
    for (const fn of listeners) fn();
  }
}

// Initial read covers the edge case where a snapshot arrived before this
// module was evaluated. Subscription handles everything after.
recompute();
onBridgeSnapshotChange(recompute);

export function getEmpireSystemMatches(): Set<string> | null {
  if (!getEmpireDim() || getBridgeSnapshot() === null) return null;
  return empireSystemIds;
}

export function getEmpirePlanetMatches(): Set<string> | null {
  if (!getEmpireDim() || getBridgeSnapshot() === null) return null;
  return empirePlanetIds;
}

// Unconditional reads — for passive indicators that render whenever the
// bridge snapshot is present, regardless of the dim toggle. Empty set is
// the "no bridge / no sites" state.
export function getEmpireSystemIds(): Set<string> {
  return empireSystemIds;
}

export function getEmpirePlanetIds(): Set<string> {
  return empirePlanetIds;
}

export function onEmpireIndexChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
