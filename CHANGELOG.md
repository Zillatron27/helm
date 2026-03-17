# Changelog

## 0.9.0 — 2026-03-17

Server-side analytics via Cloudflare Worker.

### Added

- **Cloudflare Worker** (`worker.ts`) — wraps static asset serving, sends fire-and-forget analytics events to Umami on each page view. No client-side JavaScript, no cookies, no tracking pixels.
- **`run_worker_first`** — Worker executes on every request, delegates to `env.ASSETS.fetch()` for static assets, ensuring analytics fire even on cached content.
- **`typecheck:worker`** script — separate TypeScript config for the Worker runtime (no DOM, Cloudflare Workers types).

## 0.6.0 — 2026-03-10

Bridge API: independent gateway indicator control.

### Added

- **`setGatewayIndicatorsVisible()`** — new method on MapRenderer and GalaxyLayer that hides/shows gateway indicator dots independently of gateway arcs. Enables the APXM shell to re-render indicators at status grid positions while keeping the arc curves visible.

## 0.5.0 — 2026-03-09

Library entry point for APXM embedding.

### Added

- **`createMap()` factory** — async function that loads all data, initialises the renderer and panel manager, and returns a `HelmInstance` with convenience methods. Consumers call one function instead of orchestrating the full boot sequence.
- **Library entry point** (`src/index.ts`) — re-exports factory, data queries, pathfinding, search, state, theme, and all types. Internal loading functions are not exposed.
- **`package.json` exports field** — `@27bit/helm` with sub-path exports for `./renderer/*`, `./data/*`, `./state`, `./theme`, `./types`.
- **Self-contained panel styles** — `panel.css` import moved into `PanelManager.ts` so styles load automatically for library consumers.

### Changed

- `main.ts` simplified to consume `createMap()` for data/renderer init. Standalone chrome (toolbar, search, settings, version label) remains in main.ts.
- Package renamed from `helm` to `@27bit/helm`.

## 0.4.0 — 2026-03-09

Theme system with hot-swap, settings panel, and 5 presets.

### Added

- **Theme presets** — 5 colour themes: DryDock (default), CRT, PrUn Classic, Vivid, and Colorblind Safe.
- **Settings panel** — cog button in toolbar opens a theme picker with colour swatch previews.
- **Runtime theme hot-swap** — switching themes rebuilds all Pixi.js layers and updates CSS custom properties without page reload. Camera position, gateway visibility, active route, and system view state are preserved across switches.
- **localStorage persistence** — selected theme is saved and restored on page load.
- **CSS custom properties** — all panel, toolbar, and search colours driven by CSS variables set from theme tokens. Semantic type-specific colours (rocky/gas badges, gateway purple, flag-active green) remain fixed.
- **Colorblind-safe mode** — positive/negative indicators use blue/orange instead of red/green.

### Changed

- All hardcoded CSS hex colours in panel.css and search.css replaced with CSS custom property references.
- HexGridLayer reads stroke colour from theme tokens instead of hardcoded constant.
- `ThemeTokens` interface extended with `hexStroke` field.

## 0.3.1 — 2026-03-08

Search and navigation improvements.

### Added

- **Planet search navigation** — searching for a planet zooms to its system view and selects it with a halo indicator.
- **Planet selection halo** — Elite-style blue arc indicator with slow pulse animation on selected planets.
- **Substring search** — search matches anywhere in name/ID, not just prefix.
- **Tab completion** — Tab key accepts the top search suggestion.
- **Route framing** — camera fits all route systems into view after calculation.
- **Route auto-clear** — collapsing the route panel clears the active route overlay.
- **Exit system view on route** — calculating a route exits system view to show the full path.

### Fixed

- Search dropdown no longer clips behind toolbar elements.

### Changed

- All toolbar icons scaled from 18px to 24px.
- Gateway icon redesigned: tall arc with ring endpoints.
- Halo pulse slowed for subtlety.

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

Phase 4: Visual polish, interaction improvements, and atmosphere.

### Added

- **Connection highlighting on hover/select** — hovering a star highlights its direct jump connections in orange and dims non-connected stars. Clicking persists the highlight while the panel is open. Hover + select is additive.
- **Star size by connection count** — hub systems (5+ connections) render larger than peripheral dead-ends, making network structure readable at a glance.
- **CX location markers** — 6 commodity exchange systems display orange diamond glyphs with exchange code labels (AI1, CI1, CI2, IC1, NC1, NC2). System panel shows exchange details for CX systems.
- **Two-stage Escape from system view** — first Escape exits to sector neighbourhood (centred on the system you were viewing), second Escape zooms to full galaxy fit.
- **Empty-space click cascade** — clicking empty space mirrors Escape behaviour: close panel, then exit system view. Double-click guard prevents cascading through two steps at once.
- **Zoom-based auto-dismiss** — manually zooming out past the system view threshold automatically exits system view. Zooming out far at galaxy level auto-deselects.
- **Nebula clouds** — Canvas2D radial gradient sprites at parallax 0.25, adding atmospheric depth to the galaxy view.
- **Star twinkle** — per-star sine wave brightness oscillation with deterministic frequency/phase from system ID.
- **System view glow** — radial gradient sprite on central star in system view.
- **System view ambient particles** — 20 orbiting particles with 30-point trails around the central star.
- **Procedural planet rendering** — Canvas2D sphere textures with data-driven colours, animated cloud wisps, seeded from planet ID hash.
- **Procedural star spheres** — Canvas2D sphere lighting for stars in system view.
- **System view fade-in/out** — 400ms fade-in on arrival, 300ms fade-out on exit.
- **Panel content transitions** — cross-fade on content swap with deferred event wiring.
- **System-to-system navigation** — double-click a star in system view to transition directly.
- **Gateway connections** — purple bezier arcs between gateway-linked systems, small ring indicators on gateway systems, hover labels on gateway rings in system view.
- **Floating detail panel** — compact card in bottom-right with backdrop blur.
- **Material ticker resolution** — `/material/allmaterials` lookup resolves UUIDs to readable ticker codes in planet resource lists.

### Changed

- Galaxy layer dims properly during system view — base connections, hex grid, route overlay, CX markers, and gateway layers all fade to near-invisible.
- Star base radius increased from 4 to 7 with proportional hit area (24px).
- All label sizes increased for readability at a glance.
- Default zoom set to 1.5× fitWorld on initial load.
- Smooth alpha transitions (TweenManager) for all state changes instead of instant snaps.

## 0.1.0 — 2026-03-04

Initial release. Core rendering pipeline: galaxy map, system zoom, search, pathfinding, hex grid overlay.
