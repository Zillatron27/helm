import type { ShipSummary } from "./bridge-types.js";
import type { MapTooltipContent } from "../ui/MapTooltip.js";

const MAX_ROWS = 6;

/**
 * Format a docked-ship list for the map hover tooltip. Used by both the
 * system-view per-planet stack (no `context`) and the galaxy-view
 * per-system aggregate stack (`context.systemNaturalId` to indicate the
 * tooltip is summarising a whole system).
 *
 * Header pluralises around 1 ship; body lines are name (registration) —
 * status, status passed verbatim from PrUn / FIO. Lines past
 * MAX_ROWS are collapsed into a final "+N more" row.
 */
export function formatDockedShipTooltip(
  ships: ShipSummary[],
  context?: { systemNaturalId?: string },
): MapTooltipContent {
  const noun = ships.length === 1 ? "ship" : "ships";
  const header = context?.systemNaturalId
    ? `${ships.length} ${noun} docked in ${context.systemNaturalId}`
    : `${ships.length} ${noun} docked`;

  const visible = ships.slice(0, MAX_ROWS);
  const lines = visible.map(
    (s) => `${s.name} (${s.registration}) — ${s.status}`,
  );
  if (ships.length > MAX_ROWS) {
    lines.push(`+${ships.length - MAX_ROWS} more`);
  }
  return { header, lines };
}
