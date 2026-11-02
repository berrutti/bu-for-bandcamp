import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyMinimumPrice } from "../src/cart-ui";
import type { TrackData } from "../src/tracks";

const track = (overrides: Partial<TrackData> = {}): TrackData => ({
  minimum_price: 1,
  item_id: 1,
  band_id: 2,
  item_title: "Night",
  currency: "USD",
  ...overrides,
});

describe("applyMinimumPrice", () => {
  it("fills an empty price with the minimum", () => {
    const input = { min: "0", value: "" };
    applyMinimumPrice(input, track({ minimum_price: 1.5 }));
    assert.deepEqual(input, { min: "1.5", value: "1.5" });
  });

  it("never overwrites a price the user already typed", () => {
    const input = { min: "0", value: "5" };
    applyMinimumPrice(input, track({ minimum_price: 1 }));
    assert.deepEqual(input, { min: "1", value: "5" });
  });

  it("leaves the input alone when the track has no minimum", () => {
    const input = { min: "0", value: "" };
    applyMinimumPrice(input, track({ minimum_price: null }));
    assert.deepEqual(input, { min: "0", value: "" });
  });
});
