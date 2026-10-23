// Actual optimized website against synthetic users in isolated development.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import {
  scopes,
  defaultDashboardSettings,
  dashboardThrough,
} from "@wuff/contracts";
import { database, dashboardPreferences, members } from "@wuff/db";
import {
  createList,
  createTask,
  getList,
  deleteList,
  updateList,
  getListOrder,
  reorderLists,
  getDashboardPreferences,
  updateDashboard,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Development only");
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect } = require("@playwright/test");
const [user, other] = JSON.parse(
  await readFile(".vercel/dev-users.json", "utf8"),
);
const actor = { id: user.id, scopes },
  op = () => crypto.randomUUID();
const originalOrder = await getListOrder(actor),
  otherPrefs = await getDashboardPreferences({ id: other.id, scopes });
const [originalPrefs] = await database()
  .db.select()
  .from(dashboardPreferences)
  .where(eq(dashboardPreferences.userId, actor.id));
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  ids: string[] = [],
  errors: string[] = [];
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Paris",
}).format(new Date());
function day(delta: number) {
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
try {
  let plants = await createList(actor, {
    title: "Plant care",
    operationId: op(),
  });
  ids.push(plants.id);
  let shared = await createList(actor, {
    title: "Family plans",
    operationId: op(),
  });
  ids.push(shared.id);
  await database()
    .db.insert(members)
    .values({ listId: shared.id, userId: other.id });
  for (const [title, date] of [
    ["Check monstera", day(-1)],
    ["Water the balcony", today],
    ["Repot " + "a".repeat(170), day(3)],
  ] as const)
    plants = await createTask(actor, {
      listId: plants.id,
      version: plants.version,
      title,
      dueDate: date,
      operationId: op(),
    });
  shared = await createTask(actor, {
    listId: shared.id,
    version: shared.version,
    title: "Book a table",
    dueDate: today,
    operationId: op(),
  });
  await reorderLists(actor, {
    ...(await getListOrder(actor)),
    favoriteListIds: [plants.id],
    operationId: op(),
  });
  await updateDashboard(actor, {
    ...(await getDashboardPreferences(actor)),
    settings: defaultDashboardSettings,
    operationId: op(),
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    timezoneId: "Europe/Paris",
  });
  const login = await context.request.post(
    "http://localhost:3000/api/auth/sign-in/email",
    {
      headers: { Origin: "http://localhost:3000" },
      data: { email: user.email, password: user.password },
    },
  );
  assert.equal(login.status(), 200);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e: Error) => errors.push(e.message));
  const main = page.getByRole("main"),
    dialog = page.getByRole("dialog", { name: "Customize Home", exact: true });
  const gotoHome = async () => {
    await page.goto("http://localhost:3000/lists?home=1");
    await expect(
      main.getByRole("heading", {
        name: "Wuff do I need to know?",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      main.getByRole("button", { name: "Customize Home", exact: true }),
    ).toBeEnabled();
  };
  const customize = async () => {
    await main
      .getByRole("button", { name: "Customize Home", exact: true })
      .click();
    await expect(dialog).toBeVisible();
  };
  const save = async () => {
    await dialog
      .getByRole("button", { name: "Save Home settings", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
  };
  await gotoHome();
  await expect(
    main
      .getByRole("region", { name: "Today", exact: true })
      .getByRole("button", { name: /Check monstera/ }),
  ).toBeVisible();
  await expect(
    main
      .getByRole("region", { name: "Today", exact: true })
      .getByText("Shared", { exact: true }),
  ).toBeVisible();
  await expect(
    main.getByRole("region", { name: "Coming up", exact: true }),
  ).toContainText("Repot");
  await main
    .getByRole("region", { name: "Today", exact: true })
    .getByRole("button", { name: /Check monstera/ })
    .click();
  await expect(page).toHaveURL(/\/tasks\//);
  await gotoHome();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await mkdir("docs/screenshots", { recursive: true });
    await page.screenshot({
      path: `docs/screenshots/home-dashboard-${width}.png`,
      fullPage: true,
    });
    await customize();
    assert.ok(
      await dialog.evaluate(
        (el: HTMLElement) => el.scrollWidth <= el.clientWidth,
      ),
    );
    await page.screenshot({
      path: `docs/screenshots/home-dashboard-customize-${width}.png`,
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  await customize();
  await dialog.getByRole("checkbox", { name: "Today", exact: true }).uncheck();
  await dialog
    .getByRole("button", { name: "Move Favorites up", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Move Favorites up", exact: true })
    .click();
  await dialog
    .getByLabel("When I open Wuff", { exact: true })
    .selectOption("last_list");
  await save();
  await expect(
    main.getByRole("region", { name: "Today", exact: true }),
  ).toHaveCount(0);
  assert.deepEqual((await getDashboardPreferences(actor)).settings.sections, [
    "favorites",
    "today",
    "upcoming",
  ]);
  await main
    .getByRole("region", { name: "Favorites", exact: true })
    .getByRole("button", { name: "Plant care", exact: true })
    .click();
  await expect(
    main.getByRole("heading", { name: "Plant care", exact: true }),
  ).toBeVisible();
  await page.goto("http://localhost:3000/lists");
  await expect(
    main.getByRole("heading", { name: "Plant care", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(
    main.getByRole("heading", { name: "Wuff do I need to know?", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    main.getByRole("heading", { name: "Wuff do I need to know?", exact: true }),
  ).toBeVisible();
  await expect(
    main.getByRole("button", { name: "Customize Home", exact: true }),
  ).toBeEnabled();
  await page.goBack();
  await expect(
    main.getByRole("heading", { name: "Plant care", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    main.getByRole("heading", { name: "Wuff do I need to know?", exact: true }),
  ).toBeVisible();
  await expect(
    main.getByRole("button", { name: "Customize Home", exact: true }),
  ).toBeEnabled();
  // Archived last-list IDs must fall back to Home rather than open archived content.
  const beforeArchive = await getList(actor, plants.id);
  const archived = await updateList(actor, {
    listId: plants.id,
    version: beforeArchive.version,
    archived: true,
    operationId: op(),
  });
  await page.goto("http://localhost:3000/lists");
  await expect(
    main.getByRole("button", { name: "Customize Home", exact: true }),
  ).toBeEnabled();
  await expect(
    main.getByRole("heading", { name: "Plant care", exact: true }),
  ).toHaveCount(0);
  await updateList(actor, {
    listId: plants.id,
    version: archived.version,
    archived: false,
    operationId: op(),
  });
  await gotoHome();
  // One lost response after commit: retry must carry the exact same operation/body.
  let first = true;
  const bodies: string[] = [];
  await page.route("**/api/v1/dashboard", async (route: any) => {
    if (route.request().method() !== "PUT") return route.continue();
    bodies.push(route.request().postData());
    if (first) {
      first = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await customize();
  await dialog
    .getByRole("checkbox", { name: "Coming up", exact: true })
    .uncheck();
  await dialog
    .getByRole("button", { name: "Save Home settings", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Retry same request", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("checkbox", { name: "Coming up", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  await page.unroute("**/api/v1/dashboard");
  await customize();
  await dialog
    .getByRole("checkbox", { name: "Favorites", exact: true })
    .uncheck();
  const current = await getDashboardPreferences(actor);
  await updateDashboard(actor, {
    version: current.version,
    settings: defaultDashboardSettings,
    operationId: op(),
  });
  await dialog
    .getByRole("button", { name: "Save Home settings", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("changed");
  await expect(
    dialog.getByRole("checkbox", { name: "Favorites", exact: true }),
  ).not.toBeChecked();
  await dialog
    .getByRole("button", { name: "Reload saved settings", exact: true })
    .click();
  await expect(
    dialog.getByRole("checkbox", { name: "Favorites", exact: true }),
  ).toBeChecked();
  for (const section of ["Today", "Coming up", "Favorites"])
    await dialog
      .getByRole("checkbox", { name: section, exact: true })
      .uncheck();
  await save();
  await expect(
    main.getByRole("heading", {
      name: "A quiet corner for your pack.",
      exact: true,
    }),
  ).toBeVisible();
  await customize();
  await dialog
    .getByRole("button", { name: "Reset to default", exact: true })
    .click();
  await save();
  let failed = true;
  await page.route("**/api/v1/dashboard?*", async (route: any) => {
    if (failed) {
      failed = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { message: "Home could not be loaded.", code: "unavailable" },
        }),
      });
    }
    return route.continue();
  });
  await page.reload();
  await expect(main.getByRole("alert")).toContainText(
    "Home could not be loaded",
  );
  await expect(
    main.getByRole("region", { name: "Today", exact: true }),
  ).toHaveCount(0);
  await main.getByRole("button", { name: "Retry Home", exact: true }).click();
  await expect(
    main.getByRole("region", { name: "Today", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/dashboard?*");
  assert.deepEqual(
    await getDashboardPreferences({ id: other.id, scopes }),
    otherPrefs,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Home browser checks passed: task navigation, shared context, customization/reload/reset/all-hidden, account isolation, last-list startup/explicit Home, exact retry, conflict draft recovery, failed-read recovery and 320/390/1280 layouts.",
  );
} finally {
  await browser.close();
  for (const id of ids.reverse()) {
    const list = await getList(actor, id);
    await deleteList(actor, {
      listId: id,
      version: list.version,
      operationId: op(),
    });
  }
  await reorderLists(actor, {
    ...originalOrder,
    version: (await getListOrder(actor)).version,
    operationId: op(),
  });
  if (originalPrefs)
    await database()
      .db.insert(dashboardPreferences)
      .values(originalPrefs)
      .onConflictDoUpdate({
        target: dashboardPreferences.userId,
        set: originalPrefs,
      });
  else
    await database()
      .db.delete(dashboardPreferences)
      .where(eq(dashboardPreferences.userId, actor.id));
  await database().pool.end();
}
