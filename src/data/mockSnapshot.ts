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
  getGalaxyGatewayConnections,
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

    // Docked ship at the hub's planet (system-view per-planet chevron). A
    // docked ship has no flight entry — that absence (not the status string)
    // is what marks it stationary. `status` is carried verbatim from PrUn and
    // is NOT load-bearing here (not used for gating or display); the value is
    // illustrative only.
    const hubPlanet = firstPlanet(hub);
    ships.push({
      shipId: "mock-ship-docked",
      name: "Stout Hauler",
      registration: "AA-001",
      blueprintNaturalId: "BP-AA-001",
      condition: 0.92,
      status: "OPERATIONAL",
      locationSystemNaturalId: hub.naturalId,
      locationPlanetNaturalId: hubPlanet.natId,
      cargo: null,
      fuel: null,
    });

    // A planetary/base warehouse (address [SYSTEM, PLANET] ⇒ no station, so
    // stationNaturalId is null). This must NOT draw a warehouse marker — it
    // exercises the #22 CX-only filter so a regression that marks every base
    // shows up immediately under ?mock.
    warehouses.push({
      warehouseId: "mock-wh-base",
      storeId: "mock-store-base",
      systemNaturalId: hub.naturalId,
      stationNaturalId: null,
    });

    // Two in-flight ships exercise both views (Cap 4). They are marked
    // in-flight purely by having a flights[] entry — NOT by a status string
    // (PrUn has no literal "IN_FLIGHT" status; the bug behind these not
    // rendering was gating on one). Their `status` is left as a non-flight
    // value on purpose, so the mock proves the gate reads flights, not status.
    //  - "Far Strider" is mid-TRANSIT on a real hub→neighbour jump edge, so
    //    its galaxy glyph rides the actual jump line. Its active segment is
    //    cross-system, so it correctly shows nothing in any system view.
    //  - "Orbital Lifter" is in its DEPARTURE phase off the hub's own planet,
    //    so it shows in the hub's system view leaving that planet (and sits
    //    near the hub star in galaxy view).
    const dest = neighbours[0];
    if (dest) {
      const destPlanet = firstPlanet(dest);
      const m = 60_000;

      ships.push({
        shipId: "mock-ship-transit",
        name: "Far Strider",
        registration: "AA-002",
        blueprintNaturalId: "BP-AA-002",
        condition: 0.81,
        status: "OPERATIONAL",
        locationSystemNaturalId: null,
        locationPlanetNaturalId: null,
        cargo: null,
        fuel: null,
      });
      flights.push({
        flightId: "mock-flight-transit",
        shipId: "mock-ship-transit",
        originSystemNaturalId: hub.naturalId,
        destinationSystemNaturalId: dest.naturalId,
        originPlanetNaturalId: hubPlanet.natId,
        destinationPlanetNaturalId: destPlanet.natId,
        departureTimestamp: now - 12 * m,
        arrivalTimestamp: now + 8 * m,
        segments: [
          // Departure off the hub planet (already complete).
          {
            type: "DEPARTURE",
            originSystemNaturalId: hub.naturalId,
            destinationSystemNaturalId: hub.naturalId,
            originPlanetNaturalId: hubPlanet.natId,
            destinationPlanetNaturalId: null,
            departureTimestamp: now - 12 * m,
            arrivalTimestamp: now - 9 * m,
          },
          // Cross-system transit — active now ⇒ galaxy glyph mid jump line.
          {
            type: "TRANSIT",
            originSystemNaturalId: hub.naturalId,
            destinationSystemNaturalId: dest.naturalId,
            originPlanetNaturalId: null,
            destinationPlanetNaturalId: null,
            departureTimestamp: now - 9 * m,
            arrivalTimestamp: now + 5 * m,
          },
          // Approach to the destination planet (still ahead).
          {
            type: "APPROACH",
            originSystemNaturalId: dest.naturalId,
            destinationSystemNaturalId: dest.naturalId,
            originPlanetNaturalId: null,
            destinationPlanetNaturalId: destPlanet.natId,
            departureTimestamp: now + 5 * m,
            arrivalTimestamp: now + 8 * m,
          },
        ],
        currentSegmentIndex: 1,
      });

      ships.push({
        shipId: "mock-ship-departing",
        name: "Orbital Lifter",
        registration: "AA-003",
        blueprintNaturalId: "BP-AA-003",
        condition: 0.88,
        status: "OPERATIONAL",
        locationSystemNaturalId: null,
        locationPlanetNaturalId: null,
        cargo: null,
        fuel: null,
      });
      flights.push({
        flightId: "mock-flight-departing",
        shipId: "mock-ship-departing",
        originSystemNaturalId: hub.naturalId,
        destinationSystemNaturalId: dest.naturalId,
        originPlanetNaturalId: hubPlanet.natId,
        destinationPlanetNaturalId: destPlanet.natId,
        departureTimestamp: now - 2 * m,
        arrivalTimestamp: now + 20 * m,
        segments: [
          // Departure off the hub planet — active now ⇒ shows in hub system view.
          {
            type: "DEPARTURE",
            originSystemNaturalId: hub.naturalId,
            destinationSystemNaturalId: hub.naturalId,
            originPlanetNaturalId: hubPlanet.natId,
            destinationPlanetNaturalId: null,
            departureTimestamp: now - 2 * m,
            arrivalTimestamp: now + 6 * m,
          },
          {
            type: "TRANSIT",
            originSystemNaturalId: hub.naturalId,
            destinationSystemNaturalId: dest.naturalId,
            originPlanetNaturalId: null,
            destinationPlanetNaturalId: null,
            departureTimestamp: now + 6 * m,
            arrivalTimestamp: now + 20 * m,
          },
        ],
        currentSegmentIndex: 0,
      });
    }

    // A ship mid gateway-jump, riding a REAL gateway edge so the galaxy glyph
    // tracks the curved arc (not a straight chord). Anchored on the first
    // loaded gateway connection; skipped if the universe has no gateways.
    const gw = getGalaxyGatewayConnections()[0];
    const gwFrom = gw ? getSystemById(gw.fromSystemId) : undefined;
    const gwTo = gw ? getSystemById(gw.toSystemId) : undefined;
    if (gwFrom && gwTo) {
      const m = 60_000;
      ships.push({
        shipId: "mock-ship-gateway",
        name: "Gate Runner",
        registration: "AA-004",
        blueprintNaturalId: "BP-AA-004",
        condition: 0.95,
        status: "OPERATIONAL",
        locationSystemNaturalId: null,
        locationPlanetNaturalId: null,
        cargo: null,
        fuel: null,
      });
      flights.push({
        flightId: "mock-flight-gateway",
        shipId: "mock-ship-gateway",
        originSystemNaturalId: gwFrom.naturalId,
        destinationSystemNaturalId: gwTo.naturalId,
        originPlanetNaturalId: null,
        destinationPlanetNaturalId: null,
        departureTimestamp: now - 2 * m,
        arrivalTimestamp: now + 8 * m,
        segments: [
          // Single gateway-jump segment, active now ⇒ glyph rides the arc.
          {
            type: "JUMP_GATEWAY",
            originSystemNaturalId: gwFrom.naturalId,
            destinationSystemNaturalId: gwTo.naturalId,
            originPlanetNaturalId: null,
            destinationPlanetNaturalId: null,
            departureTimestamp: now - 2 * m,
            arrivalTimestamp: now + 8 * m,
          },
        ],
        currentSegmentIndex: 0,
      });
    }

    // A ship bound for a commodity exchange: destination system is a CX system
    // with NO destination planet, so the in-flight panel must label it by the
    // CX code (e.g. "ANT"), not the host system id. Exercises the CX-only
    // override in flightDestinationLabel deterministically.
    const cxStation = getAllCxStations()[0];
    if (cxStation) {
      const m = 60_000;
      ships.push({
        shipId: "mock-ship-cxbound",
        name: "Exchange Courier",
        registration: "AA-005",
        blueprintNaturalId: "BP-AA-005",
        condition: 0.9,
        status: "OPERATIONAL",
        locationSystemNaturalId: null,
        locationPlanetNaturalId: null,
        cargo: null,
        fuel: null,
      });
      flights.push({
        flightId: "mock-flight-cxbound",
        shipId: "mock-ship-cxbound",
        originSystemNaturalId: hub.naturalId,
        destinationSystemNaturalId: cxStation.SystemNaturalId,
        originPlanetNaturalId: hubPlanet.natId,
        destinationPlanetNaturalId: null,
        departureTimestamp: now - 3 * m,
        arrivalTimestamp: now + 7 * m,
        segments: [
          {
            type: "TRANSIT",
            originSystemNaturalId: hub.naturalId,
            destinationSystemNaturalId: cxStation.SystemNaturalId,
            originPlanetNaturalId: null,
            destinationPlanetNaturalId: null,
            departureTimestamp: now - 3 * m,
            arrivalTimestamp: now + 7 * m,
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
 *  so reception + validation in bridge.ts runs exactly as for the extension.
 *  Returns the built snapshot so callers can read it synchronously (the posted
 *  message is processed asynchronously, so getBridgeSnapshot() won't reflect it
 *  on the next line). */
export function injectMockSnapshot(override?: BridgeSnapshot): BridgeSnapshot {
  const snapshot = override ?? buildMockSnapshot();
  if (snapshot.sites.length === 0) {
    console.warn(
      "[Helm Mock] no systems loaded yet — injecting an empty empire " +
        "(overlay will dim everything). Call after the map has loaded.",
    );
  }
  console.log("[Helm Mock] injecting helm-init snapshot", snapshot);
  window.postMessage({ type: "helm-init", snapshot }, window.location.origin);
  return snapshot;
}
