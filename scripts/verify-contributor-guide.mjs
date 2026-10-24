import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const origin = "http://localhost:3000";
for (const file of [
  "contributor-workflow.md",
  "contributor-pr-template.md",
  "SKILL.md",
  "feature-brief.md",
  "components.json",
  "wuff-contributor-skill.zip",
]) {
  const response = await fetch(`${origin}/contributor-kit/${file}`);
  assert.equal(response.status, 200, file);
  assert.ok((await response.arrayBuffer()).byteLength > 100, file);
}
const reference = await (await fetch(`${origin}/docs/agent-context.md`)).text();
assert.ok(reference.includes("/wuff-scope"));
assert.ok(reference.includes("Evidence commit:"));
assert.ok(reference.includes("implementation reference"));
assert.ok(
  reference.includes("API, MCP and connections are core product surfaces"),
);
assert.ok(!reference.includes("wuff-prototype.zip"));
const manifest = await (
  await fetch(`${origin}/contributor-kit/source-manifest.json`)
).json();
for (const [file, hash] of Object.entries(manifest.files)) {
  const bytes = Buffer.from(
    await (await fetch(`${origin}/contributor-kit/${file}`)).arrayBuffer(),
  );
  assert.equal(createHash("sha256").update(bytes).digest("hex"), hash, file);
}
for (const file of [
  "wuff-prototype.zip",
  "wuff-prototype-skill.zip",
  "SKILL.md",
]) {
  const retired = await fetch(`${origin}/prototype-kit/${file}`);
  assert.equal(retired.status, 410);
  assert.match(await retired.text(), /retired/);
}
for (const [old, current] of [
  ["prototyping", "build"],
  ["handoff", "review"],
]) {
  const redirect = await fetch(`${origin}/docs/${old}`, { redirect: "manual" });
  assert.equal(redirect.status, 308);
  assert.equal(
    new URL(redirect.headers.get("location"), origin).pathname,
    `/docs/${current}`,
  );
}
const browser = await chromium.launch({ headless: true, channel: "chrome" });
await mkdir("docs/screenshots", { recursive: true });
const errors = [],
  writes = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/\/api\/(v1|mcp|mobile)/.test(request.url()))
      writes.push(request.url());
  });
  await page.addInitScript(() => {
    window.__copied = "";
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (value) => {
          window.__copied = value;
        },
      },
    });
  });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    const response = await page.goto(`${origin}/docs/build`);
    assert.equal(response.status(), 200);
    await page
      .getByRole("heading", { name: "Build a feature", exact: true })
      .waitFor();
    assert.equal(await page.locator("h1").count(), 1);
    await page
      .getByRole("link", { name: "Download contributor skill", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Copy starter prompt", exact: true })
      .click();
    assert.match(
      await page.evaluate(() => window.__copied),
      /request Tim's scope approval/,
    );
    assert.match(await page.getByRole("status").innerText(), /copied/);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Overflow at ${width}px`,
    );
    if (width < 1000) {
      await page
        .getByRole("combobox", { name: /Guide page/ })
        .selectOption("/docs/review");
      await page.waitForURL("**/docs/review");
      await page
        .getByRole("combobox", { name: /Guide page/ })
        .selectOption("/docs/build");
      await page.waitForURL("**/docs/build");
    }
    const copy = page.getByRole("button", {
      name: "Copy starter prompt",
      exact: true,
    });
    await copy.focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("status")
      .filter({ hasText: "Starter prompt copied." })
      .waitFor();
    await page.screenshot({
      path: `docs/screenshots/contributor-guide-${width}.png`,
      fullPage: false,
    });
  }
  await page.goto(`${origin}/docs/review`);
  await page
    .getByRole("link", { name: "Download contributor skill", exact: true })
    .waitFor();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    for (const slug of [
      "",
      "product",
      "design",
      "components",
      "accessibility",
      "surfaces",
      "review",
    ]) {
      assert.equal(
        (await page.goto(`${origin}/docs${slug ? `/${slug}` : ""}`)).status(),
        200,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${slug} overflow at ${width}`,
      );
    }
  }
  await page.goto(`${origin}/docs/components`);
  await page
    .getByRole("searchbox", { name: "Search components or source paths" })
    .fill("TaskRow");
  await page
    .getByRole("navigation", { name: "Component jump links" })
    .getByRole("link", { name: /TaskRow/ })
    .click();
  assert.equal(await page.locator("#module-taskrow").getAttribute("open"), "");
  await page
    .getByRole("searchbox", { name: "Search components or source paths" })
    .fill("");
  await page
    .getByText("Open the interactive task example", { exact: true })
    .click();
  const row = page.locator(".task-row").first();
  await row
    .getByRole("button", { name: /complete/i })
    .first()
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Updated in this example only." })
    .waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(
    "Contributor guide: 320/390/1280px, copy/keyboard/navigation, downloads, raw reference, implementation and review paths and zero app API requests passed.",
  );
} finally {
  await browser.close();
}
