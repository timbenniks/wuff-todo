// Optimized local website; disposable synthetic data in isolated development only.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import { scopes, defaultDashboardSettings } from "@wuff/contracts";
import { database, dashboardPreferences } from "@wuff/db";
import {
  createList,
  createTask,
  getList,
  deleteList,
  getListOrder,
  reorderLists,
  getDashboardPreferences,
  updateDashboard,
  inviteToList,
  listInvitations,
  respondToInvitation,
  removeListMember,
} from "@wuff/domain";
import { setTimeout as delay } from "node:timers/promises";

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
  owner = { id: other.id, scopes };
const op = () => crypto.randomUUID();
const origin = "http://localhost:3000";
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Paris",
}).format(new Date());
const tomorrow = new Date(today + "T12:00:00Z");
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const originalOrder = await getListOrder(actor);
const [originalPrefs] = await database()
  .db.select()
  .from(dashboardPreferences)
  .where(eq(dashboardPreferences.userId, actor.id));
const otherPrefs = await getDashboardPreferences(owner);
const ids: { id: string; actor: typeof actor }[] = [];
const errors: string[] = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function signIn(context: any, fixture = user) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await context.request.post(
      origin + "/api/auth/sign-in/email",
      {
        headers: { Origin: origin },
        data: { email: fixture.email, password: fixture.password },
      },
    );
    if (response.status() === 429 && attempt < 3) {
      const seconds = Number(response.headers()["retry-after"]);
      await delay(Math.max(5, Math.min(30, seconds || 15)) * 1000);
      continue;
    }
    assert.equal(response.status(), 200, "Synthetic development sign-in");
    return;
  }
}
try {
  let list = await createList(actor, {
    title: "Empire family plans",
    operationId: op(),
  });
  ids.push({ id: list.id, actor });
  for (let i = 0; i < 6; i++)
    list = await createTask(actor, {
      listId: list.id,
      version: list.version,
      title: `Empire today ${i + 1}`,
      dueDate: today,
      operationId: op(),
    });
  list = await createTask(actor, {
    listId: list.id,
    version: list.version,
    title: "Empire tomorrow " + "a".repeat(170),
    dueDate: tomorrow.toISOString().slice(0, 10),
    operationId: op(),
  });
  let privateList = await createList(owner, {
    title: "Other account private sentinel",
    operationId: op(),
  });
  ids.push({ id: privateList.id, actor: owner });
  privateList = await createTask(owner, {
    listId: privateList.id,
    version: privateList.version,
    title: "Never show another account medicine sentinel",
    dueDate: today,
    operationId: op(),
  });
  let shared = await createList(owner, {
    title: "Empire shared fixture",
    operationId: op(),
  });
  ids.push({ id: shared.id, actor: owner });
  shared = await createTask(owner, {
    listId: shared.id,
    version: shared.version,
    title: "Empire shared access sentinel",
    dueDate: tomorrow.toISOString().slice(0, 10),
    operationId: op(),
  });
  await inviteToList(owner, {
    listId: shared.id,
    version: shared.version,
    email: user.email,
    operationId: op(),
  });
  const invitation = (await listInvitations(actor)).find(
    (i) => i.listId === shared.id,
  )!;
  await respondToInvitation(actor, {
    invitationId: invitation.id,
    accept: true,
    operationId: op(),
  });
  await reorderLists(actor, {
    ...(await getListOrder(actor)),
    favoriteListIds: [list.id],
    operationId: op(),
  });
  await updateDashboard(actor, {
    ...(await getDashboardPreferences(actor)),
    settings: { ...defaultDashboardSettings, startPage: "last_list" },
    operationId: op(),
  });
  await mkdir("docs/screenshots", { recursive: true });

  const anonymous = await browser.newContext();
  const anon = await anonymous.newPage();
  for (const path of [
    "/",
    "/totake",
    `/lists?listId=${list.id}`,
    `/tasks/${list.tasks[0].id}`,
  ]) {
    await anon.goto(origin + path);
    await expect(anon).toHaveURL(/\/sign-in\?next=/);
    const html = await anon.content();
    assert(!html.includes(list.title) && !html.includes(privateList.title));
  }
  await anon.goto(origin + "/docs");
  await expect(
    anon.getByRole("heading", { name: "Build features that belong in Wuff" }),
  ).toBeVisible();
  assert.equal(await anon.locator(".empire-header").count(), 0);
  await anonymous.close();

  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    timezoneId: "Europe/Paris",
  });
  await signIn(context);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error: Error) => errors.push(error.message));
  // An explicit portal visit must ignore Todo's saved last-list startup preference.
  await page.goto(origin + `/lists?listId=${list.id}`);
  await expect(page.locator(".list-heading h1")).toHaveText(list.title);
  await page
    .getByRole("link", { name: "Wuff Empire dashboard", exact: true })
    .click();
  await expect(page).toHaveURL(origin + "/");
  await expect(
    page.getByRole("heading", { name: /Welcome back/ }),
  ).toBeVisible();
  assert.equal(await page.locator(".workspace-sidebar").count(), 0);
  const upcoming = page.getByRole("region", { name: "Coming up", exact: true });
  await expect(upcoming).toContainText("Empire shared access sentinel");
  assert(!(await page.content()).includes(privateList.id));
  assert(
    !(await page.content()).includes(
      "Never show another account medicine sentinel",
    ),
  );
  const response = await context.request.get(
    origin + `/api/v1/dashboard?today=${today}&limit=5`,
  );
  assert.equal(response.status(), 200);
  const snapshot = await response.json();
  const todayRegion = page.getByRole("region", { name: "Today", exact: true });
  assert.equal(
    await todayRegion.locator("li").count(),
    snapshot.todayTasks.length,
  );
  await expect(
    todayRegion.getByLabel(`${snapshot.todayTotal} tasks`, { exact: true }),
  ).toBeVisible();
  const denied = await context.request.get(
    origin + `/api/v1/dashboard?today=${today}`,
    { headers: { "X-Wuff-User": other.id } },
  );
  assert.equal(denied.status(), 409);

  // Real membership revocation disappears through a fresh authorized read.
  shared = await getList(owner, shared.id);
  await removeListMember(owner, {
    listId: shared.id,
    version: shared.version,
    userId: actor.id,
    operationId: op(),
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(upcoming).not.toContainText("Empire shared access sentinel");

  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      page.getByRole("heading", { name: "From Wuff Todo" }),
    ).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `portal overflow at ${width}`,
    );
    await page.screenshot({
      path: `docs/screenshots/empire-dashboard-${width}.png`,
      fullPage: true,
    });
    if (width < 900) {
      const summary = page.locator(".empire-mobile-nav summary");
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".empire-mobile-nav nav")).toBeVisible();
      await page
        .getByRole("link", { name: "Wuff Totake", exact: true })
        .focus();
      await page.keyboard.press("Escape");
      await expect(summary).toBeFocused();
      await expect(page.locator(".empire-mobile-nav nav")).not.toBeVisible();
      await summary.click();
      await page
        .getByRole("link", { name: "Wuff Totake", exact: true })
        .click();
    } else {
      await page
        .getByRole("navigation", { name: "Apps", exact: true })
        .getByRole("link", { name: "Wuff Totake" })
        .click();
    }
    await expect(
      page.getByRole("heading", { name: "Daily overview", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Daily overview", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add", exact: true }),
    ).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.getByRole("link", { name: "Back to dashboard" }).click();
    await expect(
      page.getByRole("heading", { name: /Welcome back/ }),
    ).toBeVisible();
  }
  // Task links enter Todo; browser Back returns to the actual portal.
  const taskLink = todayRegion.locator("li a").first();
  const taskPath = await taskLink.getAttribute("href");
  await taskLink.click();
  await expect(page).toHaveURL(origin + taskPath);
  await expect(
    page.locator('.empire-desktop-nav a[aria-current="page"]'),
  ).toHaveText("Wuff Todo");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: /Welcome back/ }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Favorite lists" })
    .getByRole("link", { name: list.title })
    .click();
  await expect(page.locator(".list-heading h1")).toHaveText(list.title);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page).toHaveURL(/home=1/);
  await expect(
    page.getByRole("heading", { name: "Your day", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Wuff Empire dashboard", exact: true })
    .click();

  // Hold the actual endpoint briefly to inspect initial loading, then recover.
  await page.route("**/api/v1/dashboard?*", async (route: any) => {
    await delay(1200);
    await route.continue();
  });
  await page.reload();
  await expect(page.getByRole("status")).toContainText(
    "Fetching your Todo overview",
  );
  await expect(todayRegion).toBeVisible();
  await page.unroute("**/api/v1/dashboard?*");

  // One visible failure must clear the previous snapshot; the real endpoint recovers.
  let fail = true;
  await page.route("**/api/v1/dashboard?*", (route: any) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "unavailable", message: "Synthetic unavailable" },
          }),
        })
      : route.continue(),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "We couldn’t load your Todo overview",
  );
  assert.equal(await page.locator(".empire-preview").count(), 0);
  await page.screenshot({
    path: "docs/screenshots/empire-retry-1280.png",
    fullPage: true,
  });
  fail = false;
  await page.getByRole("button", { name: "Retry Todo overview" }).click();
  await expect(todayRegion).toBeVisible();
  await page.unroute("**/api/v1/dashboard?*");

  await updateDashboard(actor, {
    ...(await getDashboardPreferences(actor)),
    settings: {
      ...defaultDashboardSettings,
      hidden: ["today", "upcoming", "favorites"],
    },
    operationId: op(),
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByText("Your Todo overview sections are hidden."),
  ).toBeVisible();
  assert.equal(await page.locator(".empire-preview").count(), 0);
  await updateDashboard(actor, {
    ...(await getDashboardPreferences(actor)),
    settings: defaultDashboardSettings,
    operationId: op(),
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(todayRegion).toBeVisible();
  // Deliberately mock an authorized empty result to check UI, not backend filtering.
  await page.route("**/api/v1/dashboard?*", async (route: any) => {
    const actual = await route.fetch();
    const empty = await actual.json();
    await route.fulfill({
      response: actual,
      json: {
        ...empty,
        todayTasks: [],
        upcomingTasks: [],
        todayTotal: 0,
        upcomingTotal: 0,
        favorites: [],
      },
    });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(todayRegion).toContainText("No tasks due today or overdue");
  await expect(upcoming).toContainText("No tasks due in the next seven days");
  await page.unroute("**/api/v1/dashboard?*");

  await page.locator(".empire-account summary").click();
  await page
    .locator(".empire-account")
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings\/apps/);
  await expect(page.locator(".empire-header")).toBeVisible();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(origin + `/lists?listId=${list.id}`);
    await expect(page.locator(".list-heading h1")).toHaveText(list.title);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Todo overflow at ${width}`,
    );
    await page.screenshot({
      path: `docs/screenshots/empire-todo-${width}.png`,
      fullPage: true,
    });
    if (width >= 768) {
      const main = await page.locator(".workspace-main").boundingBox();
      const header = await page.locator(".empire-header").boundingBox();
      assert.equal(main.y, header.height);
      assert.equal(main.y + main.height, 1000);
    }
  }
  // Account menu failure remains retryable; success removes the private session.
  await page.locator(".empire-account summary").click();
  await page.route("**/api/auth/sign-out", (route: any) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Synthetic failure",
        code: "unavailable",
      }),
    }),
  );
  await page
    .locator(".empire-account")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(page.locator(".empire-account [role=alert]")).toHaveText(
    "Couldn’t sign out. Try again.",
  );
  await page.unroute("**/api/auth/sign-out");
  await page
    .locator(".empire-account")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto(origin + "/");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  assert.deepEqual(await getDashboardPreferences(owner), otherPrefs);
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    "Empire browser checks passed: authorized/anonymous/account isolation, real revocation, local-date bounded previews, portal/last-list separation, task/favorite/overview/history links, mobile menu keyboard/Escape, account settings/sign-out retry, hidden/empty/error/recovery, 320/390/1280 layouts. Empty/error responses were explicitly mocked; successful data and revocation used real development services.",
  );
} finally {
  await browser.close();
  for (const fixture of ids.reverse()) {
    const latest = await getList(fixture.actor, fixture.id);
    await deleteList(fixture.actor, {
      listId: latest.id,
      version: latest.version,
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
