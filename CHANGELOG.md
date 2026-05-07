# Changelog

## 0.11.0-dev — feature/hud

Phase 3 HUD chassis + Helm Extension bridge reception + empire dim lens (Capability 1) + empire base markers (Capability 2) + docked-ship indicators (Capability 3) of the empire overlay spec. Multi-resource filter (issue #6) — multi-select with OR semantics.

### Added

- **Results sidebar for resource filter** (#7) — when a resource filter is active a sortable table slides in from the left edge listing every (planet, material) contribution across the universe. Two independent controls: a CX target toggle (`Nearest | AI1 | CI1 | NC1 | IC1 | …`) controls *what* the CX column displays, and clickable column headers control *how* rows are sorted. Click the CX column with a target picked → ranked by jumps to that CX, the prunplanner workflow. Default sort is factor descending. Columns: Planet (name + system NaturalId · system name), Mat ticker, Factor %, CX (label + jumps with `⬡` marker for gateway-using paths), Bases. Clicking a row pans the camera to that system and opens the system panel; if the user is in system view it zooms out first then pans (matches `PanelManager.navigateToSystem`). Sidebar hides when filter clears. Hidden under 900px viewports — left-edge sidebar would crowd the map at narrow widths.
- **COGC filter dims non-matching planets in system view** (#3) — when a COGC program filter is active and the user enters system view, planets without that active program dim to 0.2 alpha, matching the resource-filter treatment. New `getCogcPlanetMatches()` in `filterMatches.ts` projects the COGC index into a planet-natural-id set; `main.ts` adds it to the planet-side composition (resource + COGC + empire intersection). No new rendering code — reuses the existing `SystemLayer.setDimmedPlanets` pipeline. UI-side mutual exclusion between resource and COGC filters (0.10.0) means only one usually drives the dim, but the intersection is correct if both are somehow active.
- **Live gateway data from FIO** (#12) — replaces hand-maintained `gateways.json` (deleted) with `GET https://api.fnar.net/gateway` (FIO V2). Fetched in parallel with `/systemstars` on boot; soft-fails if the V2 host is down (logs error, renders without gateway arcs). The fetch returns per-gateway records with `OutgoingLink` GatewayId references, which the cache resolves into the existing `GatewayConnection` / `GatewayEndpoint` shape so renderer code is unchanged. **Under-construction / unlinked gateways now appear in system view as a dotted ring** (12 evenly-spaced arc segments at 45% dash fraction) with a "(under construction)" hover label and no destination line. Established gateways keep the existing solid ring + direction line. Galaxy-view arcs, system indicators, and pathfinding adjacency continue to use ESTABLISHED links only.
- **Multi-resource filter** (#6) — resource picker is now multi-select: Tab on a result adds it and keeps the picker open for chaining; Enter adds and closes; clicking a selected row removes it. Inline pill row of badges sits left of the toolbar button (one per filter, individual ×). Galaxy and system view dim to systems / planets that contribute **any** selected material (OR / union). Concentration dots scale with the system's best yield across the selected set. System panel under multi-filter shows a flat ranked list of (planet, material) contributions sorted by factor — a planet with multiple selected materials appears once per material so the strongest yields rise to the top. Single-resource view is unchanged.
- **Docked-ship indicators** (Capability 3 of empire-overlay spec) — right-pointing filled chevrons (8px, 3px overlap) render beside any planet (system view) or system (galaxy view) that has docked ships in the bridge snapshot. **Glyph count adapts to fleet size**: 1 ship → 1 chevron, 2+ ships → fixed 3-glyph stack. Hover tooltip is a floating panel matching the app's panel design language, showing the actual ship list (name, registration, status) with `+N more` truncation past 6 rows. **Galaxy view aggregates per-system** (any docked ship in the system, planet-docked or CX-docked, contributes to the count); system view shows per-planet stacks for planet-docked ships and a separate stack beside the central star for CX-docked ships (`locationPlanetNaturalId === null`) so a CX system isn't silently empty. Stack anchors just outside the empire ring footprint (or planet/star edge) so it sits cleanly whether or not the planet/system is empire-owned. `IN_FLIGHT` ships excluded across both views — Cap 4 territory.
- **Empire base markers** (Capability 2 of empire-overlay spec) — solid theme-accent rings render automatically on systems containing user sites (galaxy view, star edge + 4px) and on planets that are user sites (system view, planet edge + 4px). Visible whenever the bridge snapshot is present, independent of the empire-dim toggle. Galaxy and system view both use the same fixed-gap geometry so the empire ring → selection halo nesting is consistent across views: star/planet → ring (+4) → halo (+6). The galaxy-view selection halo also tracks star size now (was a fixed 14px radius — broke for large stars). Galaxy rings live in a new `empireBaseRings` container on `GalaxyLayer`, repainted on snapshot change, empire-index change, and theme rebuild via the existing `onAfterRebuild` hook. System-view rings draw inside `SystemLayer.applyEmpireOverlay()`. `getEmpireSystemIds()` / `getEmpirePlanetIds()` added to `empireIndex.ts` as the unconditional read path; existing toggle-gated `getEmpire*Matches` and the dim composition are untouched.
- **Empire dim / highlight lens** — toolbar button (tier-gated on bridge snapshot) and keyboard `E` toggle a lens that keeps empire systems bright and dims everything else on the galaxy view; same for empire planets in system view. Empty empire dims everything (intentional — matches empire-overlay.md §1). Toggling the lens on smoothly frames the empire's bounding box in the viewport via `MapRenderer.frameEmpire()`. State persists to `helm-empire-dim` localStorage key. Icon: concentric rings (bright centre + bright inner ring + dim outer ring at 0.4 opacity).
- **Bridge reception layer** (`src/data/bridge.ts`) — receives Helm Extension envelopes, validates protocol version, publishes `BridgeSnapshot` via `state.ts` subscription pattern. Tier-2 (standalone tab) and tier-3 (embedded iframe) paths, inline bootstrap buffer + `helm-bridge-page-ready` handshake to close the document_start race.
- **HUD framework chassis** (`src/ui/panels/OverviewPanelManager.ts`) — single-active-panel positioning, backdrop, viewport-clamped anchor, `#hud-toolbar-slot` placeholder. No panels mounted yet.
- **`window.__helm` debug handle** — `{ getBridgeSnapshot, onBridgeSnapshotChange }`, exposed unconditionally for console verification across tier 2/3 origins.
- **`empireIndex.ts`** — derived view of `snapshot.sites[]` yielding empire system UUIDs and planet natural IDs, exposed via `getEmpireSystemMatches` / `getEmpirePlanetMatches` / `onEmpireIndexChange`. Returns null when the lens is off so it drops out of composition.
- **`filterMatches.ts`** — thin projection layer reading filter state and index data into `Set`s of match IDs (`getResourceSystemMatches`, `getResourcePlanetMatches`, `getCogcSystemMatches`).
- **`MapRenderer.onAfterRebuild`** — callback surface fired at the end of `rebuild()` so consumers can re-apply composition state after a theme swap reconstructs layers.
- **`MapRenderer.setDimmedPlanets` / `setResourceConcentrations` / `setResourceConcentrationsAsync`** — narrower renderer API that separates "draw concentration dots" from "apply dim."
- **`MapRenderer.frameEmpire()`** — reads empire set and frames the empire's bounding box via the existing `frameRoute` path.

### Changed

- **Composition refactor.** Resource filter and COGC filter no longer drive dimming from inside their rendering paths. A single composition function in `main.ts` intersects the active (non-null) match sets from resource + COGC + empire and calls `renderer.setHighlightedSystems(compose())` and `renderer.setDimmedPlanets(compose())` once. Up to three filters can compose; bright set is the N-way intersection. Composed sets are memoized so `onStateChange` tickling (view level, selection, route) doesn't re-enter `applyHighlightFilter` unnecessarily.
- **`GalaxyLayer.setResourceFilter` / `setResourceFilterAsync` → `setResourceConcentrations` / `setResourceConcentrationsAsync`.** Concentration dots only; no longer touch highlight state. Async version carries a generation counter so rapid picker changes cancel stale runs instead of interleaving dots.
- **`SystemLayer.setResourceFilter` → `setDimmedPlanets(naturalIds)`.** Layer no longer reaches into `resourceIndex` itself; main.ts supplies the composed set. `show()` replays the stored set after planet construction, covering the fire-and-forget planet-load re-entry path.
- **Settled-system toolbar button removed.** Keyboard `S`, rendering, localStorage (`helm-settled`), and data layer all retained — only the toolbar entry point is gone.
- **Bridge timing hardened.** Inline bootstrap in `index.html` captures `helm-extension-hello` / `helm-init` / `helm-update` before the module bundle evaluates; dispatches `helm-bridge-page-ready` to tell the extension it's safe to flush. Extension waits on that event before delivering, eliminating the document_start race.
- **Bridge diagnostic timer** extended from 3s to 10s to cover SW cold start + runtime IPC on Firefox.

### Fixed

- **CX diamonds, gateway arcs/indicators, jump lines, glow container, and route overlay disappearing after system-view exit** — `applyComposition` was firing on every `onStateChange` (view level, selection, route), each pass calling `setHighlightedSystems` → `applyHighlightFilter` → `tweens.clear()`. The clear killed in-flight restore tweens that `galaxy.restore()` had just started to fade containers from 0.05 (system-view dim) back to 1.0, freezing them mid-tween. Fix: memoize the composed galaxy and planet sets so the renderer is only called when they actually change; reset the memo on `onAfterRebuild`.
- **Stale cross-tab transport teardown** on helm-tab reload (`browser.tabs.onRemoved` doesn't fire on reload; extension now tears down stale transports before reconnecting).

## 0.10.1 — 2026-03-18

Filter state refactor, highlight rendering fix, COGC data source fix, and UI polish.

### Fixed

- **COGC search timing** — COGC results were injected into the search array asynchronously after the 35MB planet fetch. Searching before fetch completed returned no COGC results. COGC entries are now built on-the-fly during `search()` when the resource index is ready.
- **Wrong COGC program names** — replaced fake program types (Education, Family Support, Festivities, Immigration) with the 9 real COGC advertising programs. WORKFORCE_* entries removed (not COGC programs).
- **Highlight tween race condition** — async `setResourceFilterAsync` set star alphas directly, but stale hover/unhover tweens running on the Pixi ticker overwrote them during `yieldToMain()` yields, preventing dimming from appearing. Fix: clear all tweens before applying highlight alphas.
- **COGC wrong data source** — planet panel was reading COGC programs from the `/infrastructure` endpoint (`InfrastructurePrograms`), which only contains population programs (IMMIGRATION, EDUCATION, FESTIVITIES). Actual COGC programs come from `COGCPrograms` on the full planet endpoint.
- **COGC filter cleared by syncToggles** — `syncToggles` god function ran every sync path on every state change, causing resource filter clearing to wipe COGC highlights.
- **Expand panel z-index** — filter badges no longer render on top of the search input when the search bar is open.

### Changed

- **Per-topic state subscriptions** — split `syncToggles` into dedicated `onResourceFilterChange` and `onCogcFilterChange` handlers. `syncToggles` now only handles gateways and settled visibility. Each filter handler owns its full lifecycle with symmetric highlight teardown guards.
- **SearchBar simplified** — no longer applies highlights or manages badge text directly. Public `showCogcBadge`/`removeCogcBadge`/`showButtonSpinner`/`restoreButtonIcon` methods for the handler in main.ts.
- **COGC filtered to ADVERTISING_* only** — COGC index, search, and display all filter to `ADVERTISING_*` program types. Migration and workforce programs excluded.
- **Resource panel polish** — camelCase FIO material names formatted with spaces ("aluminiumOre" → "Aluminium Ore"). Resource type label (Mineral/Gas/Liquid) removed from filter panel rows. Concentration percentage shown next to resource bars.
- **COGC search results** — redundant `ADVERTISING_*` subtext removed from search dropdown.

### Added

- **Search button loading spinner** — search button shows a mini orbital spinner during COGC highlight computation and while `allplanets/full` loads. Same pattern as the resource filter button.
- **Shared `yieldToMain` utility** — extracted from GalaxyLayer to `src/util/yieldToMain.ts` for reuse.
- **`clearResourceIndicators`** — new method on GalaxyLayer and MapRenderer to decouple indicator cleanup from highlight clearing.

## 0.10.0 — 2026-03-18

COGC program display, planet panel reorder, and COGC search filter.

### Added

- **COGC program display** — planet panel Population & Economy section now shows the active COGC program name and time remaining. Shows "No active program" for planets with a COGC but no current program.
- **COGC search** — typing COGC program types (e.g. "agriculture", "family support") in the search bar returns COGC results. Selecting one highlights matching systems on the galaxy view using the same lens pattern as the resource filter. Clicking a highlighted system shows a contextual panel listing planets with that active program.
- **COGC filter badge** — active COGC filter shows a dismissible badge next to the search button. Clears on badge ×, Escape, or selecting a different search result.
- **COGC/resource filter mutual exclusion** — selecting a COGC filter clears any active resource filter and vice versa.

### Changed

- **Planet panel section reorder** — new order: CX Distance → Resources → Environment → Population & Economy → Infrastructure → Core Module Requirements → Faction → Actions. Population & Economy moves up (was below Infrastructure), Core Modules moves down.
- **Base count merged into Population & Economy** — base count is now the first row inside the collapsible Population & Economy section, rendered immediately. The standalone "Population" section is removed.
- **Escape key** — now clears active COGC or resource filter before dismissing panels or exiting system view.

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
