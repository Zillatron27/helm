import type { GovernorInfo } from "../types/index.js";
import { fetchSettledPlanets } from "./fio.js";

const governors = new Map<string, GovernorInfo>();

export async function loadSettledPlanets(): Promise<void> {
  const data = await fetchSettledPlanets();
  governors.clear();

  for (const planet of data) {
    if (planet.GovernorCorporationCode || planet.GovernorUsername) {
      governors.set(planet.NaturalId, {
        username: planet.GovernorUsername,
        corporationName: planet.GovernorCorporationName,
        corporationCode: planet.GovernorCorporationCode,
      });
    }
  }

  console.log(`Loaded governor data for ${governors.size} planets`);
}

export function getGovernor(planetNaturalId: string): GovernorInfo | null {
  return governors.get(planetNaturalId) ?? null;
}
