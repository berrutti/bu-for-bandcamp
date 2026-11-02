import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTrackDataCache, toTrackPath, type TrackData } from "../src/tracks";

const ALBUM_PAGE = "https://artist.bandcamp.com/album/some-album";
const TRACK_PAGE = "https://artist.bandcamp.com/track/some-track";

const track = (overrides: Partial<TrackData> = {}): TrackData => ({
  minimum_price: 1,
  item_id: 1,
  band_id: 2,
  item_title: "Night",
  currency: "USD",
  ...overrides,
});

describe("toTrackPath", () => {
  it("rejects the player's initial '#' link on an album page, which would resolve to the album", () => {
    assert.equal(toTrackPath("#", ALBUM_PAGE), null);
  });

  it("resolves '#' on a track page to that track", () => {
    assert.equal(toTrackPath("#", TRACK_PAGE), "/track/some-track");
  });

  it("drops the query from a tracklist buy link", () => {
    assert.equal(toTrackPath("/track/night?action=download", ALBUM_PAGE), "/track/night");
  });

  it("accepts an absolute link on the same origin", () => {
    assert.equal(toTrackPath("https://artist.bandcamp.com/track/night", ALBUM_PAGE), "/track/night");
  });

  it("rejects other origins, which the page's CORS rules would block", () => {
    assert.equal(toTrackPath("https://other.bandcamp.com/track/night", ALBUM_PAGE), null);
  });

  it("rejects pages that aren't tracks", () => {
    assert.equal(toTrackPath("/album/another-album", ALBUM_PAGE), null);
  });

  it("rejects a missing href", () => {
    assert.equal(toTrackPath(null, ALBUM_PAGE), null);
    assert.equal(toTrackPath(undefined, ALBUM_PAGE), null);
    assert.equal(toTrackPath("", ALBUM_PAGE), null);
  });
});

describe("createTrackDataCache", () => {
  it("shares one request between the tracklist and the bottom bar", async () => {
    let calls = 0;
    const get = createTrackDataCache(async () => {
      calls++;
      return track();
    });
    const [a, b] = await Promise.all([get("/track/night"), get("/track/night")]);
    await get("/track/night");
    assert.equal(calls, 1);
    assert.equal(a, b);
  });

  it("retries a failed lookup instead of caching the failure", async () => {
    let calls = 0;
    const get = createTrackDataCache(async () => (++calls === 1 ? null : track()));
    assert.equal(await get("/track/night"), null);
    assert.deepEqual(await get("/track/night"), track());
    assert.equal(calls, 2);
  });

  it("keeps tracks separate", async () => {
    const get = createTrackDataCache(async (path) => track({ item_title: path }));
    assert.equal((await get("/track/a"))?.item_title, "/track/a");
    assert.equal((await get("/track/b"))?.item_title, "/track/b");
  });
});
