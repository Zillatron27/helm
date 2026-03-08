import type { ViewLevel, SelectedEntity, Route } from "../types/index.js";

type StateListener = () => void;

let viewLevel: ViewLevel = "galaxy";
let selectedEntity: SelectedEntity = null;
let focusedSystemId: string | null = null;
let activeRoute: Route | null = null;
let searchFocused = false;
let gatewaysVisible = true;

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

export function getGatewaysVisible(): boolean {
  return gatewaysVisible;
}

export function setGatewaysVisible(visible: boolean): void {
  if (visible === gatewaysVisible) return;
  gatewaysVisible = visible;
  notify();
}

export function onStateChange(listener: StateListener): void {
  listeners.add(listener);
}

export function offStateChange(listener: StateListener): void {
  listeners.delete(listener);
}
