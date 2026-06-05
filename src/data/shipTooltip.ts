import type { ShipSummary, FlightSummary } from "./bridge-types.js";
import type { MapTooltipContent } from "../ui/MapTooltip.js";
import { STATIONARY, segmentStatus } from "./shipStatus.js";
import { activeSegment } from "./flightInterp.js";

const MAX_ROWS = 6;

/** Format a millisecond ETA as a compact "Xh Ym" / "Ym" / "<1m" string. */
function formatEta(msRemaining: number): string {
  if (msRemaining <= 0) return "arriving";
  const totalMin = Math.round(msRemaining / 60_000);
  if (totalMin < 1) return "<1m";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Tooltip for a single in-flight ship (Cap 4). Shows the ship, its current
 * flight phase (icon + label, mirroring rPrun — see shipStatus.ts), the
 * destination system, and live ETA. `now` is passed so the phase and ETA
 * reflect the hover moment, not the snapshot timestamp.
 */
export function formatInFlightShipTooltip(
  ship: ShipSummary,
  flight: FlightSummary,
  now: number,
): MapTooltipContent {
  const active = activeSegment(flight, now);
  const phase = active ? segmentStatus(active.segment.type) : STATIONARY;
  const dest = flight.destinationSystemNaturalId;
  const eta = formatEta(flight.arrivalTimestamp - now);

  const lines = [`${phase.icon} ${phase.label}`];
  if (dest) lines.push(`→ ${dest}`);
  lines.push(`ETA ${eta}`);

  return { header: `${ship.name} (${ship.registration})`, lines };
}

/**
 * Format a docked-ship list for the map hover tooltip. Used by both the
 * system-view per-planet stack (no `context`) and the galaxy-view
 * per-system aggregate stack (`context.systemNaturalId` to indicate the
 * tooltip is summarising a whole system).
 *
 * Header pluralises around 1 ship; body lines are name (registration) —
 * status. Docked ships are by definition not in flight, so the status is
 * always Stationary (issue #13: the raw PrUn `status` code — OPERATIONAL etc.
 * — is an internal value the player never sees, so we render the in-game
 * "stationary" label + rPrun icon instead). Lines past MAX_ROWS collapse into
 * a final "+N more" row.
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
    (s) =>
      `${s.name} (${s.registration}) — ${STATIONARY.icon} ${STATIONARY.label}`,
  );
  if (ships.length > MAX_ROWS) {
    lines.push(`+${ships.length - MAX_ROWS} more`);
  }
  return { header, lines };
}
