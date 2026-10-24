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
    mode: "work",
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
  for (let i = 0; i < 16; i++)
    plants = await createTask(actor, {
      listId: plants.id,
      version: plants.version,
      title: `Desktop task ${i + 1}`,
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
        name: "Your day",
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
      .getByRole("link", { name: "Open task: Check monstera", exact: true }),
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
    .getByRole("link", { name: "Open task: Check monstera", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Task details", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close task details", exact: true })
    .click();
  await gotoHome();
  for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const layout = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>(".workspace-main")!,
        cards = document.querySelector<HTMLElement>(".home-cards")!,
        card = cards.firstElementChild!.getBoundingClientRect();
      return {
        columns: getComputedStyle(cards)
          .gridTemplateColumns.split(" ")
          .filter((value) => parseFloat(value) > 0).length,
        mainX: main.getBoundingClientRect().x,
        mainWidth: main.getBoundingClientRect().width,
        cardX: card.x,
        docHeight: document.documentElement.scrollHeight,
      };
    });
    assert.equal(
      layout.columns,
      width >= 1440 ? 3 : width >= 1024 ? 2 : 1,
      `card columns at ${width}`,
    );
    if (width >= 768) {
      await expect(
        page.locator(".desktop-list-navigation .sidebar-home"),
      ).toBeVisible();
      assert.equal(layout.mainX, 260);
      assert.equal(Math.round(layout.mainWidth), width - 260);
      assert.ok(layout.cardX - layout.mainX <= 40);
      assert.ok(layout.docHeight <= 1000);
      const sidebar = await page.evaluate(() => {
        const root = document.querySelector(".workspace-sidebar")!;
        const favorite = root.querySelector(".sidebar-favorites")!;
        const listRow = root.querySelector(".sidebar-list-row > button")!;
        const home = root.querySelector(".sidebar-home")!;
        return {
          favoriteBottom: favorite.getBoundingClientRect().bottom,
          headingTop: root
            .querySelector(".sidebar-section-heading")!
            .getBoundingClientRect().top,
          rowHeight: listRow.getBoundingClientRect().height,
          homeHeight: home.getBoundingClientRect().height,
          favoriteIconX: favorite
            .querySelector("nav button svg")!
            .getBoundingClientRect().x,
          listIconX: listRow.querySelector("svg")!.getBoundingClientRect().x,
          homeIconX: home.querySelector("svg")!.getBoundingClientRect().x,
        };
      });
      assert.ok(sidebar.headingTop >= sidebar.favoriteBottom);
      assert.ok(sidebar.rowHeight >= 44 && sidebar.homeHeight >= 44);
      assert.equal(sidebar.favoriteIconX, sidebar.listIconX);
      assert.equal(sidebar.homeIconX, sidebar.listIconX);
    }
    await mkdir("docs/screenshots", { recursive: true });
    await page.screenshot({
      path: `docs/screenshots/desktop-home-${width}.png`,
      fullPage: true,
    });
    if (width < 768) {
      const toggle = page.getByRole("button", {
        name: "Lists",
        exact: true,
      });
      await toggle.click();
      await expect(
        page.getByRole("navigation", { name: "Lists", exact: true }),
      ).toBeVisible();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.ok(
        await page
          .locator(".sidebar-list-row > button")
          .first()
          .evaluate(
            (el: HTMLElement) => el.getBoundingClientRect().height >= 44,
          ),
      );
      await page.screenshot({
        path: `docs/screenshots/sidebar-mobile-${width}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Close lists", exact: true })
        .click();
    }
    await customize();
    assert.ok(
      await dialog.evaluate(
        (el: HTMLElement) => el.scrollWidth <= el.clientWidth,
      ),
    );
    await page.screenshot({
      path: `docs/screenshots/desktop-customize-${width}.png`,
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  await page.setViewportSize({ width: 1440, height: 500 });
  await page
    .getByRole("navigation", { name: "Favorite lists", exact: true })
    .getByRole("button", { name: "Plant care", exact: true })
    .click();
  await expect(
    main.getByRole("heading", { name: "Plant care", exact: true }),
  ).toBeVisible();
  const footer = page.getByRole("button", { name: "Sign out", exact: true });
  assert.ok((await footer.boundingBox()).y + 44 <= 500);
  const sidebarTop = await page
    .locator(".workspace-sidebar")
    .evaluate((e: HTMLElement) => e.getBoundingClientRect().top);
  await page.locator(".workspace-main").hover();
  await page.mouse.wheel(0, 900);
  await expect
    .poll(() =>
      page.locator(".workspace-main").evaluate((e: HTMLElement) => e.scrollTop),
    )
    .toBeGreaterThan(0);
  assert.equal(
    await page
      .locator(".workspace-sidebar")
      .evaluate((e: HTMLElement) => e.getBoundingClientRect().top),
    sidebarTop,
  );
  assert.ok(
    await page
      .locator(".workspace-list-nav")
      .evaluate((e: HTMLElement) => e.scrollHeight > e.clientHeight),
  );
  assert.ok((await footer.boundingBox()).y + 44 <= 500);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollHeight),
    500,
  );
  await page.screenshot({
    path: "docs/screenshots/desktop-list-scroll.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1920, height: 1000 });
  await main
    .getByRole("link", { name: "Open task: Check monstera", exact: true })
    .click();
  const drawer = page.getByRole("dialog", {
    name: "Task details",
    exact: true,
  });
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Edit task notes", exact: true }),
  ).toBeVisible();
  assert.ok((await drawer.boundingBox()).width >= 790);
  await page.screenshot({
    path: "docs/screenshots/desktop-task-drawer.png",
    fullPage: true,
  });
  await drawer
    .getByRole("button", { name: "Edit task notes", exact: true })
    .click();
  const editor = drawer.locator('[contenteditable="true"]');
  await editor.fill("Layout draft stays while resizing");
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(editor).toContainText("Layout draft stays while resizing");
  await drawer
    .getByRole("button", { name: "Close task details", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Discard edits", exact: true })
    .click();
  await expect(drawer).not.toBeVisible();
  const target = plants.tasks.find((task) => task.title === "Check monstera")!;
  for (const width of [390, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`http://localhost:3000/tasks/${target.id}`);
    await expect(page.locator(".task-detail-notes")).toBeVisible();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const columns = await page.locator(".task-detail-panels").evaluate(
      (e: HTMLElement) =>
        getComputedStyle(e)
          .gridTemplateColumns.split(" ")
          .filter((value) => parseFloat(value) > 0).length,
    );
    assert.equal(columns, width >= 1440 ? 2 : 1);
    await page.screenshot({
      path: `docs/screenshots/desktop-task-page-${width}.png`,
      fullPage: true,
    });
    await page.goto("http://localhost:3000/settings/reminders");
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    if (width >= 1440)
      assert.ok(
        (await page.locator(".settings-workspace").boundingBox()).width >= 1400,
      );
    await page.screenshot({
      path: `docs/screenshots/desktop-settings-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 1000 });
  await gotoHome();
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
    main.getByRole("heading", { name: "Your day", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    main.getByRole("heading", { name: "Your day", exact: true }),
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
    main.getByRole("heading", { name: "Your day", exact: true }),
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
    "Desktop workspace checks passed: 1/2/3 card columns, fluid canvas, independent scrolling/pinned footer, wider drawer, draft retention, task/settings columns; Home regression: task navigation, shared context, customization/reload/reset/all-hidden, account isolation, last-list startup/explicit Home, exact retry, conflict draft recovery, failed-read recovery and 320/390/1280 layouts.",
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
