/**
 * Derive a planet's display name the way the PrUn client does.
 *
 * FIO marks unnamed planets by setting PlanetName to the raw naturalId
 * (e.g. "LS-014b"). When the parent system IS named, the game shows the
 * system name plus the orbital suffix ("Metis b"). Named planets ("Montem")
 * and planets in unnamed systems are returned unchanged.
 */
export function derivePlanetDisplayName(
  planetNaturalId: string,
  planetName: string,
  systemNaturalId: string,
  systemName: string,
): string {
  const planetIsUnnamed = planetName === planetNaturalId;
  const systemIsNamed = systemName !== systemNaturalId;
  if (planetIsUnnamed && systemIsNamed) {
    return planetNaturalId.replace(systemNaturalId, `${systemName} `);
  }
  return planetName;
}
