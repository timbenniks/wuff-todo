import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const requireWeb = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect } = requireWeb("@playwright/test");
let browser: any, server: Server, origin: string;
before(async () => {
  const bundle = await build({
    entryPoints: ["tests/helpers/tasks-first.fixture.tsx"],
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    nodePaths: [resolve("apps/web/node_modules")],
  });
  const postcss = createRequire(requireWeb.resolve("@tailwindcss/postcss"))(
    "postcss",
  );
  const tailwind = requireWeb("@tailwindcss/postcss");
  const css = await postcss([tailwind()]).process(
    await readFile("apps/web/src/app/globals.css", "utf8"),
    { from: resolve("apps/web/src/app/globals.css") },
  );
  server = createServer((request, response) => {
    if (request.url === "/fixture.js") {
      response.setHeader("Content-Type", "text/javascript");
      response.end(bundle.outputFiles[0].text);
    } else if (request.url === "/fixture.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(css.css);
    } else if (request.url === "/font.ttf") {
      readFile("apps/web/src/fonts/dm-sans.ttf").then((font) =>
        response.end(font),
      );
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(
        '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>@font-face{font-family:"DM Sans";src:url(/font.ttf)}body{margin:0;font-family:"DM Sans",sans-serif}</style><div id="root"></div><script src="/fixture.js"></script></html>',
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
after(async () => {
  await browser?.close();
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("tasks default, keyboard tabs, draft retention and capture isolation", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/?component`);
    const tasks = page.getByRole("tab", { name: "Tasks 2" });
    const sublists = page.getByRole("tab", { name: "Sublists 7" });
    await expect(tasks).toHaveAttribute("aria-selected", "true");
    await page.getByLabel("Task draft").fill("Keep this draft");
    await tasks.press("ArrowRight");
    await expect(sublists).toBeFocused();
    await expect(page.getByLabel("Task draft")).toBeHidden();
    await expect(
      page.getByRole("list", { name: "Sublists" }).getByRole("button"),
    ).toHaveCount(7);
    await sublists.press("Home");
    await expect(page.getByLabel("Task draft")).toHaveValue("Keep this draft");
    await tasks.press("End");
    await page.getByRole("button", { name: "Unrelated capture" }).click();
    await expect(sublists).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Capture here" }).click();
    await expect(tasks).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Task draft")).toHaveValue("Keep this draft");
  } finally {
    await page.close();
  }
});

test("removed or archived children cannot leave a hidden task panel or revive a stale tab", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/?component`);
    await page.getByRole("tab", { name: "Sublists 7" }).click();
    await page.getByRole("button", { name: "Remove catalog" }).click();
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.getByLabel("Task draft")).toBeVisible();
    await page.getByRole("button", { name: "Restore catalog" }).click();
    await expect(page.getByRole("tab", { name: "Tasks 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("tab", { name: "Sublists 7" }).click();
    await page.getByRole("button", { name: "Archive children" }).click();
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Sublists" })).toBeHidden();
  } finally {
    await page.close();
  }
});

test("background removal of the final sublists restores focus without stealing external focus", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/?component`);
    await page.getByRole("tab", { name: "Sublists 7" }).click();
    await page
      .getByRole("button", { name: "01 · Unreal foundations", exact: true })
      .focus();
    await page.evaluate(() =>
      window.dispatchEvent(new Event("fixture:remove-catalog")),
    );
    await expect(page.locator("#list-content")).toBeFocused();
    await expect(page.getByLabel("Task draft")).toBeVisible();
    await page.getByRole("button", { name: "Restore catalog" }).click();
    await page.getByRole("tab", { name: "Tasks 2" }).focus();
    await page.evaluate(() =>
      window.dispatchEvent(new Event("fixture:remove-catalog")),
    );
    await expect(page.locator("#list-content")).toBeFocused();
    await page.getByRole("button", { name: "Restore catalog" }).click();
    await page.getByRole("tab", { name: "Sublists 7" }).click();
    const outside = page.getByRole("button", { name: "Unrelated capture" });
    await outside.focus();
    await page.evaluate(() =>
      window.dispatchEvent(new Event("fixture:remove-catalog")),
    );
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(outside).toBeFocused();
  } finally {
    await page.close();
  }
});

test("child selection and parent/sibling navigation preserve list-local task defaults", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/?component`);
    await page.getByRole("tab", { name: "Sublists 7" }).click();
    await page.getByRole("button", { name: "01 · Unreal foundations" }).click();
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.getByLabel("Task draft")).toBeVisible();
    await page.getByLabel("Sibling lists").selectOption("child-1");
    await expect(
      page.getByLabel("Sibling lists").locator('option[value="child-1"]'),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "← 🚀 Cosmic Breakfast | Master plan" })
      .click();
    await expect(page.getByRole("tab", { name: "Tasks 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  } finally {
    await page.close();
  }
});

test("real workspace: Add task from sublists, saved views and responsive document navigation", async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error: Error) => errors.push(error.message));
  const output = "test-results/tasks-first";
  await mkdir(output, { recursive: true });
  try {
    await page.goto(origin);
    await page.getByRole("tab", { name: "Sublists 7" }).click();
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Tasks 2" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const capture = page.locator(".inline-capture-line input");
    await expect(capture).toBeFocused();
    await capture.fill("Unsaved new task");
    await page.getByRole("tab", { name: "Sublists 7" }).click();
    await page.getByRole("tab", { name: "Tasks 2" }).click();
    await expect(capture).toHaveValue("Unsaved new task");
    await capture.press("Escape");
    await page
      .getByRole("button", { name: "View settings", exact: true })
      .click();
    await expect(page.getByLabel("Saved view", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const tab of ["Tasks 2", "Sublists 7"]) {
        await page.getByRole("tab", { name: tab }).click();
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `No page overflow at ${width}/${tab}`,
        );
        await page.screenshot({
          path: `${output}/${width}-${tab.startsWith("Tasks") ? "tasks" : "sublists"}.png`,
          fullPage: true,
        });
      }
      if (width >= 768) {
        const scroll = await page
          .locator(".workspace-list-nav")
          .evaluate((el: HTMLElement) => ({
            overflow: getComputedStyle(el).overflowY,
            client: el.clientHeight,
            scroll: el.scrollHeight,
          }));
        assert.equal(scroll.overflow, "visible");
        assert(scroll.scroll <= scroll.client + 1);
        await page
          .getByRole("button", { name: "Sign out" })
          .scrollIntoViewIfNeeded();
        await expect(
          page.getByRole("button", { name: "Sign out" }),
        ).toBeInViewport();
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
    await page.screenshot({
      path: `${output}/dark-sublists.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test("dense lists scroll the document and restore drawer focus and position", async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  try {
    await page.goto(`${origin}/?dense`);
    const task = page.getByRole("link", {
      name: "Open task: Dense task 20",
      exact: true,
    });
    await task.scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => window.scrollY);
    assert(scroll > 0);
    await task.click();
    const drawer = page.getByRole("dialog", {
      name: "Task details",
      exact: true,
    });
    await expect(drawer).toBeVisible();
    await drawer
      .getByRole("button", { name: "Close task details", exact: true })
      .click();
    await expect(drawer).toHaveCount(0);
    await expect(task).toBeFocused();
    assert(Math.abs(scroll - (await page.evaluate(() => window.scrollY))) <= 2);
  } finally {
    await page.close();
  }
});

test("touch navigation retains 44px targets and opens children without clipping", async () => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto(origin);
    const add = page
      .getByRole("button", { name: "Add task", exact: true })
      .first();
    await expect(add).toBeInViewport();
    await page.getByRole("button", { name: "Lists", exact: true }).click();
    const navigation = page.getByRole("dialog", { name: "Lists", exact: true });
    const child = navigation.getByRole("button", {
      name: "01 · Unreal foundations",
      exact: true,
    });
    const box = await child.boundingBox();
    assert(box && box.height >= 44);
    await child.click();
    await expect(navigation).toBeHidden();
    await expect(
      page.getByRole("heading", {
        name: "01 · Unreal foundations",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("tablist")).toHaveCount(0);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  } finally {
    await context.close();
  }
});
