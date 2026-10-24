import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const origin = "http://localhost:3000";
for (const file of [
  "contributor-workflow.md",
  "contributor-pr-template.md",
  "CONTRIBUTOR-SKILL.md",
  "wuff-contributor-skill.zip",
  "wuff-prototype.zip",
]) {
  const response = await fetch(`${origin}/prototype-kit/${file}`);
  assert.equal(response.status, 200, file);
  assert.ok((await response.arrayBuffer()).byteLength > 100, file);
}
const reference = await (await fetch(`${origin}/docs/agent-context.md`)).text();
assert.ok(reference.includes("/wuff-scope"));
assert.ok(reference.includes("Evidence commit:"));
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
      .getByRole("heading", { name: "Build a real feature", exact: true })
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
        .selectOption("/docs/prototyping");
      await page.waitForURL("**/docs/prototyping");
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
  await page.goto(`${origin}/docs/prototyping`);
  await page
    .getByRole("link", { name: "Download prototype kit", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(
    "Contributor guide: 320/390/1280px, copy/keyboard/navigation, downloads, raw reference, prototype path and zero app API requests passed.",
  );
} finally {
  await browser.close();
}
