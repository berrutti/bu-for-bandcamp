import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cachedQuery } from "../src/dom";

const fakeRoot = (elements: { isConnected: boolean }[]) => {
  let calls = 0;
  const root = { querySelector: () => elements[calls++] ?? null };
  return { root: root as unknown as ParentNode, calls: () => calls };
};

describe("cachedQuery", () => {
  it("reuses the element while it's connected", () => {
    const el = { isConnected: true };
    const { root, calls } = fakeRoot([el]);
    const get = cachedQuery(root, ".title_link");
    assert.equal(get(), el);
    assert.equal(get(), el);
    assert.equal(calls(), 1);
  });

  it("queries again once the element has been detached", () => {
    const first = { isConnected: true };
    const second = { isConnected: true };
    const { root, calls } = fakeRoot([first, second]);
    const get = cachedQuery(root, ".title_link");
    assert.equal(get(), first);
    first.isConnected = false;
    assert.equal(get(), second);
    assert.equal(calls(), 2);
  });

  it("keeps looking while nothing matches", () => {
    const { root, calls } = fakeRoot([]);
    const get = cachedQuery(root, ".title_link");
    assert.equal(get(), null);
    assert.equal(get(), null);
    assert.equal(calls(), 2);
  });
});
