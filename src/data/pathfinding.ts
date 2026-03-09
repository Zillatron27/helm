import type { Route } from "../types/index.js";
import { getSystemById, getNeighbours } from "./cache.js";

// BFS shortest path on the jump graph.
// All edges have weight 1 (jump count), so BFS is optimal.
export function findRoute(startId: string, endId: string): Route | null {
  if (startId === endId) {
    return { systemIds: [startId], jumpCount: 0 };
  }

  // Verify both systems exist
  if (!getSystemById(startId) || !getSystemById(endId)) {
    return null;
  }

  // BFS with array-based queue and head pointer for O(1) dequeue
  const queue: string[] = [startId];
  let head = 0;
  const parent = new Map<string, string>();
  parent.set(startId, startId); // sentinel: start is its own parent

  while (head < queue.length) {
    const current = queue[head++]!;

    for (const neighbourId of getNeighbours(current)) {
      if (parent.has(neighbourId)) continue;

      parent.set(neighbourId, current);

      if (neighbourId === endId) {
        // Reconstruct path from end to start
        const path: string[] = [];
        let node = endId;
        while (node !== startId) {
          path.push(node);
          node = parent.get(node)!;
        }
        path.push(startId);
        path.reverse();

        return { systemIds: path, jumpCount: path.length - 1 };
      }

      queue.push(neighbourId);
    }
  }

  // Unreachable — disconnected graph
  return null;
}
