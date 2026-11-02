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
import { loadSettings, saveSetting, SETTINGS_DEFAULTS, type Settings } from "./settings";

const keys = Object.keys(SETTINGS_DEFAULTS) as (keyof Settings)[];

void loadSettings().then((settings) => {
  for (const key of keys) {
    const checkbox = document.getElementById(key);
    if (!(checkbox instanceof HTMLInputElement)) continue;
    checkbox.checked = settings[key];
    checkbox.addEventListener("change", () => saveSetting(key, checkbox.checked));
  }
});
