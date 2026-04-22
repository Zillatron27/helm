/**
 * Helm Extension bridge protocol version + compatibility check.
 *
 * Canonical source: helm-extension/lib/protocol.ts (lines 8, 16-25, 33-43).
 * Keep in sync — drift between the two sides' compatibility logic is a foot-gun.
 *
 * See helm-extension-bridge-protocol.md §7 for version semantics.
 */

export const PROTOCOL_VERSION = "v1.0.0";

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

export function parseProtocolVersion(raw: unknown): ParsedVersion | null {
  if (typeof raw !== "string") return null;
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(raw.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export type VersionCompatibility =
  | { kind: "ok" }
  | { kind: "minor-mismatch"; local: ParsedVersion; remote: ParsedVersion }
  | { kind: "major-mismatch"; local: ParsedVersion; remote: ParsedVersion }
  | { kind: "unparseable"; raw: unknown };

export function checkProtocolCompatibility(
  remoteRaw: unknown,
  localRaw: string = PROTOCOL_VERSION,
): VersionCompatibility {
  const remote = parseProtocolVersion(remoteRaw);
  if (!remote) return { kind: "unparseable", raw: remoteRaw };
  const local = parseProtocolVersion(localRaw)!;
  if (remote.major !== local.major) return { kind: "major-mismatch", local, remote };
  if (remote.minor !== local.minor) return { kind: "minor-mismatch", local, remote };
  return { kind: "ok" };
}
