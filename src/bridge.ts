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
// Runs in the page's main world (see manifest content_scripts "world": "MAIN")
// so it can reach Bandcamp's own cart controller, which our isolated content
// script cannot. It listens for the CustomEvent dispatched by content.ts and
// forwards the add through the live cart instance's add_to_cart, the same call
// Bandcamp's native buy buttons make, so the cart model, sidecart rendering,
// and show/hide animation all stay in sync.
//
// `Sidecart` is the initialized cart instance (it holds cart_items/sync_num/…);
// `Cart` is the class/prototype and has no instance state, so calling
// add_to_cart on it throws on `this.cart_items.length`.
//
// content.ts builds the full item object (matching the shape Bandcamp's own buy
// button passes), so we forward it verbatim.

interface BandcampCart {
  add_to_cart: (item: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    Sidecart?: BandcampCart;
  }
}

document.addEventListener("bcutils-add-to-cart", (event) => {
  const detail = (event as CustomEvent<string>).detail;
  try {
    const item = JSON.parse(detail) as Record<string, unknown>;
    if (!window.Sidecart) {
      console.error("[bandcamp-utils] window.Sidecart is not available");
      return;
    }
    window.Sidecart.add_to_cart(item);
  } catch (err) {
    console.error("[bandcamp-utils] bridge add_to_cart failed:", err);
  }
});

export {};
