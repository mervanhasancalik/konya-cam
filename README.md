# Konya Cam

Real-time city camera dashboard for Konya, Turkey. View 17 live municipal camera feeds on an interactive dark-themed map with motion detection.

![Konya Cam](https://img.shields.io/badge/status-live-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Interactive Map** — Pan, zoom, and explore Konya with dark monochrome CartoDB tiles
- **17 Live Cameras** — Instant live feeds from parks, squares, historical sites, and stadiums
- **Real Motion Detection** — Analyzes actual camera frames via HLS stream differencing to detect activity levels
- **Heatmap Overlay** — Visualize camera density and coverage across the city
- **Category Filters** — Filter cameras by type: Park & Doga, Tarihi & Kulturel, Meydan & Cadde, Spor
- **Search** — Quickly find cameras by name
- **Responsive Canvas Rendering** — Custom 2D canvas map with retina support, animated markers, and wireframe globe

## Tech Stack

- **React 18** + **Vite 6**
- **HLS.js** — For loading live camera streams and frame-level motion analysis
- **Canvas API** — Custom map rendering, markers, heatmap, and animations
- **CartoDB Dark Tiles** — Monochrome basemap

## Getting Started

```bash
# Clone the repo
git clone https://github.com/yourusername/konya-cam.git
cd konya-cam

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

## Production

### Using Node.js

```bash
npm run build
npm start
```

This starts a production server on `http://localhost:3000` that serves the built app and proxies camera streams. Set a custom port with `PORT=8080 npm start`.

### Standalone Executables

Build self-contained executables for macOS and Windows (no Node.js required):

```bash
npm run package
```

This creates executables in the `release/` folder:

- `konya-cam-macos-arm64` — macOS Apple Silicon
- `konya-cam-macos-x64` — macOS Intel
- `konya-cam-win-x64.exe` — Windows

Run the executable directly — it bundles the app and stream proxy together.

## How It Works

### Map
The map is rendered entirely on a `<canvas>` element using Web Mercator projection. Dark basemap tiles are loaded from CartoDB and drawn as the background layer. Camera markers use different shapes per category (circle, diamond, square, triangle) with animated pulse rings.

### Live Feeds
Each camera feed is embedded via the tvkur.com video player. When a camera is selected, the live stream loads instantly in the detail card.

### Motion Detection
A background process rotates through all 17 cameras, loading each HLS stream into a hidden video element via the stream proxy. It captures frames at 80x45 resolution, compares consecutive frames using per-pixel RGB differencing, and computes a motion score (0–1). The activity panel shows the top 3 most active cameras in real time.

## Data Sources

- **Camera feeds**: [Konya Buyuksehir Belediyesi TV](https://www.konyabuyuksehir.tv) — publicly available municipal camera streams
- **Map tiles**: [CARTO](https://carto.com/attributions) dark basemap
- **Map data**: [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors

## Disclaimer

This project is **unofficial** and not affiliated with Konya Buyuksehir Belediyesi. It uses publicly available camera feeds provided by the municipality for informational purposes. All camera content is owned by Konya Buyuksehir Belediyesi.

## License

MIT
