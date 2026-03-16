import type { ViewLevel, SelectedEntity, Route } from "../types/index.js";

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

export function offStateChange(listener: StateListener): void {
  listeners.delete(listener);
}

// Resource filter — persists until explicitly cleared
let resourceFilter: string | null = null; // MaterialId

export function getResourceFilter(): string | null {
  return resourceFilter;
}

export function setResourceFilter(materialId: string | null): void {
  if (materialId === resourceFilter) return;
  resourceFilter = materialId;
  notify();
}
