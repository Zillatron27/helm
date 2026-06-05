/**
 * Ship status display vocabulary.
 *
 * The bridge carries two distinct things:
 *   - `ShipSummary.status` — PrUn's coarse top-level state (OPERATIONAL,
 *     LANDED, BLOCKED, INACTIVE, IN_FLIGHT). These are internal codes; the
 *     player never sees them verbatim (the bug behind issue #13).
 *   - `FlightSegmentSummary.type` — the fine flight phase, the SAME value the
 *     player actually sees in PrUn's FLT "Status" column.
 *
 * PrUn's own UI shows the flight phase when a ship is flying and "stationary"
 * when it's parked. We mirror that, and adopt Refined PrUn's exact icon set so
 * the status reads identically to what a player using rPrun sees.
 *
 * Source of truth for the icon mapping (do not improvise these glyphs):
 *   rPrun-reference/refined-prun-main/src/features/advanced/flt-flight-status-icons.ts
 * Source of truth for the SegmentType enum:
 *   rPrun-reference/refined-prun-main/src/infrastructure/prun-api/data/flights.types.d.ts
 */

export interface ShipDisplayStatus {
  /** Human-readable phase label, e.g. "In transit". */
  label: string;
  /** Single glyph mirroring Refined PrUn's FLT status icons. */
  icon: string;
}

/** Parked / not in flight — PrUn's "stationary" state (rPrun: ⦁). */
export const STATIONARY: ShipDisplayStatus = { label: "Stationary", icon: "⦁" };

// PrUn SegmentType → { label, icon }. Icons are rPrun's verbatim; labels are
// the natural-English rendering of each phase.
const SEGMENT_STATUS: Record<string, ShipDisplayStatus> = {
  TAKE_OFF: { label: "Take off", icon: "↑" },
  DEPARTURE: { label: "Departure", icon: "↗" },
  TRANSIT: { label: "In transit", icon: "⟶" },
  CHARGE: { label: "Charging", icon: "±" },
  JUMP: { label: "Jump", icon: "➾" },
  FLOAT: { label: "Float", icon: "↑" },
  APPROACH: { label: "Approach", icon: "↘" },
  LANDING: { label: "Landing", icon: "↓" },
  LOCK: { label: "Lock", icon: "⟴" },
  DECAY: { label: "Decay", icon: "⟴" },
  JUMP_GATEWAY: { label: "Gateway jump", icon: "⟴" },
};

/**
 * Map a raw flight-segment type to its display status. Unknown codes (a future
 * SegmentType we haven't enumerated) fall back to a title-cased label with no
 * icon rather than rendering the raw enum — discoverable, not silently wrong.
 */
export function segmentStatus(type: string): ShipDisplayStatus {
  const known = SEGMENT_STATUS[type];
  if (known) return known;
  const label = type
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
  return { label: label || "Unknown", icon: "" };
}
