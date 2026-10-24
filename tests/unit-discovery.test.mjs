import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { discoverUnitTests } from "../scripts/test-unit.mjs";

test("new nested unit tests are discovered without registering a file list, while integration/helpers remain excluded", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wuff-unit-discovery-"));
  try {
    const files = [
      "new-feature.test.ts",
      "nested/new-policy.test.mjs",
      "nested/ui.test.tsx",
      "real.integration.test.ts",
      "nested/api.integration.test.mjs",
      "helpers/fixture.ts",
      "test_native_release.py",
      ".hidden/hidden.test.ts",
      "node_modules/vendor.test.js",
    ];
    for (const file of files) {
      const path = join(directory, file);
      await mkdir(join(path, ".."), { recursive: true });
      await writeFile(path, "");
    }
    assert.deepEqual(
      (await discoverUnitTests(directory)).map((path) =>
        relative(directory, path),
      ),
      [
        "nested/new-policy.test.mjs",
        "nested/ui.test.tsx",
        "new-feature.test.ts",
      ],
    );
    await writeFile(join(directory, "later.test.js"), "");
    assert.equal((await discoverUnitTests(directory)).length, 4);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
