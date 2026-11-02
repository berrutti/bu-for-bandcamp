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
import { toCartItem } from "./bandcamp";
import { requestAddToCart } from "./cart-events";
import type { TrackData } from "./tracks";

const ICON_PATHS = {
  cart: "M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z",
  check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  error:
    "M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z",
};

type IconName = keyof typeof ICON_PATHS;

// Inline SVG, not emoji: content scripts often lack a color-emoji font and render emoji invisible.
const createIcon = (name: IconName): SVGSVGElement => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "currentColor");
  svg.style.display = "block";
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", ICON_PATHS[name]);
  svg.appendChild(path);
  return svg;
};

export interface Colors {
  background: string;
  color: string;
}

export const getEffectiveColors = (start: Element): Colors => {
  const isTransparent = (value: string): boolean =>
    value === "transparent" || value === "rgba(0, 0, 0, 0)";

  let el: Element | null = start;
  let background = "rgb(0, 0, 0)";
  while (el) {
    const bg = getComputedStyle(el).backgroundColor;
    if (!isTransparent(bg)) {
      background = bg;
      break;
    }
    el = el.parentElement;
  }

  return { background, color: getComputedStyle(start).color };
};

export const borderColorFor = ({ background, color }: Colors): string =>
  `color-mix(in srgb, ${color} 35%, ${background})`;

export const createPriceInput = (colors: Colors): HTMLInputElement => {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "0.01";
  input.required = true;
  input.placeholder = "…";
  // Firefox keeps the number spinners unless the appearance is textfield; Chrome ignores the -moz- line.
  input.style.cssText = `
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: textfield;
    width: 48px;
    font-family: inherit;
    font-size: 0.85em;
    color: ${colors.color};
    background-color: ${colors.background};
    border: 1px solid ${borderColorFor(colors)};
    border-radius: 2px;
    padding: 1px 4px;
  `;
  return input;
};

export const applyMinimumPrice = (
  input: Pick<HTMLInputElement, "min" | "value">,
  track: TrackData
): void => {
  if (track.minimum_price == null) return;
  input.min = String(track.minimum_price);
  if (input.value === "") input.value = String(track.minimum_price);
};

export const createIconButton = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    min-height: 30px;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
  `;
  return button;
};

const CART_STATES = {
  idle: { icon: "cart", title: "Add to cart" },
  added: { icon: "check", title: "Added to cart" },
  error: { icon: "error", title: "Couldn't add to cart" },
} satisfies Record<string, { icon: IconName; title: string }>;

export const setCartState = (button: HTMLButtonElement, state: keyof typeof CART_STATES): void => {
  button.replaceChildren(createIcon(CART_STATES[state].icon));
  button.title = CART_STATES[state].title;
};

export const attachAddToCart = (
  button: HTMLButtonElement,
  input: HTMLInputElement,
  loadTrack: () => Promise<TrackData | null>
): void => {
  setCartState(button, "idle");
  let pending = false;
  button.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (pending) return;
    pending = true;
    try {
      const track = await loadTrack();
      if (!track) {
        setCartState(button, "error");
        return;
      }
      applyMinimumPrice(input, track);
      if (!input.reportValidity()) return;
      const added = await requestAddToCart(document, toCartItem(track, input.valueAsNumber));
      setCartState(button, added ? "added" : "error");
    } finally {
      pending = false;
    }
  });
};
