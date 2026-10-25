# Touchline Lab

Touchline Lab is a personal-first eFootball card research and build-planning app. It lives in its own folder so it does not modify REA or REA's documentation site.

## Run locally

Install Node.js 22 or newer, open a terminal in this folder, and run:

```sh
node serve.mjs
```

Open `http://127.0.0.1:4173`. The server binds to this computer only. It does not publish the app to the internet. No dependency installation is needed. To run the built-in checks, run `node --test test/domain.test.mjs`.

## What works

- A local card library that can search player names, positions, card types, versions, game versions, and sources.
- Separate player identities and card records, so one player can keep multiple card versions.
- CSV / JSON import with a preview, per-row validation errors, add/update counts, and confirmation before saving.
- Data export as JSON, manual card entry, and local browser storage for cards and saved target plans.
- Card comparison, per-card source/version/date/confidence labels, and research-derived target guidance.
- A modular data-source registry. Local file import is enabled; external retrieval is explicitly disabled unless a permitted provider is added.
- Responsive layout and no external font, image, or analytics requests.

## Import data

JSON accepts a card array or an object with a `cards` array. The older `{ "players": [...] }` format is also accepted. Each record can provide `cardId`, `playerId`, `name`, `cardType`, `cardVersion`, `gameVersion`, `position` / `positions`, `playStyle`, `team`, `rating`, `stats`, `baseStats`, `trainedStats`, `skills`, `boosters`, and a `source` object (`name`, `url`, `capturedAt`, `confidence`, `verification`). Missing fields remain unknown.

CSV uses the same field names, with `name` and at least one supported stat required. Example:

```csv
name,position,cardType,cardVersion,gameVersion,sourceName,capturedAt,speed,acceleration,ballControl
Declan Rice,CMF,Unknown,Snapshot 2026-10-23,eFootball 2027,User research,2026-10-23,90,90,90
```

If a `cardId` is supplied, it identifies that card version. Otherwise, the app derives an identity from player, position, card type, card version, and game version. A repeated identity updates the current record and appends the prior stats/source to its revision history. Different versions remain separate. Invalid rows are shown before import and skipped only after the user confirms the valid rows.

Stats are input values with an app validation range of 0–130; this range is an input check, not a claim about a game rule. A provided rating is stored as supplied and is never calculated by Touchline Lab.

## Build guidance and source limits

The supplied research says eFootball 2027 and was captured October 24–25, 2026. It is community research, not an official Konami rules database, and is not independently verified here. The Declan Rice card is one attributed example, not a complete player database.

The current planner ranks role-relevant targets and explains gaps. It does not calculate point allocations, progression costs, OVR, or claim to find an exact or optimal build. Konami's public overview describes its in-game Auto Development as allocating progression points to maximize OVR, but the source does not provide the complete calculation formulas needed to independently reproduce that behavior. See [Konami's player-development overview](https://www.konami.com/efootball/en/page/overview).

No documented, permitted eFootBase API/feed has been confirmed. The [terms linked from eFootBase](https://wildpluto.com/terms-of-service) restrict automated access, so this app does not scrape or make automated requests to eFootBase. Add an external adapter only after its documented access method and permissions are confirmed. Until then, use datasets you are permitted to import.

All imported cards and saved plans stay in this browser. They are not uploaded. Use Export to back them up before clearing browser data. The supplied sample card and research remain available after clearing local imports.

## Attribution

The supplied research notes attribute their claims to [eFootBase](https://efootbase.com/) and community research. Touchline Lab is an independent project and is not affiliated with Konami or eFootBase. Their marks and game materials remain with their respective owners.

