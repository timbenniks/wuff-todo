// Actual optimized website; existing isolated development services and synthetic accounts only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import {
  scopes,
  defaultDashboardSettings,
  defaultListView,
} from "@wuff/contracts";
import { database, dashboardPreferences, members } from "@wuff/db";
import {
  createList,
  createTask,
  createSection,
  getList,
  deleteList,
  updateTask,
  updateListView,
  getDashboardPreferences,
  updateDashboard,
  removeListMember,
} from "@wuff/domain";
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
  owner = { id: other.id, scopes },
  op = () => crypto.randomUUID();
const ids: { id: string; actor: typeof actor }[] = [];
const [originalPrefs] = await database()
  .db.select()
  .from(dashboardPreferences)
  .where(eq(dashboardPreferences.userId, actor.id));
const otherPrefs = await getDashboardPreferences(owner);
const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Paris",
}).format(new Date());
const browser = await chromium.launch({ headless: true, channel: "chrome" });
let page: any;
const errors: string[] = [];
try {
  await updateDashboard(actor, {
    ...(await getDashboardPreferences(actor)),
    settings: defaultDashboardSettings,
    operationId: op(),
  });
  let work = await createList(actor, {
    title: "Phase 3 release planning",
    mode: "work",
    operationId: op(),
  });
  ids.push({ id: work.id, actor });
  let basic = await createList(actor, {
    title: "Phase 3 weekend errands",
    operationId: op(),
  });
  ids.push({ id: basic.id, actor });
  let shared = await createList(owner, {
    title: "Phase 3 shared family plans",
    operationId: op(),
  });
  ids.push({ id: shared.id, actor: owner });
  let privateList = await createList(owner, {
    title: "Phase 3 private other account",
    operationId: op(),
  });
  ids.push({ id: privateList.id, actor: owner });
  await database()
    .db.insert(members)
    .values({ listId: shared.id, userId: actor.id });
  work = await createSection(actor, {
    listId: work.id,
    version: work.version,
    title: "Release",
    operationId: op(),
  });
  for (const data of [
    { title: "Review release from Home", status: "in_review", dueDate: today },
    {
      title: "Previously completed release task",
      status: "done",
      sectionId: work.sections[0].id,
    },
    { title: "File old notes", status: "done" },
    { title: "Completed parent with open child", status: "done" },
  ])
    work = await createTask(actor, {
      listId: work.id,
      version: work.version,
      operationId: op(),
      ...data,
    });
  const parent = work.tasks.find(
    (t) => t.title === "Completed parent with open child",
  )!;
  work = await createTask(actor, {
    listId: work.id,
    version: work.version,
    parentTaskId: parent.id,
    title: "Independent child due today",
    dueDate: today,
    operationId: op(),
  });
  shared = await createTask(owner, {
    listId: shared.id,
    version: shared.version,
    title: "Shared Home task",
    dueDate: today,
    operationId: op(),
  });
  privateList = await createTask(owner, {
    listId: privateList.id,
    version: privateList.version,
    title: "Private task must never appear",
    dueDate: today,
    operationId: op(),
  });
  await updateListView(actor, {
    listId: basic.id,
    viewVersion: 0,
    view: { ...defaultListView(), search: "saved-filter-hides-new-task" },
    operationId: op(),
  });
  const workTask = work.tasks.find(
    (t) => t.title === "Review release from Home",
  )!;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
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
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e: Error) => errors.push(e.message));
  const goHome = async () => {
    await page.goto("http://localhost:3000/lists?home=1");
    await expect(
      page.getByRole("heading", { name: "Your day", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Customize Home", exact: true }),
    ).toBeEnabled();
  };
  const homeRow = (id: string) => page.locator(`[data-home-task-id="${id}"]`);
  await goHome();
  await expect(homeRow(workTask.id)).toBeVisible();
  await expect(
    page.getByText("Private task must never appear", { exact: true }),
  ).toHaveCount(0);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    if (width >= 768)
      await expect(
        page.locator(".desktop-list-navigation .sidebar-home"),
      ).toBeVisible();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const bounds = (await page
      .locator(".home-actionable .task-capture-trigger")
      .boundingBox())!;
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 844);
    assert.ok(
      (await homeRow(workTask.id)
        .getByRole("button", {
          name: `Complete ${workTask.title}`,
          exact: true,
        })
        .boundingBox())!.height >= 44,
    );
    await page.screenshot({
      path: `docs/screenshots/ux-phase-three-home-${width}.png`,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await homeRow(workTask.id)
    .getByRole("link", { name: `Open task: ${workTask.title}`, exact: true })
    .click();
  const drawer = page.getByRole("dialog", {
    name: "Task details",
    exact: true,
  });
  await expect(drawer).toBeVisible();
  assert.match(page.url(), /home=1/);
  await drawer
    .getByRole("button", { name: "Close task details", exact: true })
    .click();
  await expect(homeRow(workTask.id).getByRole("link")).toBeFocused();
  assert.equal(
    (await getList(actor, work.id)).tasks.find((t) => t.id === workTask.id)!
      .completed,
    false,
  );
  // Confirm only acknowledged completion; exact retry reconciles a committed lost response.
  let lost = true;
  const completionBodies: string[] = [];
  await page.route("**/api/v1/tasks", async (route: any) => {
    if (route.request().method() !== "PATCH") return route.continue();
    completionBodies.push(route.request().postData());
    if (lost) {
      lost = false;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      await route.abort("failed");
    } else await route.continue();
  });
  await homeRow(workTask.id)
    .getByRole("button", { name: `Complete ${workTask.title}`, exact: true })
    .click();
  await expect(
    page
      .locator(".home-actionable")
      .getByRole("button", { name: "Retry same request", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Recently completed", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".home-actionable")
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  const reopen = page.getByRole("button", {
    name: `Reopen ${workTask.title}`,
    exact: true,
  });
  await expect(reopen).toBeVisible();
  await expect(homeRow(workTask.id)).toHaveCount(0);
  assert.equal(completionBodies.length, 2);
  assert.equal(completionBodies[0], completionBodies[1]);
  let latest = await getList(actor, work.id);
  assert.equal(latest.tasks.find((t) => t.id === workTask.id)!.status, "done");
  await page.unroute("**/api/v1/tasks");
  await expect(
    page.getByRole("button", { name: `Reopen ${workTask.title}`, exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "docs/screenshots/ux-phase-three-reopen-390.png",
  });
  await reopen.click();
  await expect(homeRow(workTask.id)).toBeVisible();
  await expect(homeRow(workTask.id).getByRole("button")).toBeFocused();
  latest = await getList(actor, work.id);
  assert.equal(
    latest.tasks.find((t) => t.id === workTask.id)!.completed,
    false,
  );
  // A failed completion remains available and is never announced as completed.
  await page.route("**/api/v1/tasks", (route: any) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "conflict",
              message: "Synthetic concurrent change. Try again.",
            },
          }),
        })
      : route.continue(),
  );
  await homeRow(workTask.id).getByRole("button").click();
  await expect(
    page.locator(".home-actionable").getByRole("alert"),
  ).toBeVisible();
  await expect(homeRow(workTask.id)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Recently completed", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/v1/tasks");
  // Capture keeps its title across list changes and offers recovery from a failed destination read.
  await page.locator(".home-actionable .task-capture-trigger").click();
  const capture = page.getByRole("dialog", { name: "Add task", exact: true });
  const name = capture.getByRole("textbox", { name: "Task name", exact: true });
  await expect(name).toBeFocused();
  await name.fill("Capture from Home exactly once");
  await expect(
    capture.getByRole("combobox", { name: "Destination list", exact: true }),
  ).toHaveValue("");
  await expect(
    capture.getByRole("button", { name: "Add task", exact: true }),
  ).toBeDisabled();
  await expect(
    capture.locator(`option[value="${privateList.id}"]`),
  ).toHaveCount(0);
  let failRead = true;
  await page.route(`**/api/v1/lists/${basic.id}`, (route: any) => {
    if (failRead && route.request().method() === "GET") {
      failRead = false;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "temporary",
            message: "List temporarily unavailable.",
          },
        }),
      });
    }
    return route.continue();
  });
  await capture
    .getByRole("combobox", { name: "Destination list", exact: true })
    .selectOption(basic.id);
  await expect(
    capture.getByRole("button", { name: "Retry list details", exact: true }),
  ).toBeVisible();
  await capture
    .getByRole("button", { name: "Retry list details", exact: true })
    .click();
  await expect(
    capture.getByRole("button", { name: "Add task", exact: true }),
  ).toBeEnabled();
  await capture
    .getByRole("combobox", { name: "Destination list", exact: true })
    .selectOption(work.id);
  await expect(
    capture.getByRole("combobox", { name: "Section", exact: true }),
  ).toBeVisible();
  await capture
    .getByRole("combobox", { name: "Section", exact: true })
    .selectOption(work.sections[0].id);
  await capture
    .getByRole("combobox", { name: "Destination list", exact: true })
    .selectOption(basic.id);
  await expect(name).toHaveValue("Capture from Home exactly once");
  await expect(
    capture.getByRole("button", { name: "Add task", exact: true }),
  ).toBeEnabled();
  await page.unroute(`**/api/v1/lists/${basic.id}`);
  let captureLost = true;
  const captureBodies: string[] = [];
  await page.route("**/api/v1/tasks", async (route: any) => {
    if (route.request().method() !== "POST") return route.continue();
    captureBodies.push(route.request().postData());
    if (captureLost) {
      captureLost = false;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      await route.abort("failed");
    } else await route.continue();
  });
  await page.screenshot({
    path: "docs/screenshots/ux-phase-three-capture-390.png",
  });
  await capture.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    capture.getByRole("button", { name: "Retry same request", exact: true }),
  ).toBeVisible();
  await expect(name).toHaveValue("Capture from Home exactly once");
  await capture
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(capture).not.toBeVisible();
  assert.equal(captureBodies.length, 2);
  assert.equal(captureBodies[0], captureBodies[1]);
  latest = await getList(actor, basic.id);
  assert.equal(
    latest.tasks.filter((t) => t.title === "Capture from Home exactly once")
      .length,
    1,
  );
  assert.equal(latest.tasks[0].sectionId, null);
  await page.unroute("**/api/v1/tasks");
  await expect(page.getByText(/New tasks have no due date/)).toBeVisible();
  await page.getByRole("button", { name: "Open list", exact: true }).click();
  await expect(page.getByText(/No tasks match your search/)).toBeVisible();
  assert.equal(
    (await getList(actor, basic.id)).personalView!.view.search,
    "saved-filter-hides-new-task",
  );
  // Default completed presentation changes no preference; active children retain their parent.
  await page.goto(`http://localhost:3000/lists?listId=${work.id}`);
  await expect(page.locator(".list-heading h1")).toHaveText(work.title);
  const completed = page.locator(".completed-task-group");
  await expect(completed).not.toHaveAttribute("open");
  await expect(page.locator(`[data-task-id="${parent.id}"]`)).toBeVisible();
  const done = work.tasks.find(
    (t) => t.title === "Previously completed release task",
  )!;
  await expect(page.locator(`[data-task-id="${done.id}"]`)).not.toBeVisible();
  const beforeGroup = await getList(actor, work.id);
  assert.equal(beforeGroup.personalView!.version, 0);
  await completed.locator("summary").click();
  await expect(
    completed.getByRole("link", {
      name: `Open completed task: ${done.title}`,
      exact: true,
    }),
  ).toBeVisible();
  await completed.scrollIntoViewIfNeeded();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: "docs/screenshots/ux-phase-three-completed-390.png",
  });
  await completed
    .getByRole("button", { name: `Reopen ${done.title}`, exact: true })
    .click();
  await expect(page.locator(`[data-task-id="${done.id}"]`)).toBeVisible();
  await expect(
    page.locator(`[data-task-id="${done.id}"] .task-name a`),
  ).toBeFocused();
  latest = await getList(actor, work.id);
  const restored = latest.tasks.find((t) => t.id === done.id)!;
  assert.equal(restored.sectionId, work.sections[0].id);
  assert.equal(restored.completed, false);
  assert.deepEqual(latest.personalView, beforeGroup.personalView);
  // Explicit completion-only views remain explicit rather than becoming collapsed groups.
  await updateListView(actor, {
    listId: work.id,
    viewVersion: 0,
    view: { ...defaultListView(), completed: "only" },
    operationId: op(),
  });
  await page.reload();
  await expect(page.locator(".completed-task-group")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open task: File old notes", exact: true }),
  ).toBeVisible();
  await updateListView(actor, {
    listId: work.id,
    viewVersion: 1,
    view: defaultListView(),
    operationId: op(),
  });
  // Live/fallback invalidation refreshes Home after another authorized actor's domain write.
  await goHome();
  latest = await getList(actor, work.id);
  await updateTask(actor, {
    listId: work.id,
    version: latest.version,
    taskId: workTask.id,
    title: "Remote change appears on Home",
    operationId: op(),
  });
  await page.evaluate(() => dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("link", {
      name: "Open task: Remote change appears on Home",
      exact: true,
    }),
  ).toBeVisible();
  // Revoked destinations disappear without losing a capture draft or offering a write.
  await page.locator(".home-actionable .task-capture-trigger").click();
  await name.fill("Keep draft after membership removal");
  await capture
    .getByRole("combobox", { name: "Destination list", exact: true })
    .selectOption(shared.id);
  await expect(
    capture.getByRole("button", { name: "Add task", exact: true }),
  ).toBeEnabled();
  const sharedNow = await getList(owner, shared.id);
  await removeListMember(owner, {
    listId: shared.id,
    version: sharedNow.version,
    userId: actor.id,
    operationId: op(),
  });
  await page.evaluate(() => dispatchEvent(new Event("focus")));
  await expect(capture.locator(`option[value="${shared.id}"]`)).toHaveCount(0);
  await expect(name).toHaveValue("Keep draft after membership removal");
  await expect(
    capture.getByRole("button", { name: "Add task", exact: true }),
  ).toBeDisabled();
  await capture.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.deepEqual(await getDashboardPreferences(owner), otherPrefs);
  assert.deepEqual(errors, []);
  console.log(
    "UX Phase 3 passed: actionable responsive Home, independent detail/completion, acknowledged completion/reopen, exact completion/capture retries, destination failure/switch/revocation draft retention, filtered creation, completed-group preferences/children/reopen, explicit completed view and remote refresh/account isolation.",
  );
} catch (error) {
  await page?.screenshot({
    path: ".vercel/ux-phase-three-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
  for (const fixture of ids.reverse()) {
    const list = await getList(fixture.actor, fixture.id);
    await deleteList(fixture.actor, {
      listId: list.id,
      version: list.version,
      operationId: op(),
    });
  }
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
