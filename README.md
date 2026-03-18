# Helm

Interactive galaxy map for [Prosperous Universe](https://prosperousuniverse.com/). Navigate star systems, explore planets and visualize shipping routes — all rendered real-time in your browser. No login needed.

**Live at:** [helm.27bit.dev](https://helm.27bit.dev)
**Project page:** [27bit.dev/helm](https://27bit.dev/helm/)

## Features

- **Resource Filter** — Pick a material and Helm shows the way. Every system with that resource gets highlighted and shows the concentration factor. Useful for scouting base locations without opening 40 PLI buffers.
- **Route Planner** — Quickly highlight the shortest path between any two systems, gateway-aware. Jump count included.
- **CX Distances & Prices** — Every system panel shows jump count to all 6 CX's with gateway use flagged. Available resources shown with the most recent ask price at that nearest CX (via FIO).
- **Planet & System Data** — Detail panels for every system and planet. Resources, environment, fertility, gravity, temperature — plus infrastructure data showing population tiers, happiness and more. Planet panel links directly to [PRUNPlanner](https://prunplanner.org) for base planning.
- **Search Everything** — Type-ahead across systems, planets and CoGC programs — name, natural ID, substring, whatever. Searching for a planet drops you straight into its system view with the target highlighted.
- **Gateway & Settled Overlays** — Toggle gateway links on and off. Settled systems overlay shows where bases already exist with fancy pants animations.
- **5 Colour Themes** — DryDock, CRT Terminal, PrUn Classic, Vivid and Colorblind Safe.
- **Keyboard-Enabled** — `/` to search, `G` for gateways, `S` for settled, `R` for resources, `Escape` cascades through close → exit.

## Controls

| Key | Action |
|-----|--------|
| `/` or `Ctrl+K` | Open search — type to find systems or planets |
| `Tab` | Accept top search suggestion |
| `Escape` | Cascade: close panel → exit system view → universe view |
| `G` | Toggle gateway connections on/off |
| `S` | Toggle settled systems overlay |
| `R` | Open resource filter picker |
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

No backend. No auth. No tracking. The entire app is static files + API calls.

## Data Sources

All data comes from the public [FIO REST API](https://rest.fnar.net/), fetched client-side on load. Gateway connections have no API endpoint — maintained manually in `src/data/gateways.json`.

## Getting Started

```bash
npm install
npm run dev        # Dev server at localhost:5173
npm run typecheck  # TypeScript compiler check
npm run build      # Production build → dist/
```

## Also Powers APXM

Helm is packaged as a library and embedded inside [APXM](https://27bit.dev/apxm/) — the empire HUD extension for Prosperous Universe. The desktop mode overlays your bases and ships live onto the universe map.

## Acknowledgements

- [FIO](https://rest.fnar.net/) — Community game data API for Prosperous Universe
- [Refined PrUn](https://github.com/refined-prun/refined-prun) — Browser extension that simplifies the Prosperous Universe interface and adds useful features
- [PRUNPlanner](https://prunplanner.org) — Empire and base planning and management tool
- [Taiyi's Map](https://universemap.taiyibureau.de/) — Interactive map with resource search and filter functionality

## License

MIT
