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
// Details are JSON strings because Firefox hides objects created in one world
// (isolated content script vs. page) from the other; strings pass through.
export const ADD_TO_CART_EVENT = "bu-add-to-cart";
export const ADD_TO_CART_RESULT_EVENT = "bu-add-to-cart-result";

interface AddToCartRequest<T> {
  requestId: number;
  item: T;
}

interface AddToCartResult {
  requestId: number;
  ok: boolean;
}

const parseDetail = <T>(event: Event): T | null => {
  const { detail } = event as CustomEvent<unknown>;
  if (typeof detail !== "string") return null;
  try {
    return JSON.parse(detail) as T;
  } catch {
    return null;
  }
};

const dispatch = (target: EventTarget, type: string, payload: object): void => {
  target.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(payload) }));
};

let nextRequestId = 0;

export const requestAddToCart = <T extends object>(
  target: EventTarget,
  item: T,
  timeoutMs = 3000
): Promise<boolean> =>
  new Promise((resolve) => {
    const requestId = ++nextRequestId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (ok: boolean): void => {
      clearTimeout(timer);
      target.removeEventListener(ADD_TO_CART_RESULT_EVENT, onResult);
      resolve(ok);
    };
    const onResult = (event: Event): void => {
      const result = parseDetail<AddToCartResult>(event);
      if (result?.requestId === requestId) finish(result.ok);
    };
    target.addEventListener(ADD_TO_CART_RESULT_EVENT, onResult);
    // The bridge replies from inside dispatch; this only fires if it never loaded.
    timer = setTimeout(() => finish(false), timeoutMs);
    dispatch(target, ADD_TO_CART_EVENT, { requestId, item } satisfies AddToCartRequest<T>);
  });

export const serveAddToCart = <T>(target: EventTarget, addToCart: (item: T) => void): void => {
  target.addEventListener(ADD_TO_CART_EVENT, (event) => {
    const request = parseDetail<AddToCartRequest<T>>(event);
    if (!request) return;
    let ok = true;
    try {
      addToCart(request.item);
    } catch (err) {
      ok = false;
      console.error("[BU for Bandcamp] adding to cart failed:", err);
    }
    dispatch(target, ADD_TO_CART_RESULT_EVENT, { requestId: request.requestId, ok } satisfies AddToCartResult);
  });
};
