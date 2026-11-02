import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bumpFromLabels, nextVersion } from "../scripts/next-version.mjs";
import { versionFromTag } from "../scripts/set-version.mjs";

describe("bumpFromLabels", () => {
  it("picks the biggest bump among the release labels", () => {
    assert.equal(bumpFromLabels(["release:patch", "release:major"]), "major");
    assert.equal(bumpFromLabels(["release:minor", "release:patch"]), "minor");
    assert.equal(bumpFromLabels(["release:patch"]), "patch");
  });

  it("ignores labels that only contain a release name", () => {
    assert.equal(bumpFromLabels(["not-release:major"]), "patch");
  });
});

describe("nextVersion", () => {
  it("bumps the latest tag", () => {
    assert.equal(nextVersion({ latestTag: "v1.0.4", packageVersion: "1.0.3", bump: "patch" }), "1.0.5");
    assert.equal(nextVersion({ latestTag: "v1.0.4", packageVersion: "1.0.3", bump: "minor" }), "1.1.0");
    assert.equal(nextVersion({ latestTag: "v1.0.4", packageVersion: "1.0.3", bump: "major" }), "2.0.0");
  });

  it("compares version numbers, not text", () => {
    assert.equal(nextVersion({ latestTag: "v1.2.9", packageVersion: "1.0.0", bump: "patch" }), "1.2.10");
    assert.equal(nextVersion({ latestTag: "v1.10.0", packageVersion: "1.9.0", bump: "patch" }), "1.10.1");
  });

  it("falls back to package.json when there are no tags", () => {
    assert.equal(nextVersion({ latestTag: "", packageVersion: "1.0.3", bump: "patch" }), "1.0.4");
  });

  it("uses package.json when it's ahead of the tags", () => {
    assert.equal(nextVersion({ latestTag: "v0.9.0", packageVersion: "1.0.3", bump: "patch" }), "1.0.4");
  });
});

describe("versionFromTag", () => {
  it("drops the v from a release tag", () => {
    assert.equal(versionFromTag("v1.0.5"), "1.0.5");
  });

  it("rejects anything a browser manifest wouldn't accept as a version", () => {
    for (const tag of ["", "main", "v1.0", "v1.0.0-beta", "1.0.0.0"]) {
      assert.throws(() => versionFromTag(tag), /Not a release tag/);
    }
  });
});
