/**
 * Flight interpolation — where a ship is *right now* along its flight plan.
 *
 * The bridge snapshot is a point-in-time capture, so `currentSegmentIndex` can
 * be stale by the time we render a frame. We instead pick the active segment
 * from the wall-clock `now` against each segment's [departure, arrival] window,
 * which stays correct between snapshots and as the user leaves the tab and
 * comes back.
 */

import type { FlightSummary, FlightSegmentSummary } from "./bridge-types.js";

export interface SegmentProgress {
  segment: FlightSegmentSummary;
  /** Progress within the active segment, clamped to [0, 1]. */
  t: number;
}

/**
 * The flight segment in progress at `now`, with local progress. Before the
 * first departure → first segment at t=0; after the last arrival → last
 * segment at t=1 (flight effectively complete but not yet cleared from the
 * snapshot). Null only when the flight carries no segments.
 */
export function activeSegment(
  flight: FlightSummary,
  now: number,
): SegmentProgress | null {
  const segs = flight.segments;
  if (segs.length === 0) return null;

  if (now <= segs[0]!.departureTimestamp) return { segment: segs[0]!, t: 0 };

  for (const segment of segs) {
    if (now >= segment.departureTimestamp && now <= segment.arrivalTimestamp) {
      const span = segment.arrivalTimestamp - segment.departureTimestamp;
      const t = span > 0 ? (now - segment.departureTimestamp) / span : 1;
      return { segment, t };
    }
  }

  return { segment: segs[segs.length - 1]!, t: 1 };
}

/** Linear interpolation between a and b. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Ship IDs the snapshot considers in-flight — the single source of truth for
 * "is this ship flying?".
 *
 * A ship is in flight exactly when PrUn is tracking a current flight for it
 * (`Ship.flightId !== null`), which the bridge surfaces as a matching entry in
 * `flights[]` keyed by shipId. The coarse `ShipSummary.status` code is NOT a
 * reliable signal: PrUn's internal values don't include a literal "IN_FLIGHT"
 * (FIO splits ships into PlayerShipsInFlight / PlayerStationaryShips by
 * FlightId, never by a status string), so we never gate on it.
 */
export function inFlightShipIds(flights: FlightSummary[]): Set<string> {
  return new Set(flights.map((f) => f.shipId));
}
