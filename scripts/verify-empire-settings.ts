// Real optimized localhost app and synthetic development accounts only.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { eq } from "drizzle-orm";
import { database, empirePreferences, oauthTokens } from "@wuff/db";
import {
  getEmpireSettings,
  updateEmpireSettings,
  createList,
  getList,
  deleteList,
} from "@wuff/domain";
import { scopes } from "@wuff/contracts";
import { empireGrant, empireMcp } from "../tests/helpers/empire-grant";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Development only");
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect: baseExpect } = require("@playwright/test");
const expect = baseExpect.configure({ timeout: 15000 });
const [user, other] = JSON.parse(
  await readFile(".vercel/dev-users.json", "utf8"),
);
const actor = { id: user.id, scopes },
  otherActor = { id: other.id, scopes };
const origin = "http://localhost:3000";
const [original] = await database()
  .db.select()
  .from(empirePreferences)
  .where(eq(empirePreferences.userId, actor.id));
const otherBefore = await getEmpireSettings(otherActor);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = [];
async function fetchRoute(route: any) {
  try {
    return await route.fetch();
  } catch {
    throw new Error(
      "Intercepted local request failed; request headers withheld.",
    );
  }
}
let fixture: ReturnType<typeof spawn> | undefined;
let fixtureExit: Promise<unknown> | undefined;
let listId = "",
  grantId = "";
async function login(context: any) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await context.request.post(
      origin + "/api/auth/sign-in/email",
      {
        headers: { Origin: origin },
        data: { email: user.email, password: user.password },
      },
    );
    if (response.status() === 429 && attempt < 3) {
      await delay(
        Math.max(
          5,
          Math.min(30, Number(response.headers()["retry-after"]) || 15),
        ) * 1000,
      );
      continue;
    }
    assert.equal(response.status(), 200);
    return;
  }
}
try {
  await updateEmpireSettings(actor, {
    version: (await getEmpireSettings(actor)).version,
    operationId: crypto.randomUUID(),
    changes: [
      { appId: "todo", visible: true, dashboard: true },
      { appId: "totake", visible: true },
    ],
  });
  const list = await createList(actor, {
    title: "Empire settings direct-link fixture",
    operationId: crypto.randomUUID(),
  });
  listId = list.id;
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
  });
  await login(context);
  const page = await context.newPage();
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await mkdir("docs/screenshots", { recursive: true });
  const requests: string[] = [];
  page.on("request", (r: any) => requests.push(r.url()));
  // A Next.js client transition and Back must stop private settings polling on
  // the public guide, even while the shared root layout remains mounted.
  await page.goto(origin + "/docs");
  const preferencesLoaded = page.waitForResponse(
    (response: any) =>
      response.url() === origin + "/api/v1/empire" &&
      response.request().method() === "GET",
  );
  await page.getByRole("link", { name: "Wuff Todo Home", exact: true }).click();
  await preferencesLoaded;
  await expect(
    page.getByRole("heading", { name: "Your day", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", {
      name: "Build features that belong in Wuff",
      exact: true,
    }),
  ).toBeVisible();
  requests.length = 0;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await delay(200);
  assert(
    !requests.some((url) => url.includes("/api/v1/empire")),
    "Public guide stops private preference polling after client navigation",
  );
  await page.goto(origin + "/settings");
  await expect(page).toHaveURL(/\/settings\/apps$/);
  const showTodo = page.getByRole("checkbox", {
    name: "Show Wuff Todo",
    exact: true,
  });
  await expect(showTodo).toBeChecked();
  assert.equal(await page.locator(".workspace-sidebar").count(), 0);
  assert(
    !requests.some((url) =>
      /\/api\/v1\/(lists|live|invitations)(?:\?|$)/.test(url),
    ),
    "Global settings do not fetch Todo collections",
  );
  // Saving hides both apps from menu/cards while Settings remains reachable.
  await showTodo.uncheck();
  await page
    .getByRole("checkbox", { name: "Show Wuff Totake", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Save choices", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your choices are saved",
  );
  await expect(
    page
      .locator(".empire-desktop-nav")
      .getByRole("link", { name: "Wuff Todo", exact: true }),
  ).toHaveCount(0);
  await page.goto(origin + "/");
  await expect(
    page.getByText("Your apps are hidden.", { exact: false }),
  ).toBeVisible();
  assert.equal(await page.locator(".empire-app-card").count(), 0);
  await page.goto(origin + `/lists?listId=${list.id}`);
  await expect(page.locator(".list-heading h1")).toHaveText(list.title);
  await page.goto(origin + "/settings/apps");
  await expect(showTodo).not.toBeChecked();
  // A cancelled draft is not saved.
  await showTodo.check();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(showTodo).not.toBeChecked();
  // Commit then lose the response: retry must send the identical operation.
  const bodies: string[] = [];
  await page.route("**/api/v1/empire", async (route: any) => {
    if (route.request().method() !== "PUT") return route.continue();
    bodies.push(route.request().postData());
    const response = await fetchRoute(route);
    return bodies.length === 1 ? route.abort() : route.fulfill({ response });
  });
  await showTodo.check();
  await page.getByRole("button", { name: "Save choices", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry same request", exact: true }),
  ).toBeVisible();
  await expect(showTodo).toBeChecked();
  await expect(showTodo).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Your choices are saved",
  );
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  await page.unroute("**/api/v1/empire");
  // A remote write must not silently rebase a dirty local draft.
  await showTodo.uncheck();
  await updateEmpireSettings(actor, {
    version: (await getEmpireSettings(actor)).version,
    operationId: crypto.randomUUID(),
    changes: [{ appId: "totake", visible: true }],
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("button", { name: "Save choices", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "settings changed",
  );
  await expect(showTodo).not.toBeChecked();
  await page
    .getByRole("button", { name: "Load latest settings", exact: true })
    .click();
  await expect(showTodo).toBeChecked();
  // Dashboard choices do not hide app launchers or reset Todo's own overview.
  await page.goto(origin + "/settings/dashboard");
  await page
    .getByRole("checkbox", { name: "Summarize Wuff Todo", exact: true })
    .uncheck();
  await expect(
    page.getByRole("checkbox", { name: "Summarize Wuff Totake", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Save choices", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  requests.length = 0;
  await page.goto(origin + "/");
  await expect(page.locator(".empire-app-card")).toHaveCount(2);
  assert.equal(await page.locator(".empire-todo").count(), 0);
  assert(!requests.some((url) => url.includes("/api/v1/dashboard?")));
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + "/settings/apps");
    await expect(showTodo).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Settings overflow at ${width}`,
    );
    await page.screenshot({
      path: `docs/screenshots/empire-settings-${width}.png`,
      fullPage: true,
    });
    if (width < 768) {
      await page
        .getByLabel("Settings page", { exact: true })
        .selectOption("/settings/notifications");
    } else
      await page
        .getByRole("navigation", { name: "Settings", exact: true })
        .getByRole("link", { name: "Notifications", exact: true })
        .click();
    await expect(
      page.getByRole("heading", { name: "Notifications", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your devices", exact: true }),
    ).toBeVisible();
    assert.equal(
      await page.getByText("Daily nudge", { exact: true }).count(),
      0,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.goto(origin + "/settings/reminders");
  await expect(
    page.getByRole("heading", { name: "Todo reminders", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Daily nudge", { exact: true })).toBeVisible();
  for (const path of [
    "/connections?listId=" + list.id + "#cursor",
    "/settings/connections?listId=" + list.id + "#cursor",
  ]) {
    await page.goto(origin + path);
    await expect(page).toHaveURL(
      new RegExp("/settings/todo/cursor\\?listId=" + list.id + "#cursor"),
    );
  }
  await page.goto(origin + "/github?listId=" + list.id);
  await expect(page).toHaveURL(
    new RegExp("/settings/todo/github\\?listId=" + list.id),
  );
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(origin + "/settings/connections");
  const cookie = (await context.cookies())
    .map((c: any) => `${c.name}=${c.value}`)
    .join("; ");
  const grant = await empireGrant(cookie, "empire:read");
  grantId = grant.clientId;
  await page.reload();
  const connection = page.locator(`[data-client-id="${grant.clientId}"]`);
  await expect(connection).toContainText(
    "Read Empire choices and AI connections",
  );
  const disconnectBodies: string[] = [];
  await page.route("**/api/v1/connections", async (route: any) => {
    if (route.request().method() !== "DELETE") return route.continue();
    disconnectBodies.push(route.request().postData());
    const response = await fetchRoute(route);
    return disconnectBodies.length === 1
      ? route.abort()
      : route.fulfill({ response });
  });
  await connection
    .getByRole("button", { name: "Disconnect", exact: true })
    .click();
  await expect(
    connection.getByRole("button", { name: "Retry disconnect", exact: true }),
  ).toBeVisible();
  await expect(
    connection.getByRole("button", { name: "Retry disconnect", exact: true }),
  ).toBeEnabled();
  assert.equal(
    (await empireMcp(grant.access_token, "get_empire_settings")).status,
    401,
  );
  await connection
    .getByRole("button", { name: "Retry disconnect", exact: true })
    .click();
  await expect(connection).toHaveCount(0);
  assert.equal(disconnectBodies[0], disconnectBodies[1]);
  await page.unroute("**/api/v1/connections");
  assert.deepEqual(await getEmpireSettings(otherActor), otherBefore);
  await context.close();
  // Exercise the actual MCP App through the SDK host, including committed-response loss.
  fixture = spawn(
    process.execPath,
    ["--env-file=.env.local", "--import", "tsx", "scripts/browser-fixture.ts"],
    {
      env: { ...process.env, WUFF_ORIGIN: origin, WUFF_FIXTURE_VIEW: "empire" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  fixtureExit = once(fixture, "exit");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("SDK fixture timed out")),
      60000,
    );
    fixture!.stdout!.on("data", (chunk) => {
      if (String(chunk).includes("Local test host ready")) {
        clearTimeout(timer);
        resolve();
      }
    });
    fixture!.on("exit", () => {
      clearTimeout(timer);
      reject(Error("SDK fixture stopped"));
    });
  });
  const host = await browser.newPage({
    viewport: { width: 390, height: 1000 },
  });
  host.on("pageerror", (e: Error) => errors.push(e.message));
  await host.goto("http://127.0.0.1:4173");
  const frame = host.frameLocator("iframe");
  await expect(
    frame.getByRole("heading", { name: "Your Wuff Empire", exact: true }),
  ).toBeVisible();
  const calls: string[] = [];
  await host.route("**/mcp", async (route: any) => {
    const body = route.request().postDataJSON();
    if (body.name !== "update_empire_settings") return route.continue();
    calls.push(JSON.stringify(body.arguments));
    const response = await fetchRoute(route);
    return calls.length === 1 ? route.abort() : route.fulfill({ response });
  });
  const checkbox = frame.getByRole("checkbox", {
    name: "Show Wuff Todo",
    exact: true,
  });
  const before = await checkbox.isChecked();
  await checkbox.setChecked(!before);
  assert.equal(calls.length, 0);
  await frame
    .getByRole("button", { name: "Save choices", exact: true })
    .click();
  await expect(
    frame.getByRole("button", { name: "Retry same request", exact: true }),
  ).toBeVisible();
  await frame
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(frame.locator("#status")).toHaveText("Your choices are saved.");
  await expect(
    frame.getByRole("checkbox", { name: "Show Wuff Todo", exact: true }),
  ).toBeChecked({ checked: !before });
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1]);
  assert.equal((await getEmpireSettings(actor)).apps.todo.visible, !before);
  await expect(
    frame.getByRole("button", { name: "Save choices", exact: true }),
  ).toBeDisabled();
  await host.locator("iframe").evaluate((el: HTMLIFrameElement) => {
    el.style.height = "1100px";
  });
  await frame.locator("html").evaluate((el: HTMLElement) => {
    el.scrollTop = 0;
  });
  await host.screenshot({
    path: "docs/screenshots/empire-settings-mcp-390.png",
    fullPage: true,
  });
  assert(
    await frame
      .locator("body")
      .evaluate((el: HTMLElement) => el.scrollWidth <= el.clientWidth),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Empire settings browser/SDK checks passed: standalone settings, per-account choices, hide/restore/direct links, dashboard independence, Cancel, conflict draft, exact committed-response-loss retries for settings and disconnect, legacy links, notification separation, 320/390/1280 layouts, actual MCP App controls and retry. No page errors; synthetic data only.",
  );
} finally {
  for (const context of browser.contexts())
    for (const page of context.pages())
      await page.unrouteAll({ behavior: "wait" });
  await browser.close();
  if (fixture) {
    fixture.kill("SIGINT");
    await fixtureExit;
  }
  if (listId) {
    const latest = await getList(actor, listId);
    await deleteList(actor, {
      listId,
      version: latest.version,
      operationId: crypto.randomUUID(),
    });
  }
  if (grantId)
    await database()
      .db.update(oauthTokens)
      .set({ revoked: true })
      .where(eq(oauthTokens.clientId, grantId));
  if (original)
    await database()
      .db.insert(empirePreferences)
      .values(original)
      .onConflictDoUpdate({ target: empirePreferences.userId, set: original });
  else
    await database()
      .db.delete(empirePreferences)
      .where(eq(empirePreferences.userId, actor.id));
  await database().pool.end();
}
