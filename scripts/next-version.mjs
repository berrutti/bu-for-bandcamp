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
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** @typedef {"major" | "minor" | "patch"} Bump */

/**
 * @param {string[]} labels
 * @returns {Bump}
 */
export const bumpFromLabels = (labels) => {
  if (labels.includes("release:major")) return "major";
  if (labels.includes("release:minor")) return "minor";
  return "patch";
};

/** @param {string} version */
const parse = (version) => version.replace(/^v/, "").split(".").map(Number);

/**
 * @param {{ latestTag?: string, packageVersion: string, bump: Bump }} input
 * @returns {string}
 */
export const nextVersion = ({ latestTag, packageVersion, bump }) => {
  const fromTag = parse(latestTag || "v0.0.0");
  const fromPackage = parse(packageVersion);
  const tagIsNewer = (fromTag[0] - fromPackage[0] || fromTag[1] - fromPackage[1] || fromTag[2] - fromPackage[2]) > 0;
  const [major, minor, patch] = tagIsNewer ? fromTag : fromPackage;
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const tags = execFileSync("git", ["tag", "--list", "v*.*.*", "--sort=-v:refname"], { encoding: "utf8" });
  const { version } = JSON.parse(readFileSync("package.json", "utf8"));
  const labels = (process.env.LABELS ?? "").split(",");
  console.log(nextVersion({ latestTag: tags.split("\n")[0], packageVersion: version, bump: bumpFromLabels(labels) }));
}
