# BU for Bandcamp
Enhance your Bandcamp experience. BU stands for BU Utilities.

![Screenshot](images/screenshot.png)

## Features
- Player stays pinned at the bottom, so it never scrolls out of view.
- Click anywhere on the bar to jump to that point in the track.
- Songs play one after another without scrolling back to the top.
- Previous and next buttons to move between tracks.
- Buy a track in one click: a price field and an "add to cart" button. You can set the price with no page navigation.

## Install

**From a release:**
1. Download `chrome.zip` (Chrome/Edge/Brave) or `firefox.zip` from the [latest release](../../releases/latest) and unzip it.
2. Chrome/Edge: open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, select the folder.
3. Firefox: open `about:debugging` → **This Firefox** → **Load Temporary Add-on**, pick `manifest.json` in the unzipped folder.

**From source:** `yarn install && yarn build`, then load `dist/chrome` unpacked.

## Build

- `yarn build` — builds `dist/chrome` and `dist/firefox`.
- `yarn package` — adds `dist/chrome.zip` / `dist/firefox.zip` for store upload.
- `yarn typecheck` — type-check only.
- `yarn test` - runs the unit tests in `tests/`.
- `yarn lint` - lints `dist/firefox` with web-ext (run `yarn build` first).
- `yarn icons` - renders the PNG icons and store images from `static/icons/*.svg`.

Sources are in `src/` (`content.ts` isolated world, `bridge.ts` main world for the cart, `options.ts` settings). The shared manifest is `manifest.base.json`; per-browser fields are added by `build.mjs`.

## Release

Label a PR `release:patch` / `release:minor` / `release:major` and merge it. `auto-release.yml` bumps the version and pushes a tag; `release.yml` builds the zips and publishes to the Chrome, Firefox, and Edge stores. Needs `RELEASE_PAT` and `SUBMIT_KEYS` repo secrets.

## License

BU for Bandcamp - Enhance your experience.  
Copyright (C) 2026 Matias Berrutti

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See the [LICENSE](LICENSE) file for the full terms.
