import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { loadSettings, SETTINGS_DEFAULTS, toSettings } from "../src/settings";

const globals = globalThis as { browser?: unknown };

describe("toSettings", () => {
  it("uses the defaults for keys that were never stored", () => {
    assert.deepEqual(toSettings({}), SETTINGS_DEFAULTS);
  });

  it("keeps stored booleans", () => {
    assert.deepEqual(toSettings({ showCartButton: false, showTrackCartButtons: false }), {
      showCartButton: false,
      showTrackCartButtons: false,
    });
  });

  it("falls back per key when a stored value isn't a boolean", () => {
    assert.deepEqual(toSettings({ showCartButton: "no", showTrackCartButtons: false }), {
      showCartButton: SETTINGS_DEFAULTS.showCartButton,
      showTrackCartButtons: false,
    });
  });
});

describe("loadSettings", () => {
  afterEach(() => {
    delete globals.browser;
  });

  it("resolves with the defaults when there is no extension API", async () => {
    assert.deepEqual(await loadSettings(), SETTINGS_DEFAULTS);
  });

  it("resolves with the defaults when the storage read fails", async () => {
    globals.browser = {
      storage: { sync: { get: () => Promise.reject(new Error("storage unavailable")) } },
    };
    assert.deepEqual(await loadSettings(), SETTINGS_DEFAULTS);
  });

  it("prefers Firefox's promise-based browser namespace", async () => {
    globals.browser = {
      storage: { sync: { get: async () => ({ showCartButton: false }) } },
    };
    assert.equal((await loadSettings()).showCartButton, false);
  });
});
