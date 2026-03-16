import type { CxDistanceEntry } from "../types/index.js";
import { getAllCxStations, getNeighbours, getGalaxyGatewayConnections } from "./cache.js";

// Per-CX BFS results: ComexCode → { startId, distances, parents }
const bfsResults = new Map<string, { startId: string; distances: Map<string, number>; parents: Map<string, string> }>();

// CX metadata for building entries
const cxMeta = new Map<string, { code: string; label: string; systemId: string; currency: string }>();

// Gateway edge set for path checking (sorted pair keys "a:b")
let gatewayEdges: Set<string> | null = null;

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function bfsFromSystem(startId: string): { startId: string; distances: Map<string, number>; parents: Map<string, string> } {
  const distances = new Map<string, number>();
  const parents = new Map<string, string>();
  const queue: string[] = [startId];
  let head = 0;

  distances.set(startId, 0);
  parents.set(startId, startId); // sentinel

  while (head < queue.length) {
    const current = queue[head++]!;
    const dist = distances.get(current)!;

    for (const neighbour of getNeighbours(current)) {
      if (distances.has(neighbour)) continue;
      distances.set(neighbour, dist + 1);
      parents.set(neighbour, current);
      queue.push(neighbour);
    }
  }

  return { startId, distances, parents };
}

/** Walk the parent chain from targetId back to startId, check for gateway edges */
function pathUsesGateway(startId: string, targetId: string, parents: Map<string, string>): boolean {
  if (!gatewayEdges || gatewayEdges.size === 0) return false;

  let node = targetId;
  while (node !== startId) {
    const prev = parents.get(node);
    if (!prev) return false;
    if (gatewayEdges.has(edgeKey(prev, node))) return true;
    node = prev;
  }
  return false;
}

export function computeCxDistances(): void {
  // Build gateway edge set
  gatewayEdges = new Set<string>();
  for (const gw of getGalaxyGatewayConnections()) {
    gatewayEdges.add(edgeKey(gw.fromSystemId, gw.toSystemId));
  }

  // BFS from each CX station
  for (const cx of getAllCxStations()) {
    cxMeta.set(cx.ComexCode, { code: cx.ComexCode, label: cx.NaturalId, systemId: cx.SystemId, currency: cx.CurrencyCode });
    bfsResults.set(cx.ComexCode, bfsFromSystem(cx.SystemId));
  }
}

export function getCxDistances(systemId: string): CxDistanceEntry[] {
  const entries: CxDistanceEntry[] = [];

  for (const [code, result] of bfsResults) {
    const meta = cxMeta.get(code)!;
    const jumps = result.distances.get(systemId) ?? -1;
    const viaGateway = jumps > 0 ? pathUsesGateway(result.startId, systemId, result.parents) : false;

    entries.push({ code: meta.code, label: meta.label, systemId: meta.systemId, currency: meta.currency, jumps, viaGateway });
  }

  // Sort by jumps ascending (unreachable last)
  entries.sort((a, b) => {
    if (a.jumps === -1 && b.jumps === -1) return 0;
    if (a.jumps === -1) return 1;
    if (b.jumps === -1) return -1;
    return a.jumps - b.jumps;
  });

  return entries;
}
