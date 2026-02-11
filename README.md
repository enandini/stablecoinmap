# US Stablecoin Regulation Map

Single-page React app that visualizes US state-level stablecoin and crypto regulatory posture on an interactive map.

## Stack

- React + Vite
- Tailwind CSS
- react-simple-maps

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Data

State-level entries live in:

- `src/data/stablecoinRegulation.json`
- Includes:
  - `federalContext`
  - `states` map keyed by state abbreviation (e.g. `NY`, `CA`)

State mappings used for map interaction live in:

- `src/data/stateMappings.js`

States missing from the JSON file default to:

- `status: "none"`
- generic summary + no state-specific framework note

## Deploy on Vercel

The app is Vercel-ready with SPA rewrites configured in `vercel.json`.
