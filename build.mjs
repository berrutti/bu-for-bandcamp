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
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";

const ALL_TARGETS = ["chrome", "firefox"];
const GECKO_ID = "bu-for-bandcamp@berrutti.github.io";
// AMO requires a data collection declaration, which Firefox supports from 142 on
// Android (140 on desktop). That also covers `world: "MAIN"` (128+) for bridge.ts.
const GECKO_MIN_VERSION = "142.0";
// Content-script `world: "MAIN"` (bridge.ts) needs Chrome 111; Edge follows Chrome's versions.
const CHROME_MIN_VERSION = "111";

const args = process.argv.slice(2);
const zip = args.includes("--zip");
const targets = args.filter((a) => !a.startsWith("-"));
const browsers = targets.length ? targets : ALL_TARGETS;

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const base = JSON.parse(await readFile("manifest.base.json", "utf8"));
const iconSizes = (await readdir("static/icons"))
  .map((file) => file.match(/^icon-(\d+)\.png$/)?.[1])
  .filter(Boolean)
  .map(Number)
  .sort((a, b) => a - b);

const manifestFor = (browser) => {
  const manifest = { ...base, version: pkg.version };
  manifest.icons = Object.fromEntries(iconSizes.map((size) => [size, `icons/icon-${size}.png`]));
  if (browser === "chrome") manifest.minimum_chrome_version = CHROME_MIN_VERSION;
  if (browser === "firefox") {
    manifest.browser_specific_settings = {
      gecko: {
        id: GECKO_ID,
        strict_min_version: GECKO_MIN_VERSION,
        data_collection_permissions: { required: ["none"] },
      },
    };
  }
  return manifest;
};

for (const browser of browsers) {
  const outdir = `dist/${browser}`;
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  await build({
    entryPoints: ["src/content.ts", "src/bridge.ts", "src/options.ts"],
    bundle: true,
    outdir,
    platform: "browser",
    target: "es2020",
    format: "iife",
    legalComments: "none",
  });

  await cp("static", outdir, { recursive: true });
  await writeFile(`${outdir}/manifest.json`, `${JSON.stringify(manifestFor(browser), null, 2)}\n`);

  if (zip) {
    await rm(`dist/${browser}.zip`, { force: true });
    execSync(`cd ${outdir} && zip -r -q ../${browser}.zip .`);
  }

  console.log(`built dist/${browser}${zip ? ` (+ dist/${browser}.zip)` : ""}`);
}
