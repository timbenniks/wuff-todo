// Actual local UI; all provider endpoints mocked, no external activation or paid actions.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { scopes } from "@wuff/contracts";
import { database } from "@wuff/db";
import {
  createList,
  getList,
  deleteList,
  getReminderSettings,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Development only");
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect: baseExpect } = require("@playwright/test");
const expect = baseExpect.configure({ timeout: 15000 });
const [user] = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const actor = { id: user.id, scopes },
  op = () => crypto.randomUUID();
const browser = await chromium.launch({ headless: true, channel: "chrome" });
let page: any;
const ids: string[] = [],
  errors: string[] = [];
try {
  const work = await createList(actor, {
    title: "Phase 5 integration setup",
    mode: "work",
    operationId: op(),
  });
  ids.push(work.id);
  const basic = await createList(actor, {
    title: "Phase 5 groceries",
    operationId: op(),
  });
  ids.push(basic.id);
  const original = await getReminderSettings(actor);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const login = await context.request.post(
    "http://localhost:3000/api/auth/sign-in/email",
    {
      headers: { Origin: "http://localhost:3000" },
      data: { email: user.email, password: user.password },
    },
  );
  assert.equal(login.status(), 200);
  page = await context.newPage();
  page.on("pageerror", (e: Error) => errors.push(e.message));
  let settings = {
    ...original,
    devices: [],
    schedulerReady: false,
    publicKey: null,
    delivery: {
      web: false,
      ios: false,
      macos: false,
      android: false,
      windows: false,
    },
  };
  let loseReminder = true;
  let rejectPreferences = false,
    staleVersion = 0;
  const reminderBodies: string[] = [];
  await page.route("**/api/v1/reminders", async (route: any) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: settings });
    const body = route.request().postDataJSON();
    reminderBodies.push(route.request().postData());
    assert.equal(body.action, "settings");
    if (rejectPreferences) {
      assert.equal(body.input.version, staleVersion);
      return route.fulfill({
        status: 409,
        json: {
          error: {
            code: "conflict",
            message: "Reminder preferences changed. Your draft is kept.",
          },
        },
      });
    }
    settings = {
      ...settings,
      version: settings.version + Number(loseReminder),
      preferences: body.input.preferences,
    };
    if (loseReminder) {
      loseReminder = false;
      return route.abort("failed");
    }
    return route.fulfill({ json: settings });
  });
  await page.goto("http://localhost:3000/settings/reminders");
  await page
    .getByRole("button", { name: "Refresh delivery status", exact: true })
    .click();
  const delivery = page.getByRole("region", {
    name: "Reminder delivery status",
    exact: true,
  });
  await expect(delivery).toContainText("Setup needed");
  await expect(delivery).toContainText("None registered");
  await expect(delivery).toContainText("not verified here");
  assert.ok(
    (await delivery.boundingBox())!.y <
      (await page
        .getByRole("group", { name: "Daily nudge", exact: true })
        .boundingBox())!.y,
  );
  await expect(
    page.getByRole("link", { name: "Manage notification devices", exact: true }),
  ).toHaveAttribute("href", "/settings/notifications");
  await page.getByLabel("Send at", { exact: true }).fill("23:00");
  const quiet = page.getByLabel("Keep reminders quiet overnight", {
    exact: true,
  });
  if (!(await quiet.isChecked())) await quiet.check();
  await page.getByLabel("From", { exact: true }).fill("22:00");
  await page.getByLabel("Until", { exact: true }).fill("08:00");
  await expect(
    page.getByText(/Your daily nudge moves from 23:00 to 08:00/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save preference", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry same request", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Send at", { exact: true })).toHaveValue(
    "23:00",
  );
  await expect(page.getByLabel("Send at", { exact: true })).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(
    page.getByText("The previous request is confirmed saved.", { exact: true }),
  ).toBeVisible();
  assert.equal(reminderBodies.length, 2);
  assert.equal(reminderBodies[0], reminderBodies[1]);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `docs/screenshots/ux-phase-five-reminders-${width}.png`,
    });
  }
  // Configured scheduling/device still does not imply verified delivery.
  settings = {
    ...settings,
    schedulerReady: true,
    devices: [{ id: op(), label: "Mock PWA", transport: "web" }] as any,
    delivery: { ...settings.delivery, web: true },
  };
  await page
    .getByRole("button", { name: "Refresh delivery status", exact: true })
    .click();
  await expect(delivery).toContainText("Configured");
  await expect(delivery).toContainText("1 registered");
  await expect(delivery).toContainText("not verified here");
  await expect(
    page.getByRole("button", {
      name: "Save reminder preferences",
      exact: true,
    }),
  ).toBeVisible();
  staleVersion = settings.version;
  settings = {
    ...settings,
    version: settings.version + 1,
    preferences: { ...settings.preferences, dailyTime: "10:00" },
  };
  await page
    .getByRole("button", { name: "Refresh delivery status", exact: true })
    .click();
  await expect(page.getByLabel("Send at", { exact: true })).toHaveValue(
    "23:00",
  );
  rejectPreferences = true;
  await page
    .getByRole("button", { name: "Save reminder preferences", exact: true })
    .click();
  await expect(page.getByText(/Reminder preferences changed/)).toBeVisible();
  await expect(page.getByLabel("Send at", { exact: true })).toHaveValue(
    "23:00",
  );
  await page
    .getByRole("button", { name: "Load latest preferences", exact: true })
    .click();
  await expect(page.getByLabel("Send at", { exact: true })).toHaveValue(
    "10:00",
  );
  let connected = false,
    bound = false,
    failRead = true,
    loseBind = true;
  const binds: string[] = [];
  await page.route("**/api/v1/github*", async (route: any) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "GET") {
      if (failRead) {
        failRead = false;
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: "temporary",
              message: "GitHub status temporarily unavailable.",
            },
          },
        });
      }
      if (url.searchParams.has("repositories"))
        return route.fulfill({
          json: {
            repositories: [
              {
                installationId: 1,
                repositoryId: 2,
                name: "synthetic/private-repo",
                private: true,
              },
            ],
          },
        });
      return route.fulfill({
        json: {
          configured: true,
          account: connected ? "synthetic-owner" : null,
          installUrl: "https://github.com/apps/wuff-todo",
          bindings: bound
            ? [
                {
                  listId: work.id,
                  repository: "synthetic/private-repo",
                  active: true,
                  autoCreateIssues: false,
                },
              ]
            : [],
        },
      });
    }
    const body = route.request().postDataJSON();
    assert.equal(body.action, "bind");
    binds.push(route.request().postData());
    bound = true;
    if (loseBind) {
      loseBind = false;
      return route.abort("failed");
    }
    return route.fulfill({ json: { saved: true } });
  });
  await page.goto(`http://localhost:3000/github?listId=${work.id}`);
  await expect(
    page.getByRole("button", { name: "Retry GitHub status", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry GitHub status", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your GitHub account", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Installed repository", exact: true }),
  ).toHaveCount(0);
  connected = true;
  await page.reload();
  await page
    .getByRole("button", { name: "Load installed repositories", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Installed repository", exact: true })
    .selectOption("2");
  const save = page.getByRole("button", {
    name: "Save repository connection",
    exact: true,
  });
  await expect(save).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Stop repository synchronization",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("checkbox", { name: /I allow this list/ }).check();
  await expect(save).toBeEnabled();
  await expect(
    page.getByRole("group", { name: "Optional issue automation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Destination: synthetic\/private-repo/),
  ).toContainText(work.title);
  await save.click();
  await expect(
    page.getByRole("button", { name: "Retry previous request", exact: true }),
  ).toBeVisible();
  await expect(save).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry previous request", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Stop repository synchronization",
      exact: true,
    }),
  ).toBeVisible();
  assert.equal(binds.length, 2);
  assert.equal(binds[0], binds[1]);
  assert.equal(JSON.parse(binds[0]).autoCreateIssues, false);
  await page
    .getByRole("combobox", { name: "Your list", exact: true })
    .selectOption(basic.id);
  await expect(page.getByText(/Choose Work in this list/)).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(
    page.getByRole("checkbox", { name: /I allow this list/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", {
      name: "Stop repository synchronization",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/ux-phase-five-github-390.png",
    fullPage: true,
  });
  let failCursor = true;
  let readinessReady = false;
  let agentPosts = 0;
  await page.route("**/api/v1/agents*", async (route: any) => {
    if (route.request().method() !== "GET") {
      agentPosts++;
      throw Error("No agent write should run during readiness checks");
    }
    if (failCursor) {
      failCursor = false;
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: "temporary",
            message: "Cursor status temporarily unavailable.",
          },
        },
      });
    }
    const url = new URL(route.request().url());
    if (url.searchParams.has("environments"))
      return route.fulfill({
        json: { environments: [{ id: "mock-env", name: "Mock development" }] },
      });
    if (url.searchParams.has("listId"))
      return route.fulfill({
        json: {
          ready: readinessReady,
          binding: {
            environmentId: "mock-env",
            environmentName: "Mock development",
            repository: "synthetic/private-repo",
            requiredSecrets: ["TEST_API_KEY"],
          },
          missingSecrets: readinessReady ? [] : ["TEST_API_KEY"],
        },
      });
    return route.fulfill({
      json: { connected: true, configured: true, executionEnabled: false },
    });
  });
  await page.goto(
    `http://localhost:3000/settings/connections?listId=${work.id}`,
  );
  await page
    .getByRole("button", { name: "Retry Cursor readiness", exact: true })
    .click();
  const readiness = page.getByRole("region", {
    name: "Cursor readiness",
    exact: true,
  });
  await expect(readiness).toContainText("Disabled by the operator");
  await expect(readiness).toContainText("Missing TEST_API_KEY");
  await expect(readiness).toContainText("synthetic/private-repo");
  await expect(
    page.getByRole("button", {
      name: "Create environment in Cursor (uses paid allowance)",
      exact: true,
    }),
  ).not.toBeVisible();
  readinessReady = true;
  await page.reload();
  await expect(readiness).toContainText("Required secrets: Configured");
  await expect(readiness).toContainText("Saving setup does not start a run");
  assert.equal(agentPosts, 0);
  await page.screenshot({
    path: "docs/screenshots/ux-phase-five-cursor-390.png",
    fullPage: true,
  });
  assert.deepEqual(await getReminderSettings(actor), original);
  assert.deepEqual(errors, []);
  console.log(
    "UX Phase 5 passed: delivery-first unavailable/configured reminders, quiet-hours explanation, exact uncertain preference retry, staged GitHub account/repo/consent/optional automation and retry/reset, Cursor failed/ready/disabled execution states; no provider writes, device registration or paid run.",
  );
} catch (e) {
  await page?.screenshot({
    path: ".vercel/ux-phase-five-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
  for (const id of ids) {
    const list = await getList(actor, id);
    await deleteList(actor, {
      listId: id,
      version: list.version,
      operationId: op(),
    });
  }
  await database().pool.end();
}
