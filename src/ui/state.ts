import type { ViewLevel, SelectedEntity, Route } from "../types/index.js";
import type { BridgeSnapshot } from "../data/bridge-types.js";

type StateListener = () => void;

let viewLevel: ViewLevel = "galaxy";
let selectedEntity: SelectedEntity = null;
let focusedSystemId: string | null = null;
let activeRoute: Route | null = null;
let searchFocused = false;
let gatewaysVisible = (() => {
  try {
    const stored = localStorage.getItem("helm-gateways");
    return stored !== null ? stored === "true" : true;
  } catch { return true; }
})();

const listeners: Set<StateListener> = new Set();

function notify(): void {
  for (const fn of listeners) {
    fn();
  }
}

export function getViewLevel(): ViewLevel {
  return viewLevel;
}

export function getSelectedEntity(): SelectedEntity {
  return selectedEntity;
}

export function getFocusedSystemId(): string | null {
  return focusedSystemId;
}

export function setViewLevel(level: ViewLevel): void {
  if (level === viewLevel) return;
  viewLevel = level;
  notify();
}

export function setSelectedEntity(entity: SelectedEntity): void {
  // Skip if same entity already selected
  if (entity === null && selectedEntity === null) return;
  if (
    entity !== null &&
    selectedEntity !== null &&
    entity.type === selectedEntity.type &&
    entity.id === selectedEntity.id
  )
    return;
  selectedEntity = entity;
  notify();
}

export function setFocusedSystem(systemId: string | null): void {
  if (systemId === focusedSystemId) return;
  focusedSystemId = systemId;
  notify();
}

export function getActiveRoute(): Route | null {
  return activeRoute;
}

export function setActiveRoute(route: Route | null): void {
  activeRoute = route;
  notify();
}

export function getSearchFocused(): boolean {
  return searchFocused;
}

export function setSearchFocused(focused: boolean): void {
  searchFocused = focused;
}

export function onStateChange(listener: StateListener): void {
  listeners.add(listener);
}

export function getGatewaysVisible(): boolean {
  return gatewaysVisible;
}

export function setGatewaysVisible(visible: boolean): void {
  if (visible === gatewaysVisible) return;
  gatewaysVisible = visible;
  try { localStorage.setItem("helm-gateways", String(visible)); } catch { /* */ }
  notify();
}

let settledVisible = (() => {
  try {
    return localStorage.getItem("helm-settled") === "true";
  } catch { return false; }
})();

export function getSettledVisible(): boolean {
  return settledVisible;
}

export function setSettledVisible(visible: boolean): void {
  if (visible === settledVisible) return;
  settledVisible = visible;
  try { localStorage.setItem("helm-settled", String(visible)); } catch { /* */ }
  notify();
}

let empireDim = (() => {
  try {
    return localStorage.getItem("helm-empire-dim") === "true";
  } catch { return false; }
})();

export function getEmpireDim(): boolean {
  return empireDim;
}

export function setEmpireDim(v: boolean): void {
  if (v === empireDim) return;
  empireDim = v;
  try { localStorage.setItem("helm-empire-dim", String(v)); } catch { /* */ }
  notify();
}

export function offStateChange(listener: StateListener): void {
  listeners.delete(listener);
}

// --- Per-topic filter subscriptions ---
// These fire only when the specific filter changes, unlike onStateChange which
// fires on every state mutation. This prevents cross-contamination between
// independent filter handlers (e.g. gateway toggle triggering resource filter logic).

const resourceFilterListeners: Set<StateListener> = new Set();
const cogcFilterListeners: Set<StateListener> = new Set();

function notifyResourceFilterListeners(): void {
  for (const fn of resourceFilterListeners) fn();
}

function notifyCogcFilterListeners(): void {
  for (const fn of cogcFilterListeners) fn();
}

export function onResourceFilterChange(listener: StateListener): void {
  resourceFilterListeners.add(listener);
}

export function offResourceFilterChange(listener: StateListener): void {
  resourceFilterListeners.delete(listener);
}

export function onCogcFilterChange(listener: StateListener): void {
  cogcFilterListeners.add(listener);
}

export function offCogcFilterChange(listener: StateListener): void {
  cogcFilterListeners.delete(listener);
}

// --- Bridge snapshot (Helm Extension data) ---
// Same listener-set pattern as the filter subscriptions above. Phase 3 wires
// snapshot reception via src/data/bridge.ts; Phase 4+ panels subscribe here.

let bridgeSnapshot: BridgeSnapshot | null = null;
const bridgeSnapshotListeners: Set<StateListener> = new Set();

function notifyBridgeSnapshotListeners(): void {
  for (const fn of bridgeSnapshotListeners) fn();
}

export function getBridgeSnapshot(): BridgeSnapshot | null {
  return bridgeSnapshot;
}

export function setBridgeSnapshot(snapshot: BridgeSnapshot | null): void {
  bridgeSnapshot = snapshot;
  notifyBridgeSnapshotListeners();
}

export function onBridgeSnapshotChange(listener: StateListener): void {
  bridgeSnapshotListeners.add(listener);
}

export function offBridgeSnapshotChange(listener: StateListener): void {
  bridgeSnapshotListeners.delete(listener);
}

// Resource filter — list of MaterialIds. Empty = inactive. Multiple
// entries = AND across resources (matching planets must contain all).
let resourceFilters: string[] = [];

export function getResourceFilters(): readonly string[] {
  return resourceFilters;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function setResourceFilters(ids: readonly string[]): void {
  if (arraysEqual(ids, resourceFilters)) return;
  resourceFilters = ids.slice();
  // Mutually exclusive: setting any resource clears COGC
  if (resourceFilters.length > 0 && cogcFilter !== null) {
    cogcFilter = null;
    notifyCogcFilterListeners();
  }
  notifyResourceFilterListeners();
  notify();
}

/** Convenience: replace the entire filter with a single material, or clear. */
export function setResourceFilter(materialId: string | null): void {
  setResourceFilters(materialId === null ? [] : [materialId]);
}

export function addResourceFilter(materialId: string): void {
  if (resourceFilters.includes(materialId)) return;
  setResourceFilters([...resourceFilters, materialId]);
}

export function removeResourceFilter(materialId: string): void {
  if (!resourceFilters.includes(materialId)) return;
  setResourceFilters(resourceFilters.filter((id) => id !== materialId));
}

// COGC filter — persists until explicitly cleared, mutually exclusive with resource filter
let cogcFilter: string | null = null; // COGC category key

export function getCogcFilter(): string | null {
  return cogcFilter;
}

export function setCogcFilter(category: string | null): void {
  if (category === cogcFilter) return;
  cogcFilter = category;
  // Mutually exclusive: setting COGC clears resource
  if (category !== null && resourceFilters.length > 0) {
    resourceFilters = [];
    notifyResourceFilterListeners();
  }
  notifyCogcFilterListeners();
  notify();
}
