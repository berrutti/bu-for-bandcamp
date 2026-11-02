/*
 * BU for Bandcamp - Enhance your experience.
 * Copyright (C) 2026 Matias Berrutti
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { Resvg } from "@resvg/resvg-js";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const ICONS = "static/icons";

const render = (svg, size) =>
  new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();

// The full icon's progress-bar thumb turns to mush below 48px.
const small = await readFile(`${ICONS}/icon-small.svg`, "utf8");
const full = await readFile(`${ICONS}/icon.svg`, "utf8");

for (const size of [16, 32]) await writeFile(`${ICONS}/icon-${size}.png`, render(small, size));
for (const size of [48, 96, 128]) await writeFile(`${ICONS}/icon-${size}.png`, render(full, size));

// Chrome Web Store asks for 96px artwork centered in a transparent 128px canvas.
const inner = full.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const padded = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><svg x="16" y="16" width="96" height="96" viewBox="0 0 128 128">${inner}</svg></svg>`;

await mkdir("store", { recursive: true });
await mkdir("docs", { recursive: true });
await writeFile("store/chrome-icon-128.png", render(padded, 128));
await writeFile("store/edge-logo-300.png", render(full, 300));
await copyFile(`${ICONS}/icon.svg`, "docs/icon.svg");

console.log("icons written to static/icons, store/ and docs/");
