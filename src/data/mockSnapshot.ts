/**
 * Dev-only mock bridge snapshot.
 *
 * Lets us verify the empire-overlay features (dim lens, base rings, docked
 * ships, in-flight ships, warehouse markers, burn data) without a running
 * game + extension. Loaded lazily and only in dev — see the `import.meta.env.DEV`
 * guard in main.ts, so none of this reaches the production bundle.
 *
 * The fixture is built from the ACTUAL loaded universe (`getSystems()`,
 * `getAllCxStations()`) so every site/ship/flight lands on a real star with
 * real coordinates — a hand-typed naturalId that doesn't exist would silently
 * highlight nothing and make verification meaningless.
 *
 * Injection posts a real `helm-init` envelope through `window.postMessage`, so
 * it exercises the same reception + validation path (`bridge.ts`) the
 * extension's tier-2 relay uses — not a shortcut around it.
 */

import type {
  BridgeSnapshot,
  SiteSummary,
  ShipSummary,
  FlightSummary,
  WarehouseLocation,
  BridgeSiteBurnSummary,
  BurnMaterialSummary,
} from "./bridge-types.js";
import type { StarSystem } from "../types/index.js";
import {
  getSystems,
  getSystemById,
  getPlanetsForSystem,
  getAllCxStations,
} from "./cache.js";

/** Resolve a representative planet for a system from real loaded data where
 *  possible. Planet data is lazy-loaded per system, so when it isn't cached
 *  yet we derive the conventional first-planet naturalId (`<system>b`). Galaxy
 *  view verifies off system ids regardless; this only affects system-view. */
function firstPlanet(sys: StarSystem): { natId: string; name: string } {
  const planets = getPlanetsForSystem(sys.naturalId);
  if (planets && planets.length > 0) {
    const p = planets[0]!;
    return { natId: p.naturalId, name: p.name };
  }
  return { natId: `${sys.naturalId}b`, name: sys.name };
}

/** Pick a connected cluster of real systems to stand in for the empire.
 *  Seeded from the most-connected system so neighbours (hence real jump edges
 *  for in-flight interpolation) are guaranteed to exist. */
function pickEmpire(): { hub: StarSystem; neighbours: StarSystem[] } | null {
  const systems = getSystems();
  if (systems.length === 0) return null;

  const hub = [...systems].sort(
    (a, b) => b.connectionIds.length - a.connectionIds.length,
  )[0]!;

  const neighbours = hub.connectionIds
    .map((id) => getSystemById(id))
    .filter((s): s is StarSystem => s !== undefined)
    .slice(0, 3);

  return { hub, neighbours };
}

function burn(
  ticker: string,
  days: number,
  urgency: BurnMaterialSummary["urgency"],
): BurnMaterialSummary {
  return {
    materialTicker: ticker,
    materialName: null,
    type: "input",
    inventoryAmount: Math.max(0, Math.round(days * 12)),
    dailyAmount: 12,
    daysRemaining: days,
    need: 12,
    urgency,
  };
}

/** Build a full, schema-valid snapshot anchored to the real loaded universe.
 *  `now` is passed in so flight timestamps bracket the present and one ship
 *  reads as genuinely mid-flight. */
export function buildMockSnapshot(now: number = Date.now()): BridgeSnapshot {
  const empire = pickEmpire();

  const sites: SiteSummary[] = [];
  const ships: ShipSummary[] = [];
  const flights: FlightSummary[] = [];
  const warehouses: WarehouseLocation[] = [];
  const siteBurns: BridgeSiteBurnSummary[] = [];

  if (empire) {
    const { hub, neighbours } = empire;
    const baseSystems = [hub, ...neighbours];

    baseSystems.forEach((sys, i) => {
      const planet = firstPlanet(sys);
      const siteId = `mock-site-${i}`;
      sites.push({
        siteId,
        planetName: planet.name,
        planetNaturalId: planet.natId,
        systemNaturalId: sys.naturalId,
        platformCount: 6 + i * 2,
        area: 250 + i * 40,
      });

      // One base critical, one warning, the rest healthy — exercises the burn
      // urgency colour spread for #28/#29/#30 down the line.
      const status: BridgeSiteBurnSummary["burnStatus"] =
        i === 0 ? "critical" : i === 1 ? "warning" : "ok";
      const burns: BurnMaterialSummary[] =
        i === 0
          ? [burn("DW", 1.4, "critical"), burn("RAT", 3.1, "warning")]
          : i === 1
            ? [burn("OVE", 4.6, "warning"), burn("FEO", 18, "ok")]
            : [burn("RAT", 22, "ok"), burn("H2O", 31, "surplus")];
      siteBurns.push({
        siteId,
        planetNaturalId: planet.natId,
        systemNaturalId: sys.naturalId,
        planetName: planet.name,
        burns,
        burnStatus: status,
        lowestBurnDays: burns.reduce(
          (m, b) => Math.min(m, b.daysRemaining),
          Infinity,
        ),
      });
    });

    // Docked ship at the hub's planet (system-view per-planet chevron).
    const hubPlanet = firstPlanet(hub);
    ships.push({
      shipId: "mock-ship-docked",
      name: "Stout Hauler",
      registration: "AA-001",
      blueprintNaturalId: "BP-AA-001",
      condition: 0.92,
      status: "DOCKED",
      locationSystemNaturalId: hub.naturalId,
      locationPlanetNaturalId: hubPlanet.natId,
      cargo: null,
      fuel: null,
    });

    // In-flight ship travelling a real jump edge (hub → first neighbour) so
    // galaxy-view interpolation rides an actual jump line. Departure in the
    // past, arrival in the future ⇒ currently ~40% along the segment.
    const dest = neighbours[0];
    if (dest) {
      const destPlanet = firstPlanet(dest);
      const departure = now - 4 * 60_000;
      const arrival = now + 6 * 60_000;
      ships.push({
        shipId: "mock-ship-flight",
        name: "Far Strider",
        registration: "AA-002",
        blueprintNaturalId: "BP-AA-002",
        condition: 0.81,
        status: "IN_FLIGHT",
        locationSystemNaturalId: null,
        locationPlanetNaturalId: null,
        cargo: null,
        fuel: null,
      });
      flights.push({
        flightId: "mock-flight-1",
        shipId: "mock-ship-flight",
        originSystemNaturalId: hub.naturalId,
        destinationSystemNaturalId: dest.naturalId,
        originPlanetNaturalId: hubPlanet.natId,
        destinationPlanetNaturalId: destPlanet.natId,
        departureTimestamp: departure,
        arrivalTimestamp: arrival,
        segments: [
          {
            type: "JUMP",
            originSystemNaturalId: hub.naturalId,
            destinationSystemNaturalId: dest.naturalId,
            originPlanetNaturalId: hubPlanet.natId,
            destinationPlanetNaturalId: destPlanet.natId,
            departureTimestamp: departure,
            arrivalTimestamp: arrival,
          },
        ],
        currentSegmentIndex: 0,
      });
    }
  }

  // Warehouses at the first couple of real CX stations (#22 indicator).
  const stations = getAllCxStations().slice(0, 2);
  stations.forEach((st, i) => {
    warehouses.push({
      warehouseId: `mock-wh-${i}`,
      storeId: `mock-store-${i}`,
      systemNaturalId: st.SystemNaturalId,
      stationNaturalId: st.NaturalId,
    });
  });

  return {
    sites,
    ships,
    flights,
    storage: [],
    production: [],
    workforce: [],
    contracts: [],
    balances: [{ currency: "AIC", amount: 1_250_000 }],
    screens: [
      { id: "scr-1", name: "Overview", hidden: false },
      { id: "scr-2", name: "Logistics", hidden: false },
    ],
    screenAssignments: {},
    burnThresholds: { critical: 3, warning: 7, resupply: 14 },
    companyName: "Mock Industries",
    primaryCurrency: "AIC",
    subscriptionLevel: "PRO",
    warehouses,
    siteBurns,
    rprunDetected: false,
    rprunFeaturesDisabled: false,
    timestamp: now,
  };
}

/** Inject the fixture (or an override) by posting a real `helm-init` envelope,
 *  so reception + validation in bridge.ts runs exactly as for the extension. */
export function injectMockSnapshot(override?: BridgeSnapshot): void {
  const snapshot = override ?? buildMockSnapshot();
  if (snapshot.sites.length === 0) {
    console.warn(
      "[Helm Mock] no systems loaded yet — injecting an empty empire " +
        "(overlay will dim everything). Call after the map has loaded.",
    );
  }
  console.log("[Helm Mock] injecting helm-init snapshot", snapshot);
  window.postMessage({ type: "helm-init", snapshot }, window.location.origin);
}
