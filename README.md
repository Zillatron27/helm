# Helm

Interactive galaxy map for [Prosperous Universe](https://prosperousuniverse.com/). Navigate star systems, explore planets and visualize shipping — all rendered real-time.

**Live at:** [helm.27bit.dev](https://helm.27bit.dev)
**Project page:** [27bit.dev/helm](https://27bit.dev/helm/)

Helm operates in 2 modes:
- **Standalone** (no extenstion): Open in a browser tab or a XIT WEB buffer to show the universe map including public FIO data.
- **Helm Extension**: With the browser extension installed, Helm will display base markers, ships etc directly on the map. If the map is opened in a XIT WEB buffer you can additionally interact directly with PrUn buffers, without switching screens. 


## Features

- **Resource Filter** — Pick a material and Helm shows the way. Every system with that resource gets highlighted and shows the concentration factor. Useful for scouting base locations without opening a pile of PLI buffers.
- **Route Planner** — Quickly highlight the shortest path between any two systems, gateway-aware.
- **Planet & System Data** — Detail panels for every system and planet. Resources, environment, fertility, gravity, temperature — plus infrastructure data showing population tiers, happiness and more. Planet panel links directly to [PRUNPlanner](https://prunplanner.org) for base planning.
- **CX Distances & Prices** — System detail panel shows jump count to all 6 CX's with gateway use flagged. Available resources shown with the most recent ask price at that nearest CX (via FIO).
- **Search Everything** — Type-ahead across systems, planets and CoGC programs — name, natural ID, substring, whatever. Selecting a planet drops you straight into the system view with the planet highlighted.
- **Gateway Overlay** — Toggle gateway links on the map.
- **5 Colour Themes** — DryDock, CRT Terminal, PrUn Classic, Vivid and Colorblind Safe.
- **Keyboard-Enabled** — `/` to search, `G` for gateways, `S` for settled, `R` for resources, `Escape` cascades through close → exit.

Additinally with the Helm extesnsion installed:
- **Empire overlay** — owned systems highlighted with burn-coloured rings (green/amber/red) on the galaxy map and in system view
- **Live ship tracking** — idle ship and fleet markers at systems, in-transit ships interpolated along flight paths in real time
- **Burn Status Panel** (B key) — per-base burn status (configurable thresholds), expandable material-level detail, urgency filtering, sort by urgency or system name.
- **Fleet Overview** (F key) — all ships with cargo/fuel bars, IDLE/TRANSIT filters, sort by ETA/name/cargo, click-to-zoom into any ship
- **Fleet Detail** (key here) — ship detail and controls   
- **CX Warehouse indicators** — orange dots at CX stations where you have a warehouse
- **CX Warehouse dropdown** (W key) — quick access to CX warehouse inventories
- **Empire highlight** (E key) — dims the galaxy to highlight only systems where you have bases and nearby CXs
- **Base panels** — click any owned planet in system view for production, storage, burn overviews and BS/INV/PROD shortcuts
- **Screen switching** — assign existing APEX screens to planet panels for quick navigation
- **Ship panels** — click any ship for cargo manifest, fuel, flight segment progress and Fly/Cargo/Fuel shortcuts
- **Buffer bridging** — panel buttons open the corresponding APEX buffer directly (BS, INV, PROD, SHP, CXM, FLT etc.)
- **rprun detection** — detects Refined PrUn and offers ACTS button integration (can be disabled)
- **Pro subscription detection** — detects if you are a Pro subscriber and adjust buffer bridging accordingly

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

## Data Sources

Public data comes from [FIO REST API](https://rest.fnar.net/), empire specific data is collected and rendered in the client brwoser only. 

## Getting Started

```bash
npm install
npm run dev        # Dev server at localhost:5173
npm run typecheck  # TypeScript compiler check
npm run build      # Production build → dist/
```

## Acknowledgements

- [FIO](https://rest.fnar.net/) — Community game data API for Prosperous Universe
- [Refined PrUn](https://github.com/refined-prun/refined-prun) — Browser extension that simplifies the Prosperous Universe interface and adds useful features
- [PRUNPlanner](https://prunplanner.org) — Empire and base planning and management tool
- [Taiyi's Map](https://universemap.taiyibureau.de/) — Interactive map with resource search and filter functionality

## License

MIT
