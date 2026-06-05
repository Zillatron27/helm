import type { ShipSummary, FlightSummary } from "./bridge-types.js";
import type { MapTooltipContent } from "../ui/MapTooltip.js";
import { STATIONARY, segmentStatus } from "./shipStatus.js";
import { activeSegment } from "./flightInterp.js";
import { cxSystemLabel } from "./cache.js";
import { getPlanetDisplayName } from "./resourceIndex.js";

const MAX_ROWS = 6;

/**
 * Display label for a flight's destination.
 *   - Flying to a planet (`destinationPlanetNaturalId` set) → the planet's
 *     display name (derived name, or the natural id as a code fallback),
 *     regardless of which system it sits in.
 *   - Flying to a commodity exchange (no destination planet, destination system
 *     hosts a CX) → the CX code (ANT, MOR…). The CX-code override applies ONLY
 *     to the CX station itself — never to the planets sharing its system.
 *   - Otherwise → the destination system natural id.
 */
function flightDestinationLabel(flight: FlightSummary): string {
  if (flight.destinationPlanetNaturalId) {
    return getPlanetDisplayName(flight.destinationPlanetNaturalId);
  }
  const sys = flight.destinationSystemNaturalId;
  return sys ? cxSystemLabel(sys) : "";
}

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
  const eta = formatEta(flight.arrivalTimestamp - now);

  const lines = [`${phase.icon} ${phase.label}`];
  const destLabel = flightDestinationLabel(flight);
  if (destLabel) lines.push(`→ ${destLabel}`);
  lines.push(`ETA ${eta}`);

  return { header: `${ship.name} (${ship.registration})`, lines };
}

/**
 * Format a docked-ship list for the map hover tooltip. Used by the system-view
 * per-planet stack (no `context` — the planet anchors it), the system-view
 * CX-docked stack, and the galaxy-view per-system aggregate stack.
 *
 * `context.locationLabel` is the already-resolved place name to print in the
 * header — the caller decides whether that's a system natural id (galaxy
 * aggregate: a whole-system rollup that may mix planet- and CX-docked ships) or
 * a CX code (the CX-docked stack: ships at the exchange itself). Keeping the
 * choice at the call site is deliberate — the CX-code override must apply only
 * when the reference IS the CX, never to a system that merely hosts one.
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
  context?: { locationLabel?: string },
): MapTooltipContent {
  const noun = ships.length === 1 ? "ship" : "ships";
  const header = context?.locationLabel
    ? `${ships.length} ${noun} docked in ${context.locationLabel}`
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
