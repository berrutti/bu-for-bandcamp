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
import { getTrackData, isTralbumPage, SELECTORS } from "./bandcamp";
import {
  applyMinimumPrice,
  attachAddToCart,
  borderColorFor,
  createPriceInput,
  getEffectiveColors,
} from "./cart-ui";
import { toTrackPath, type TrackData } from "./tracks";

const createRowCartControl = (cell: Element, path: string): HTMLElement => {
  const colors = getEffectiveColors(cell);

  const wrapper = document.createElement("span");
  wrapper.style.cssText = `display:inline-flex; align-items:center; gap:4px; font-family:inherit; color:${colors.color};`;

  const priceInput = createPriceInput(colors);

  const cartBtn = document.createElement("button");
  cartBtn.style.cssText = `
    display: inline-flex;
    align-items: center;
    background-color: ${colors.background};
    border: 1px solid ${borderColorFor(colors)};
    border-radius: 2px;
    cursor: pointer;
    color: ${colors.color};
    padding: 2px 4px;
    line-height: 1;
  `;

  const loadTrack = (): Promise<TrackData | null> => getTrackData(path);
  attachAddToCart(cartBtn, priceInput, loadTrack);

  // Fetched on first hover or focus, so an album page doesn't download every track page up front.
  const prefetch = (): void => {
    void loadTrack().then((data) => {
      if (data) applyMinimumPrice(priceInput, data);
    });
  };
  wrapper.addEventListener("pointerenter", prefetch, { once: true });
  wrapper.addEventListener("focusin", prefetch, { once: true });

  wrapper.append(priceInput, cartBtn);
  return wrapper;
};

interface BuyLinkRow {
  cell: Element;
  path: string;
  original: ChildNode[];
  control: HTMLElement | null;
}

export const setupBuyLinks = (): ((enabled: boolean) => void) | null => {
  if (!isTralbumPage()) return null;

  const rows: BuyLinkRow[] = [];
  document.querySelectorAll(SELECTORS.trackBuyLink).forEach((cell) => {
    const path = toTrackPath(cell.querySelector("a")?.getAttribute("href"), location.href);
    if (path) rows.push({ cell, path, original: Array.from(cell.childNodes), control: null });
  });
  if (!rows.length) return null;

  return (enabled) => {
    for (const row of rows) {
      if (!enabled) {
        // The original nodes, not copies, so Bandcamp's handlers on them survive.
        row.cell.replaceChildren(...row.original);
        continue;
      }
      if (!row.control) row.control = createRowCartControl(row.cell, row.path);
      row.cell.replaceChildren(row.control);
    }
  };
};
