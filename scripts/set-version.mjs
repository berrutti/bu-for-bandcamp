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
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * @param {string} tag
 * @returns {string}
 */
export const versionFromTag = (tag) => {
  const version = tag.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Not a release tag: "${tag}"`);
  return version;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  pkg.version = versionFromTag(process.argv[2] ?? process.env.GITHUB_REF_NAME ?? "");
  writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`package.json version set to ${pkg.version}`);
}
