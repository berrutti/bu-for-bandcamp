import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADD_TO_CART_EVENT,
  ADD_TO_CART_RESULT_EVENT,
  requestAddToCart,
  serveAddToCart,
} from "../src/cart-events";

const ITEM = { item_id: 1, item_type: "t", unit_price: 1.5 };

describe("cart events", () => {
  it("sends details as JSON strings so they can cross between worlds in Firefox", async () => {
    const target = new EventTarget();
    const detailTypes: string[] = [];
    for (const type of [ADD_TO_CART_EVENT, ADD_TO_CART_RESULT_EVENT]) {
      target.addEventListener(type, (event) => {
        detailTypes.push(typeof (event as CustomEvent<unknown>).detail);
      });
    }
    serveAddToCart(target, () => {});
    await requestAddToCart(target, ITEM);
    assert.deepEqual(detailTypes, ["string", "string"]);
  });

  it("forwards the item and resolves true when the cart accepts it", async () => {
    const target = new EventTarget();
    const received: unknown[] = [];
    serveAddToCart(target, (item) => received.push(item));
    assert.equal(await requestAddToCart(target, ITEM), true);
    assert.deepEqual(received, [ITEM]);
  });

  it("resolves false when the cart throws", async (t) => {
    t.mock.method(console, "error", () => {});
    const target = new EventTarget();
    serveAddToCart(target, () => {
      throw new Error("window.Sidecart is not available");
    });
    assert.equal(await requestAddToCart(target, ITEM), false);
  });

  it("resolves false when no bridge is listening", async () => {
    assert.equal(await requestAddToCart(new EventTarget(), ITEM, 10), false);
  });

  it("ignores results for other requests", async () => {
    const target = new EventTarget();
    target.addEventListener(ADD_TO_CART_EVENT, () => {
      target.dispatchEvent(
        new CustomEvent(ADD_TO_CART_RESULT_EVENT, {
          detail: JSON.stringify({ requestId: -1, ok: true }),
        })
      );
    });
    assert.equal(await requestAddToCart(target, ITEM, 10), false);
  });
});
