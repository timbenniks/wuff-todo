// Real local MCP Apps SDK host; existing development fixture owns and cleans its grant/list.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { getList } from "@wuff/domain";
import { database } from "@wuff/db";
import { scopes } from "@wuff/contracts";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Development only");
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect: baseExpect } = require("@playwright/test");
const expect = baseExpect.configure({ timeout: 15000 });
const [user] = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const actor = { id: user.id, scopes };
const fixture = spawn(
  process.execPath,
  ["--env-file=.env.local", "--import", "tsx", "scripts/browser-fixture.ts"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
const exited = once(fixture, "exit");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
let page: any;
const errors: string[] = [];
try {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("SDK fixture startup timed out")),
      60000,
    );
    fixture.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Local test host ready")) {
        clearTimeout(timer);
        resolve();
      }
    });
    fixture.on("exit", () => {
      clearTimeout(timer);
      reject(Error("SDK fixture stopped before readiness"));
    });
  });
  page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4173");
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByRole("combobox", { name: "Saved view", exact: true }),
  ).toBeVisible();
  await expect(
    frame.getByRole("button", { name: "Saved views", exact: true }),
  ).toBeVisible();
  const row = frame
    .locator(".task-item")
    .filter({
      has: frame.getByRole("button", {
        name: "Open task: Pick up groceries",
        exact: true,
      }),
    })
    .first();
  const taskId = await row.getAttribute("data-task-id");
  await row
    .getByRole("button", { name: "Open task: Pick up groceries", exact: true })
    .click();
  const dates = row.locator(
    'details[aria-label="Due date for Pick up groceries"]',
  );
  await dates.locator("summary").click();
  await expect(
    dates.getByRole("button", { name: "Save date", exact: true }),
  ).toBeVisible();
  let allCalls = 0,
    lost = true;
  const bodies: string[] = [];
  let listId = "";
  await page.route("**/mcp", async (route: any) => {
    const body = route.request().postDataJSON();
    if (body.name !== "update_task") return route.continue();
    allCalls++;
    listId = body.arguments.listId;
    bodies.push(JSON.stringify(body.arguments));
    if (lost) {
      lost = false;
      const r = await route.fetch();
      assert.equal(r.status(), 200);
      return route.abort("failed");
    }
    return route.continue();
  });
  await dates.getByRole("button", { name: "Tomorrow", exact: true }).click();
  const date = await dates
    .getByLabel("Choose due date for Pick up groceries", { exact: true })
    .inputValue();
  assert.ok(date);
  assert.equal(allCalls, 0);
  await dates.getByRole("button", { name: "Save date", exact: true }).click();
  await expect(
    dates.getByRole("button", { name: "Retry same request", exact: true }),
  ).toBeVisible();
  await dates
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(dates).not.toHaveAttribute("open");
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(
    (await getList(actor, listId)).tasks.find((t) => t.id === taskId)!.dueDate,
    date,
  );
  await dates.locator("summary").click();
  await dates.getByRole("button", { name: "Clear date", exact: true }).click();
  assert.equal(allCalls, 2);
  assert.equal(
    (await getList(actor, listId)).tasks.find((t) => t.id === taskId)!.dueDate,
    date,
  );
  await dates.getByRole("button", { name: "Save date", exact: true }).click();
  await expect(dates).not.toHaveAttribute("open");
  assert.equal(
    (await getList(actor, listId)).tasks.find((t) => t.id === taskId)!.dueDate,
    null,
  );
  await page.unroute("**/mcp");
  await dates.locator("summary").click();
  await dates.getByRole("button", { name: "Today", exact: true }).click();
  await dates.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(
    (await getList(actor, listId)).tasks.find((t) => t.id === taskId)!.dueDate,
    null,
  );
  await frame.getByRole("button", { name: "Saved views", exact: true }).click();
  await expect(
    frame.getByRole("button", { name: "Save as new view", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/ux-phase-six-mcp-1280.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(frame.locator("body")).toBeVisible();
  assert.ok(
    await frame
      .locator("body")
      .evaluate((el: HTMLElement) => el.scrollWidth <= el.clientWidth),
  );
  await page.screenshot({ path: "docs/screenshots/ux-phase-six-mcp-390.png" });
  assert.deepEqual(errors, []);
  console.log(
    "UX Phase 6 MCP passed: real SDK host Saved views labels, staged shortcuts/clear/cancel, committed date response loss with exact tool retry, actual saved/cleared dates, bounded phone iframe; fixture list and OAuth grant cleaned by its launcher.",
  );
} catch (e) {
  await page?.screenshot({
    path: ".vercel/ux-phase-six-mcp-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
  fixture.kill("SIGINT");
  const [code] = await exited;
  assert.equal(code, 0, "SDK fixture cleanup failed");
  await database().pool.end();
}
