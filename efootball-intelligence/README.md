# Touchline Lab

Touchline Lab is a small, independent eFootball player-analysis workspace. It is added as a separate folder so it does not change REA or the existing `website/` project.

## Run it

Serve this folder with any static HTTP server, then open its local address. For example, from this directory:

```sh
python -m http.server 8000
```

Open `http://localhost:8000`. The app uses plain HTML, CSS, and JavaScript and has no install step or external runtime dependency. Google Fonts are optional; the page uses system fallbacks if they are unavailable.

## Included features

- Overview of the sample Declan Rice card and researched attribute targets.
- Role-aware build guidance that shows the gap to a research target. It does not calculate progression-point costs or OVR.
- Card comparisons for the stats entered in this browser.
- Manual player entry and JSON / CSV player import.
- Research notes with source and confidence labels.
- Local browser storage for manually entered and imported player cards.

## Import format

JSON can be either a player array or an object with a `players` array. Each player can contain an `id`, `name`, `position`, `role`, `rating`, `skills`, and a `stats` object. Supported stat keys are listed in `app.js` (`ballControl`, `dribbling`, `tightPossession`, `speed`, `acceleration`, `physicalContact`, `balance`, `stamina`, and others). Values must be whole numbers from 1 to 130. The optional rating must be 1–110. Players without a supplied stat remain incomplete instead of receiving invented values.

CSV headers use the same camelCase keys, with `name` required. For example:

```csv
name,position,role,rating,ballControl,dribbling,tightPossession,speed,acceleration,physicalContact,balance,stamina
Declan Rice,CMF,Box-to-Box,105,90,90,90,90,90,82,82,93
```

Imports update matching cards and are saved in local storage. They do not modify the repository or send data to a server.

## Research and limitations

`data/research.json` holds the structured thresholds, the supplied sample player, role priorities, and selected skill notes. Its provenance is retained in the data. The claims came from user-provided eFootBase/community notes captured October 24–25, 2026; they are not official Konami rules and have not been independently verified here.

The notes do not include a verified progression-point cost formula. Build Lab therefore ranks thresholds and explains current gaps; it does not invent point allocations, card OVR, chemistry, live player feeds, or a claim of optimality. Live eFootBase access, scraping, accounts, cloud sync, and OCR are not implemented.

## Attribution

The supplied research is attributed to [eFootBase](https://efootbase.com/) and community research, with the capture window recorded in `data/research.json`. Touchline Lab is an independent community project and is not affiliated with Konami or eFootBase. Their names, marks, and game materials remain with their respective owners.

