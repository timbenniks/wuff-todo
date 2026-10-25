import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { eq, and, inArray } from "drizzle-orm";
import {
  database,
  totakeAccounts,
  totakeTreatments,
  totakeSchedules,
  totakeOccurrences,
  totakeRecords,
  totakeAudit,
  totakeStockMovements,
  totakeJobs,
  receipts,
  empirePreferences,
  notificationPreferences,
} from "@wuff/db";
import { getTotake, updateTotake, getNotificationSettings } from "@wuff/domain";
import { scopes, totakeEngine as e } from "@wuff/contracts";
if (
  !process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l") ||
  process.env.WUFF_ORIGIN !== "http://localhost:3000"
)
  throw Error("Development loopback only");
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect: baseExpect } = require("@playwright/test"),
  expect = baseExpect.configure({ timeout: 15000 });
const [user] = JSON.parse(await readFile(".vercel/dev-users.json", "utf8")),
  actor = { id: user.id, scopes },
  db = database().db;
assert.equal(
  (
    await db
      .select()
      .from(totakeAccounts)
      .where(eq(totakeAccounts.userId, actor.id))
  ).length,
  0,
  "No pre-existing fixture medical data",
);
const [originalEmpire] = await db
  .select()
  .from(empirePreferences)
  .where(eq(empirePreferences.userId, actor.id));
const [originalNotifications] = await db
  .select()
  .from(notificationPreferences)
  .where(eq(notificationPreferences.userId, actor.id));
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  }),
  page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (err: Error) => errors.push(err.message));
let host: ReturnType<typeof spawn> | undefined,
  hostExit: Promise<unknown> | undefined;
const operations: string[] = [];
const op = () => {
  const id = crypto.randomUUID();
  operations.push(id);
  return id;
};
async function cleanup() {
  if (host) {
    host.kill("SIGTERM");
    await hostExit;
  }
  try {
    await context.request.post("http://localhost:3000/api/auth/sign-out", {
      headers: { Origin: "http://localhost:3000" },
      data: {},
    });
  } catch {}
  await browser.close();
  for (const table of [
    totakeJobs,
    totakeStockMovements,
    totakeAudit,
    totakeRecords,
    totakeOccurrences,
    totakeSchedules,
    totakeTreatments,
    totakeAccounts,
  ])
    await db.delete(table).where(eq(table.userId, actor.id));
  for (const [table, original] of [
    [empirePreferences, originalEmpire],
    [notificationPreferences, originalNotifications],
  ] as const) {
    await db.delete(table).where(eq(table.userId, actor.id));
    if (original) await db.insert(table).values(original as never);
  }
  if (operations.length)
    await db
      .delete(receipts)
      .where(
        and(
          eq(receipts.actorId, actor.id),
          inArray(receipts.operationId, operations),
        ),
      );
  await database().pool.end();
}
try {
  await page.goto("http://localhost:3000/totake");
  await expect(page).toHaveURL(/sign-in/);
  const login = await context.request.post(
    "http://localhost:3000/api/auth/sign-in/email",
    {
      headers: { Origin: "http://localhost:3000" },
      data: { email: user.email, password: user.password },
    },
  );
  assert.equal(login.status(), 200);
  let state = await getTotake(actor),
    wall = state.state.now + 5,
    today = Math.floor(wall / 1440);
  for (const name of ["Fictional morning tablet", "Fictional count capsule"]) {
    const t = e.newTreatment("medication", "custom", today);
    t.name = name;
    t.slots[0].time = e.time(wall);
    t.inventory = {
      enabled: true,
      current: "10",
      threshold: "2",
      unit: "tablet",
    };
    state = await updateTotake(actor, {
      version: state.version,
      operationId: op(),
      change: { action: "save_treatment", draft: t },
    });
  }
  await page.goto("http://localhost:3000/totake");
  await expect(
    page.getByRole("heading", { name: "Daily overview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View reminder", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "View reminder",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({
    path: "docs/screenshots/totake-reminder-390.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(
    dialog.getByRole("button", { name: /Snooze selected/ }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox").last().uncheck();
  await dialog
    .getByRole("button", { name: /Mark selected as taken\/done/ })
    .click();
  await expect(dialog).not.toBeVisible();
  let current = await getTotake(actor);
  assert.equal(current.state.groups.flatMap((g) => g.records).length, 1);
  assert.deepEqual(
    current.state.treatments!.map((t) => t.inventory.current).sort(),
    ["10", "9"],
  );
  await page.getByText("Recorded today", { exact: true }).click();
  await page
    .getByRole("button", { name: /Undo Fictional morning tablet/ })
    .click();
  await expect
    .poll(
      async () =>
        (await getTotake(actor)).state.groups.flatMap((g) => g.records).length,
    )
    .toBe(0);
  const bodies: string[] = [];
  let lose = true;
  await page.route("**/api/v1/totake", async (route: any) => {
    if (route.request().method() !== "PUT") return route.continue();
    bodies.push(route.request().postData());
    let response;
    try {
      response = await route.fetch();
    } catch {
      throw Error("Local intercepted request failed; headers withheld.");
    }
    if (lose) {
      lose = false;
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  await page
    .getByRole("button", { name: "Taken", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Retry the same save", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry the same save", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry the same save", exact: true }),
  ).not.toBeVisible();
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  current = await getTotake(actor);
  assert.equal(current.state.groups.flatMap((g) => g.records).length, 1);
  assert.equal(
    current.state.treatments!.find(
      (t) => t.name === "Fictional morning tablet",
    )!.inventory.current,
    "9",
  );
  await page.unroute("**/api/v1/totake");
  await page.route("**/api/v1/totake", async (route: any) => {
    if (route.request().method() === "GET") await route.abort("failed");
    else await route.continue();
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Refresh Totake", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/api/v1/totake");
  await page
    .getByRole("button", { name: "Refresh Totake", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add", exact: true }),
  ).toBeEnabled();

  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Medication", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Unsaved fictional item");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Sensor", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Discard unsaved changes?", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal((await getTotake(actor)).state.treatments!.length, 2);
  await mkdir("docs/screenshots", { recursive: true });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: `docs/screenshots/totake-overview-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("button", { name: "Medications & equipment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Medications & equipment", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/totake-items-1280.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await page
    .getByLabel("Name", { exact: true })
    .fill("Edited fictional tablet");
  for (let n = 0; n < 5; n++)
    await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({
    path: "docs/screenshots/totake-review-390.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  const before = await getTotake(actor);
  await updateTotake(actor, {
    version: before.version,
    operationId: op(),
    change: { action: "settings", repeat: 20, timezone: "Europe/Paris" },
  });
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Load latest data", exact: true }).last(),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "Edited fictional tablet",
  );
  await page
    .getByRole("button", { name: "Load latest data", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  assert.equal(
    (await getTotake(actor)).state.treatments!.find(
      (t) => t.name === "Edited fictional tablet",
    )!.inventory.current,
    "9",
  );
  await page.goto("http://localhost:3000/settings/dashboard");
  await page
    .getByRole("checkbox", { name: "Summarize Wuff Totake", exact: true })
    .check();
  await page.getByRole("button", { name: "Save choices", exact: true }).click();
  await expect(
    page.getByText("Your choices are saved.", { exact: true }),
  ).toBeVisible();
  await page.goto("http://localhost:3000/");
  await expect(
    page.getByRole("heading", { name: "From Wuff Totake", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/totake-empire-summary-1280.png",
    fullPage: true,
  });
  await page.goto("http://localhost:3000/settings/notifications");
  await page
    .getByRole("checkbox", {
      name: "Pause all Wuff notifications",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Save notification settings", exact: true })
    .click();
  await expect
    .poll(async () => (await getNotificationSettings(actor)).paused)
    .toBe(true);
  await page
    .getByRole("checkbox", {
      name: "Pause all Wuff notifications",
      exact: true,
    })
    .uncheck();
  await page
    .getByRole("button", { name: "Cancel", exact: true })
    .first()
    .click();
  assert.equal((await getNotificationSettings(actor)).paused, true);
  await page
    .getByRole("checkbox", {
      name: "Pause all Wuff notifications",
      exact: true,
    })
    .uncheck();
  await page
    .getByRole("button", { name: "Save notification settings", exact: true })
    .click();
  await expect
    .poll(async () => (await getNotificationSettings(actor)).paused)
    .toBe(false);
  host = spawn(
    process.execPath,
    ["--env-file=.env.local", "--import", "tsx", "scripts/browser-fixture.ts"],
    {
      cwd: process.cwd(),
      env: { ...process.env, WUFF_FIXTURE_VIEW: "totake" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  hostExit = once(host, "exit");
  await new Promise<void>((resolve, reject) => {
    let text = "";
    host!.stdout!.on("data", (chunk) => {
      text += chunk.toString();
      if (text.includes("Local test host ready")) resolve();
    });
    host!.once("error", reject);
    host!.once("exit", () =>
      reject(Error("MCP SDK host failed to start; logs withheld.")),
    );
  });
  await page.goto("http://127.0.0.1:4173");
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByRole("heading", { name: "Wuff Totake", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({
    path: "docs/screenshots/totake-mcp-active-390.png",
    fullPage: true,
  });
  const toolBodies: string[] = [];
  let loseToolReply = true;
  await page.route("http://127.0.0.1:4173/mcp", async (route: any) => {
    const body = route.request().postDataJSON();
    if (body.name !== "update_totake") return route.continue();
    toolBodies.push(JSON.stringify(body.arguments));
    let response;
    try {
      response = await route.fetch();
    } catch {
      throw Error("Local SDK request failed; headers withheld.");
    }
    if (loseToolReply) {
      loseToolReply = false;
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  await frame
    .getByRole("button", { name: "Skip selected", exact: true })
    .first()
    .click();
  await expect(
    frame.getByRole("button", { name: "Retry same request", exact: true }),
  ).toBeVisible();
  await frame
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  assert.equal(toolBodies.length, 2);
  assert.equal(toolBodies[0], toolBodies[1]);
  await expect(
    frame.getByText("Totake change saved.", { exact: true }),
  ).toBeVisible();
  await frame.getByText("Recorded today", { exact: true }).click();
  await expect(
    frame.getByText("Skipped", { exact: false }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({
    path: "docs/screenshots/totake-mcp-390.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS Totake real browser: selected records, Undo, lost-response exact retry, Cancel, conflict draft/load-latest, stock, 320/390/1280 layout, actual MCP Apps SDK controls.",
  );
} finally {
  await cleanup();
}
