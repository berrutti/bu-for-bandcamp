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
// Runs in the page's main world, the only place Bandcamp's cart is reachable.
// It must be the `Sidecart` instance: `Cart` is the class and throws on `this.cart_items`.
import { serveAddToCart } from "./cart-events";

interface BandcampCart {
  add_to_cart: (item: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    Sidecart?: BandcampCart;
  }
}

serveAddToCart(document, (item) => {
  if (!window.Sidecart) throw new Error("window.Sidecart is not available");
  window.Sidecart.add_to_cart(item);
});
