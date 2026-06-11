# Helm

Interactive galaxy map for [Prosperous Universe](https://prosperousuniverse.com/). Navigate star systems, explore planets and visualize shipping — all rendered real-time.

**Live at:** [helm.27bit.dev](https://helm.27bit.dev)
**Project page:** [27bit.dev/helm](https://27bit.dev/helm/)

Helm operates in 2 modes:
- **Standalone** (no extension): Open in a browser tab or a XIT WEB buffer to show the universe map including public FIO data.
- **Helm Extension**: With the browser extension installed, Helm additionally displays your own empire — base markers, ships and warehouses — directly on the map.


## Features

- **Resource Filter** — Pick one or more materials and Helm shows the way. Every system with a selected resource gets highlighted with its concentration factor, and a sortable results sidebar ranks every contributing planet by factor and CX distance. Useful for scouting base locations without opening a pile of PLI buffers.
- **Route Planner** — Quickly highlight the shortest path between any two systems, gateway-aware.
- **Planet & System Data** — Detail panels for every system and planet. Resources, environment, fertility, gravity, temperature — plus infrastructure data showing population tiers, happiness and more. Planet panel links directly to [PRUNPlanner](https://prunplanner.org) for base planning.
- **CX Distances & Prices** — System detail panel shows jump count to all 6 CX's with gateway use flagged. Available resources shown with the most recent ask price at that nearest CX (via FIO).
- **Search Everything** — Type-ahead across systems, planets and CoGC programs — name, natural ID, substring, whatever. Selecting a planet drops you straight into the system view with the planet highlighted.
- **Gateway Overlay** — Toggle gateway links on the map.
- **5 Colour Themes** — DryDock, CRT Terminal, PrUn Classic, Vivid and Colorblind Safe.
- **Keyboard-Enabled** — `/` to search, `G` for gateways, `S` for settled, `R` for resources, `Escape` cascades through close → exit.

Additionally, with the [Helm Extension](https://github.com/Zillatron27/helm-extension) installed:
- **Empire base markers** — accent rings on every system and planet where you have a base, in galaxy and system view
- **Live ship tracking** — docked-ship markers at planets and exchanges, in-flight ships interpolated along their flight paths in real time, with flight-phase status and ETA on hover
- **Empire lens** (`E` key) — dims the galaxy to your empire and frames it; persists across visits
- **CX warehouse indicators** — a crate marker at every commodity exchange where you hold warehouse space
- **CX-coded ship panels** — ships at or bound for an exchange read as the CX code (`ANT`, `MOR`, `BEN`…), matching the map

Empire overview panels (burn status, fleet overview, buffer bridging, screen switching) are the next phase — follow the [issues](https://github.com/Zillatron27/helm/issues) for progress.

## Controls

| Key | Action |
|-----|--------|
| `/` or `Ctrl+K` | Open search — type to find systems or planets |
| `Tab` | Accept top search suggestion |
| `Escape` | Cascade: close panel → exit system view → universe view |
| `G` | Toggle gateway connections on/off |
| `R` | Open resource filter picker |
| `E` | Toggle empire lens (with extension) |
| Arrow keys | Pan the map |
| `+` / `−` | Zoom in / out |
| Click star | Select system, open detail panel |
| Double-click star | Enter system view |
| Click planet | Select planet, show detail panel with resources |
| Hover star | Highlight direct jump connections |
| Mouse wheel | Zoom — zooming out past system threshold auto-exits system view |

## Tech Stack

- **[Pixi.js 8](https://pixijs.com/)** — WebGL 2D rendering
- **[pixi-viewport](https://github.com/davidfig/pixi-viewport)** — pan / zoom / pinch
- **TypeScript 5.7** — strict mode
- **[Vite 6](https://vite.dev/)** — build & dev server
- **[Cloudflare Pages](https://pages.cloudflare.com/)** — hosting

## Data Sources

Public data comes from [FIO REST API](https://rest.fnar.net/); empire-specific data is collected and rendered in the client browser only.

## Getting Started

```bash
npm install
npm run dev        # Dev server at localhost:5173
npm run typecheck  # TypeScript compiler check
npm run build      # Production build → dist/
```

## With the Helm Extension

When the [Helm Extension](https://github.com/Zillatron27/helm-extension) is installed, Helm becomes the desktop empire-overview surface for Prosperous Universe. The extension reads live game state from APEX and feeds it across the Helm Bridge; Helm draws empire overlays on the map (your bases, ships, CX inventory presence) and renders overview panels (burn, fleet, etc.). Helm remains fully useful standalone without the extension — it's an additive enhancement, not a dependency.

## Acknowledgements

- [FIO](https://rest.fnar.net/) — Community game data API for Prosperous Universe
- [Refined PrUn](https://github.com/refined-prun/refined-prun) — Browser extension that simplifies the Prosperous Universe interface and adds useful features
- [PRUNPlanner](https://prunplanner.org) — Empire and base planning and management tool
- [Taiyi's Map](https://universemap.taiyibureau.de/) — Interactive map with resource search and filter functionality

## License

MIT
