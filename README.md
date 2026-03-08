# Helm

Interactive galaxy map for [Prosperous Universe](https://prosperousuniverse.com/). Renders the full PrUn universe as a navigable, zoomable 2D map with star systems, planets, jump connections, gateways, commodity exchanges, and detail panels.

Built with Pixi.js (WebGL), styled in the DryDock design language.

**Live at:** [helm.27bit.dev](https://helm.27bit.dev)

## Features

- **698 star systems** rendered with spectral-accurate colours, sized by connectivity
- **117 sector hexagons** overlaid on the galaxy view
- **Smooth zoom transitions** from galaxy overview into individual system views
- **Procedural planet rendering** — Canvas2D sphere textures with data-driven colours and animated cloud wisps
- **Search** — type-ahead across systems and planets by name, ID, or substring
- **Route planner** — BFS shortest path with highlighted route overlay
- **Gateway connections** — purple bezier arcs between gateway-linked systems, toggleable with `G`
- **CX markers** — pulsing diamond beacons on commodity exchange systems
- **Detail panels** — click any system or planet for full information
- **Keyboard navigation** — arrow keys to pan, `+`/`-` to zoom, `/` to search, `Escape` to back out

## Tech Stack

- **Renderer:** [Pixi.js 8](https://pixijs.com/) (WebGL 2D)
- **Camera:** [pixi-viewport](https://github.com/davidfig/pixi-viewport) (pan/zoom/pinch)
- **UI:** HTML/CSS overlay (vanilla TypeScript, no framework)
- **Build:** [Vite 6](https://vite.dev/), TypeScript 5.7 (strict)
- **Data:** [FIO REST API](https://rest.fnar.net/) — client-side fetch, cached in memory
- **Hosting:** [Cloudflare Pages](https://pages.cloudflare.com/) (static site)

No backend. No auth. The entire app is static files + API calls.

## Getting Started

```bash
npm install
npm run dev        # Dev server at localhost:5173
npm run typecheck  # TypeScript compiler check
npm run build      # Production build → dist/
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` or `Ctrl+K` | Open search |
| `Escape` | Close panel → exit system view → fit galaxy |
| `G` | Toggle gateway connections |
| Arrow keys | Pan |
| `+` / `-` | Zoom in / out |

## Data Sources

All data comes from the public [FIO REST API](https://rest.fnar.net/):

| Endpoint | Data |
|----------|------|
| `/systemstars` | System positions, connections, star spectral data |
| `/planet/allplanets/full` | Planet details, resources, environment |
| `/exchange/station` | CX station locations |
| `/material/allmaterials` | Material ticker codes |

Gateway connections have no API endpoint — maintained manually in `src/data/gateways.json`.

## Project Structure

```
src/
├── main.ts                  # Entry point, loading, toolbar wiring
├── version.ts               # Version string
├── renderer/
│   ├── MapRenderer.ts       # Pixi application, viewport, camera transitions
│   ├── GalaxyLayer.ts       # Stars, jump lines, route overlay, gateways
│   ├── SystemLayer.ts       # Planets, orbital layout, star glow, particles
│   ├── PlanetTexture.ts     # Procedural planet/star sphere textures
│   ├── HexGridLayer.ts      # Sector hex grid overlay
│   ├── BackgroundLayer.ts   # Parallax star field + nebula clouds
│   ├── StarParticles.ts     # Hover particle effects
│   └── Tween.ts             # Property tween manager
├── data/
│   ├── fio.ts               # FIO API client
│   ├── cache.ts             # In-memory data cache + coordinate processing
│   ├── gateways.json        # Hand-maintained gateway pairs
│   ├── pathfinding.ts       # BFS shortest path
│   └── searchIndex.ts       # Fuzzy search index
├── ui/
│   ├── panels/              # System/planet detail panels
│   ├── search/              # Toolbar: search bar, route panel, CSS
│   ├── state.ts             # View level, selection, route state
│   ├── theme.ts             # Theme token management
│   └── controls.ts          # Keyboard shortcuts
└── types/
    └── index.ts             # Shared type definitions
```

## Related Projects

- [APXM](https://github.com/Zillatron27) — mobile browser extension, will embed Helm via Bridge API for empire overlay
- [DryDock](https://github.com/Zillatron27/drydock) — ship blueprint cost calculator, shares design language

## License

MIT
