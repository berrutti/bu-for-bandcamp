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
interface ChromeStorageArea {
  get: (defaults: Record<string, unknown>, cb: (items: Record<string, unknown>) => void) => void;
  set: (items: Record<string, unknown>) => void;
}
declare const chrome: { storage: { sync: ChromeStorageArea } };

const DEFAULTS = { showCartButton: true };

const checkbox = document.getElementById("showCartButton") as HTMLInputElement;

chrome.storage.sync.get(DEFAULTS, (items) => {
  checkbox.checked = Boolean(items.showCartButton);
});

checkbox.addEventListener("change", () => {
  chrome.storage.sync.set({ showCartButton: checkbox.checked });
});

export {};
