import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const origin = "http://localhost:3000";
const pages = [
  "",
  "product",
  "design",
  "components",
  "accessibility",
  "prototyping",
  "handoff",
];
const raw = await fetch(`${origin}/docs/agent-context.md`);
assert.equal(raw.status, 200);
const text = await raw.text();
for (const expected of [
  "FeatureRuntime",
  "InputGroupButton",
  "one level of subtasks",
  "wuff-prototype.zip",
])
  assert.ok(text.includes(expected), expected);
for (const file of [
  "wuff-prototype.zip",
  "wuff-prototype-skill.zip",
  "components.json",
  "source-manifest.json",
  "SKILL.md",
])
  assert.equal(
    (await fetch(`${origin}/prototype-kit/${file}`)).status,
    200,
    file,
  );
const browser = await chromium.launch({ headless: true, channel: "chrome" });
await mkdir("docs/screenshots", { recursive: true });
const errors = [],
  backend = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/api\/(v1|mcp|mobile)/.test(r.url())) backend.push(r.url());
  });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    for (const slug of pages) {
      const response = await page.goto(
        `${origin}/docs${slug ? `/${slug}` : ""}`,
      );
      assert.equal(response.status(), 200);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const size = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
      }));
      assert.ok(
        size.document <= size.viewport,
        `${slug || "overview"} at ${width}px: ${JSON.stringify(size)}`,
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 950 });
  await page.goto(`${origin}/docs/components`);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByText("primary: this is a demonstration; nothing was changed.", {
      exact: true,
    })
    .waitFor();
  await page.getByRole("button", { name: "Rose", exact: true }).click();
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--wuff-primary")
        .trim(),
    ),
    "#a23f66",
  );
  const input = page.getByRole("textbox", { name: "Task name", exact: true });
  await input.fill("An idea from our pack");
  assert.equal(await input.inputValue(), "An idea from our pack");
  const add = page.getByRole("button", { name: "Demonstrate add task" });
  const box = await add.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44);
  await page.screenshot({
    path: "docs/screenshots/prototype-components-390.png",
    fullPage: true,
  });
  await page
    .getByText("Open the interactive prototype starter", { exact: true })
    .click();
  const row = page.locator(".task-row").first();
  await row.waitFor();
  const check = row.getByRole("button", { name: /complete/i }).first();
  await check.click();
  await page
    .getByRole("status")
    .filter({ hasText: "Updated in this prototype only." })
    .waitFor();
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--wuff-primary")
        .trim(),
    ),
    "#a23f66",
    "embedded preview must not replace the guide palette",
  );
  await page.goto(`${origin}/docs`);
  await page.setViewportSize({ width: 1280, height: 950 });
  await page.screenshot({
    path: "docs/screenshots/prototype-guide-1280.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 950 });
  await page.goto(`${origin}/docs`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "docs/screenshots/prototype-guide-390.png",
    fullPage: true,
  });
  await page.goto("http://localhost:4173");
  await page.getByRole("heading", { name: "Ideas for our pack" }).waitFor();
  await page
    .getByLabel("Task name", { exact: true })
    .fill("Prototype a new feature");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByText("Prototype a new feature", { exact: true })
    .first()
    .waitFor();
  await page.getByLabel("List palette", { exact: true }).selectOption("sage");
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--wuff-primary")
        .trim(),
    ),
    "#34705a",
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(errors, [], "browser exceptions");
  assert.deepEqual(backend, [], "demo must not call live Wuff APIs");
  console.log(
    "Passed: all seven public pages at 320/390/1280px; raw reference/downloads; real controls, palette and task interactions; standalone starter; no browser exceptions or Wuff API calls.",
  );
} finally {
  await browser.close();
}
