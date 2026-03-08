# Changelog

## 0.3.0 — 2026-03-08

UI toolbar refactor and gateway toggle.

### Added

- **Top-right toolbar** — search, route planner, and gateway toggle relocated from centre-top to a vertical toolbar in the top-right corner. Panels expand leftward on click with smooth CSS transitions.
- **Gateway visibility toggle** — circular button with hexagon icon toggles gateway arcs and indicators on/off. Purple accent when on, subdued when off. `G` keyboard shortcut.
- **Version indicator** — subtle `v0.3.0` label in the bottom-right corner.

### Changed

- SearchBar and RoutePanel no longer self-append to `document.body`. Main.ts creates the toolbar container and mounts all rows.
- Search bar collapses when empty and blurred; expands on `/` or button click.
- Route panel uses same expand/collapse pattern as search.
- Removed `#search-container`, `#route-container`, `.route-toggle` elements — replaced by toolbar row pattern.

## 0.2.0 — 2026-03-05

Phase 4a: Visual polish and interaction improvements.

### Added

- **Connection highlighting on hover/select** — hovering a star highlights its direct jump connections in orange and dims non-connected stars. Clicking persists the highlight while the panel is open. Hover + select is additive.
- **Star size by connection count** — hub systems (5+ connections) render larger than peripheral dead-ends, making network structure readable at a glance.
- **CX location markers** — 6 commodity exchange systems display orange diamond glyphs with exchange code labels (AI1, CI1, CI2, IC1, NC1, NC2). System panel shows exchange details for CX systems.
- **Two-stage Escape from system view** — first Escape exits to sector neighbourhood (centred on the system you were viewing), second Escape zooms to full galaxy fit.
- **Empty-space click cascade** — clicking empty space mirrors Escape behaviour: close panel, then exit system view. Double-click guard prevents cascading through two steps at once.
- **Zoom-based auto-dismiss** — manually zooming out past the system view threshold automatically exits system view. Zooming out far at galaxy level auto-deselects.

### Changed

- Galaxy layer dims properly during system view — base connections, hex grid, route overlay, and CX markers all fade to near-invisible, not just stars.
- Star base radius increased from 4 to 7 with proportional hit area (24px).

## 0.1.0 — 2026-03-04

Initial release. Core rendering pipeline: galaxy map, system zoom, search, pathfinding, hex grid overlay.
