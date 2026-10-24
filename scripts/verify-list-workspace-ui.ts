// Optimized website; disposable data in the existing isolated development branch.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { scopes, defaultListView } from "@wuff/contracts";
import { database, members } from "@wuff/db";
import {
  createList,
  createTask,
  getList,
  deleteList,
  updateListView,
  updateTask,
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
  op = () => crypto.randomUUID(),
  ids: string[] = [];
const browser = await chromium.launch({ headless: true, channel: "chrome" }),
  errors: string[] = [];
let testPage: any;
try {
  let work = await createList(actor, {
    title: "Release planning",
    mode: "work",
    operationId: op(),
  });
  ids.push(work.id);
  let basic = await createList(actor, {
    title: "Weekend errands",
    operationId: op(),
  });
  ids.push(basic.id);
  await database()
    .db.insert(members)
    .values({ listId: work.id, userId: other.id });
  for (const data of [
    {
      title: "Check sign-in recovery",
      status: "blocked",
      priority: "high",
      assigneeId: user.id,
      dueDate: "2026-10-24",
    },
    { title: "Prepare release notes" },
    {
      title:
        "Review the longer task title for responsive column alignment and keyboard navigation across every available field",
      completed: true,
    },
  ])
    work = await createTask(actor, {
      listId: work.id,
      version: work.version,
      operationId: op(),
      ...data,
    });
  for (let index = 1; index <= 6; index++)
    work = await createTask(actor, {
      listId: work.id,
      version: work.version,
      title: `Release follow-up ${index}`,
      operationId: op(),
    });
  basic = await createTask(actor, {
    listId: basic.id,
    version: basic.version,
    title: "Pick up coffee",
    operationId: op(),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
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
  testPage = page;
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e: Error) => errors.push(e.message));
  const go = async (id: string) => {
    await page.goto(`http://localhost:3000/lists?listId=${id}`);
    await expect(
      page.getByRole("heading", {
        name: id === work.id ? "Release planning" : "Weekend errands",
        exact: true,
      }),
    ).toBeVisible();
  };
  const tool = (name: string) =>
    page.getByRole("button", { name, exact: true });
  const panel = (name: string) =>
    page.getByRole(
      page.viewportSize()!.width < 768 &&
        ["Filter", "Sort", "Group", "Display", "Presets"].includes(name)
        ? "region"
        : "dialog",
      { name, exact: true },
    );
  const open = async (name: string) => {
    const trigger = page.getByRole("button", {
      name: /^View(?: · \d+)?(?: Unsaved changes)?$/,
    });
    if (page.viewportSize()!.width < 768) {
      await expect(trigger).toBeVisible();
      if (
        !(await page
          .getByRole("dialog", { name: "Your view", exact: true })
          .isVisible())
      )
        await trigger.click();
    } else {
      await expect(trigger).toHaveCount(0);
    }
    await tool(name).click();
    await expect(panel(name)).toBeVisible();
    return panel(name);
  };
  const done = async (p: any) => {
    await p
      .getByRole("button", {
        name: page.viewportSize()!.width < 768 ? "Back to view" : "Done",
        exact: true,
      })
      .click();
    await expect(p).not.toBeVisible();
  };
  const save = async () => {
    await tool("Save view").click();
    await expect(tool("Save view")).toHaveCount(0);
  };
  const task = work.tasks.find((t) => t.title === "Check sign-in recovery")!;
  const row = () => page.locator(`[data-task-id="${task.id}"]`);
  await go(work.id);
  for (const width of [320, 390, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width < 768)
      await expect(page.locator(".mobile-view-trigger")).toBeVisible();
    else await expect(page.locator(".mobile-view-trigger")).toHaveCount(0);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `no overflow ${width}`,
    );
    assert.equal(
      await page.locator(".work-column-headings").isVisible(),
      width >= 1440,
    );
    const d = await open("Display");
    await expect
      .poll(() =>
        d.evaluate((el: HTMLElement) => {
          const box = el.getBoundingClientRect();
          return box.left >= 0 && box.right <= innerWidth;
        }),
      )
      .toBe(true);
    await page.screenshot({
      path: `.vercel/mobile-task-first/workspace-display-${width}.png`,
      fullPage: true,
    });
    await done(d);
    if (width < 768) {
      await tool("Close view options").click();
      const firstTask = await row().boundingBox();
      assert.ok(
        firstTask && firstTask.y < 260,
        `tasks near top at ${width}: ${firstTask?.y}`,
      );
      await tool("List settings").click();
      const settings = panel("List settings");
      await expect(
        settings.getByRole("textbox", { name: "List name", exact: true }),
      ).toBeVisible();
      await expect(
        settings.getByRole("button", { name: "Delete list", exact: true }),
      ).toBeVisible();
      await settings
        .getByRole("button", { name: "Share", exact: true })
        .click();
      await expect(panel("Share with your pack")).toBeVisible();
      await tool("Close sharing").click();
      await expect(settings).toBeVisible();
      await tool("Close list settings").click();
    }
    await page.screenshot({
      path: `.vercel/mobile-task-first/workspace-work-${width}.png`,
      fullPage: true,
    });
  }
  // Phone settings, destructive confirmation, preview/save and focus restoration.
  await page.setViewportSize({ width: 390, height: 844 });
  await tool("List settings").click();
  const settings = panel("List settings");
  await page.screenshot({
    path: "docs/screenshots/mobile-task-first-settings-390.png",
  });
  const longTitle =
    "Release planning with a much longer list name that stays on one line";
  await settings
    .getByRole("textbox", { name: "List name", exact: true })
    .fill(longTitle);
  await settings
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(settings).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: longTitle, exact: true }),
  ).toBeVisible();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await tool("List settings").click();
  page.once("dialog", async (dialog: any) => {
    assert.match(dialog.message(), /cannot be undone/);
    await dialog.dismiss();
  });
  await settings
    .getByRole("button", { name: "Delete list", exact: true })
    .click();
  assert.equal((await getList(actor, work.id)).title, longTitle);
  await settings
    .getByRole("textbox", { name: "List name", exact: true })
    .fill("Release planning");
  await settings
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search title or key", exact: true })
    .fill("sign-in");
  const phoneView = page.getByRole("button", { name: /^View/ });
  await phoneView.click();
  await page.screenshot({
    path: "docs/screenshots/mobile-task-first-view-390.png",
  });
  await expect(panel("Your view")).toContainText("Unsaved changes");
  let phoneLost = true;
  const phoneBodies: string[] = [];
  await page.route("**/api/v1/lists/*/view", async (route: any) => {
    if (route.request().method() !== "PUT") return route.continue();
    phoneBodies.push(route.request().postData());
    if (phoneLost) {
      phoneLost = false;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      await route.abort("failed");
    } else await route.continue();
  });
  await tool("Save view").click();
  await expect(panel("Your view")).toContainText(
    "We couldn’t confirm your previous change",
  );
  await panel("Your view")
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(tool("Save view")).toHaveCount(0);
  assert.equal(phoneBodies.length, 2);
  assert.equal(phoneBodies[0], phoneBodies[1]);
  await page.unroute("**/api/v1/lists/*/view");
  await tool("Close view options").click();
  await expect(phoneView).toBeFocused();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Search title or key", exact: true }),
  ).toHaveValue("sign-in");
  await phoneView.click();
  await page
    .getByRole("button", { name: "Clear Search: sign-in", exact: true })
    .click();
  await save();
  await tool("Close view options").click();
  await page.screenshot({
    path: "docs/screenshots/mobile-task-first-390.png",
    fullPage: true,
  });
  const firstTaskTop = (await row().boundingBox())!.y;
  console.log(`Phone 390x844: first task y=${firstTaskTop}px`);
  await page.setViewportSize({ width: 390, height: 640 });
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect
    .poll(async () =>
      Math.round((await page.locator(".list-heading").boundingBox())!.y),
    )
    .toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.setViewportSize({ width: 1440, height: 500 });
  await page.locator(".workspace-main").hover();
  await page.mouse.wheel(0, 800);
  await expect
    .poll(() =>
      page
        .locator(".workspace-main")
        .evaluate((el: HTMLElement) => el.scrollTop),
    )
    .toBeGreaterThan(0);
  const sticky = await page.evaluate(() => ({
    toolbar: document
      .querySelector(".workspace-view-toolbar")!
      .getBoundingClientRect()
      .toJSON(),
    header: document
      .querySelector(".work-column-headings")!
      .getBoundingClientRect()
      .toJSON(),
    height: document.documentElement.scrollHeight,
  }));
  const listHeader = await page.locator(".list-heading").boundingBox();
  assert.ok(listHeader && Math.abs(listHeader.y) <= 1);
  assert.ok(sticky.toolbar.top >= listHeader.y + listHeader.height - 1);
  assert.ok(sticky.header.top >= sticky.toolbar.bottom - 1);
  assert.equal(sticky.height, 500);
  await page.screenshot({
    path: ".vercel/mobile-task-first/workspace-sticky.png",
    fullPage: true,
  });
  await page
    .locator(".workspace-main")
    .evaluate((el: HTMLElement) => el.scrollTo(0, 0));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const original = await getList(actor, work.id);
  let p = await open("Filter");
  await p
    .getByRole("combobox", { name: "Status filter", exact: true })
    .selectOption("blocked");
  await done(p);
  await expect(
    page.getByRole("status").filter({ hasText: "1 of 9 tasks shown" }),
  ).toBeVisible();
  assert.equal(
    (await getList(actor, work.id)).personalView.version,
    original.personalView.version,
  );
  await save();
  assert.deepEqual((await getList(actor, work.id)).tasks, original.tasks);
  await page
    .getByRole("textbox", { name: "Search title or key", exact: true })
    .fill("sign-in");
  p = await open("Presets");
  await p.getByRole("button", { name: "Save as preset…", exact: true }).click();
  await p
    .getByRole("textbox", { name: "Preset name", exact: true })
    .fill("Release focus");
  await p.getByRole("button", { name: "Save preset", exact: true }).click();
  await expect(
    p.getByRole("textbox", { name: "Preset name", exact: true }),
  ).toHaveCount(0);
  await done(p);
  let stored = await getList(actor, work.id);
  const preset = stored.personalView.view.presets[0];
  assert.equal(preset.name, "Release focus");
  assert.deepEqual(
    (await getList({ id: other.id, scopes }, work.id)).personalView.view
      .presets,
    [],
  );
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Saved preset", exact: true }),
  ).toHaveValue(preset.id);
  p = await open("Presets");
  await p.getByRole("button", { name: "Rename preset", exact: true }).click();
  await p
    .getByRole("textbox", { name: "Preset name", exact: true })
    .fill("My release focus");
  await p.getByRole("button", { name: "Save preset", exact: true }).click();
  await expect(
    p.getByRole("textbox", { name: "Preset name", exact: true }),
  ).toHaveCount(0);
  await done(p);
  p = await open("Display");
  await p
    .getByRole("button", { name: "Reset to defaults", exact: true })
    .click();
  await done(p);
  await save();
  await page
    .getByRole("combobox", { name: "Saved preset", exact: true })
    .selectOption(preset.id);
  await expect(
    page.getByRole("textbox", { name: "Search title or key", exact: true }),
  ).toHaveValue("sign-in");
  await save();
  await page
    .getByRole("combobox", { name: "Saved preset", exact: true })
    .selectOption("default");
  await save();
  // Shared metadata cells have explicit saves; view configuration remains personal.
  await page
    .getByRole("combobox", { name: "Saved preset", exact: true })
    .selectOption("blocked");
  await save();
  for (const [field, value, server] of [
    ["status", "in_progress", "status"],
    ["priority", "urgent", "priority"],
    ["assignee", other.id, "assigneeId"],
    ["due date", "2026-10-27", "dueDate"],
  ] as const) {
    await row()
      .getByRole("button", {
        name: `Edit ${field} for ${task.title}`,
        exact: true,
      })
      .click();
    const cell = panel(`Edit ${field} for ${task.title}`);
    await expect(cell).toBeVisible();
    if (field === "due date")
      await cell
        .getByLabel(`Due date for ${task.title}`, { exact: true })
        .fill(value);
    else await cell.getByRole("combobox").selectOption(value);
    await cell
      .getByRole("button", { name: `Save ${field}`, exact: true })
      .click();
    await expect(cell).not.toBeVisible();
    assert.equal(
      (await getList(actor, work.id)).tasks.find((t) => t.id === task.id)![
        server
      ],
      value,
    );
    if (field === "status") {
      await expect(row()).toHaveCount(0);
      await page
        .getByRole("combobox", { name: "Saved preset", exact: true })
        .selectOption("default");
      await save();
    }
  }
  // A conflicting cell save retains the field draft until explicit reload.
  await row()
    .getByRole("button", {
      name: `Edit priority for ${task.title}`,
      exact: true,
    })
    .click();
  let cell = panel(`Edit priority for ${task.title}`);
  await cell.getByRole("combobox").selectOption("low");
  stored = await getList(actor, work.id);
  await updateTask(actor, {
    listId: work.id,
    taskId: task.id,
    version: stored.version,
    title: task.title,
    operationId: op(),
  });
  await cell
    .getByRole("button", { name: "Save priority", exact: true })
    .click();
  await expect(cell.getByRole("alert")).toContainText("Your draft is kept");
  await expect(cell.getByRole("combobox")).toHaveValue("low");
  await cell
    .getByRole("button", { name: "Reload field values", exact: true })
    .click();
  await expect(cell.getByRole("combobox")).toHaveValue("urgent");
  await cell.getByRole("combobox").press("Escape");
  await expect(cell).not.toBeVisible();
  // A filtered-out row restores its unsaved metadata field when it returns.
  await row()
    .getByRole("button", {
      name: `Edit priority for ${task.title}`,
      exact: true,
    })
    .click();
  cell = panel(`Edit priority for ${task.title}`);
  await cell.getByRole("combobox").selectOption("low");
  await cell.getByRole("combobox").press("Escape");
  await expect(cell).not.toBeVisible();
  p = await open("Filter");
  await p
    .getByRole("combobox", { name: "Status filter", exact: true })
    .selectOption("blocked");
  await done(p);
  await expect(row()).toHaveCount(0);
  await tool("Revert to saved view").click();
  await row()
    .getByRole("button", {
      name: `Edit priority for ${task.title}`,
      exact: true,
    })
    .click();
  cell = panel(`Edit priority for ${task.title}`);
  await expect(cell.getByRole("combobox")).toHaveValue("low");
  await cell.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(cell).not.toBeVisible();
  // Column visibility / simpler rows persist personally and preserve cell drafts.
  p = await open("Display");
  await p.getByRole("checkbox", { name: "assignee", exact: true }).uncheck();
  await done(p);
  await save();
  await page.reload();
  await expect(row().locator(".work-cell-assignee")).not.toBeVisible();
  p = await open("Display");
  await p
    .getByRole("combobox", { name: "Row layout", exact: true })
    .selectOption("list");
  await done(p);
  await expect(page.locator(".work-column-headings")).toHaveCount(0);
  await save();
  p = await open("Display");
  await p
    .getByRole("combobox", { name: "Row layout", exact: true })
    .selectOption("columns");
  await done(p);
  await save();
  // Note draft survives a layout change and phone resize.
  await row().hover();
  await row()
    .getByRole("button", {
      name: `Quick add notes for ${task.title}`,
      exact: true,
    })
    .click();
  const editor = row().locator('[contenteditable="true"]');
  await editor.fill("Keep this unsaved note while changing layout");
  p = await open("Display");
  await p
    .getByRole("combobox", { name: "Row density", exact: true })
    .selectOption("detailed");
  await done(p);
  await expect(editor).toContainText("Keep this unsaved note");
  await tool("Revert to saved view").click();
  await page.setViewportSize({ width: 390, height: 1000 });
  await expect(editor).toContainText("Keep this unsaved note");
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Saved-view conflicts keep the local preview and require explicit recovery.
  await page
    .getByRole("textbox", { name: "Search title or key", exact: true })
    .fill("draft kept");
  stored = await getList(actor, work.id);
  await updateListView(actor, {
    listId: work.id,
    viewVersion: stored.personalView.version,
    view: { ...stored.personalView.view, layout: "detailed" },
    operationId: op(),
  });
  await tool("Save view").click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Your view changed elsewhere" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Search title or key", exact: true }),
  ).toHaveValue("draft kept");
  await tool("Revert to saved view").click();
  // A lost response retries exactly the original operation and payload.
  let first = true;
  const bodies: string[] = [];
  await page.route("**/api/v1/lists/*/view", async (route: any) => {
    if (route.request().method() !== "PUT") return route.continue();
    bodies.push(route.request().postData());
    if (first) {
      first = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  p = await open("Sort");
  await p
    .getByRole("combobox", { name: "Sort by", exact: true })
    .selectOption("due");
  await done(p);
  await tool("Save view").click();
  await expect(tool("Retry same request")).toBeVisible();
  await tool("Retry same request").click();
  await expect(tool("Retry same request")).toHaveCount(0);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  await page.unroute("**/api/v1/lists/*/view");
  // Presets can be deleted explicitly without changing any task.
  if (await tool("Revert to saved view").isVisible())
    await tool("Revert to saved view").click();
  await page
    .getByRole("combobox", { name: "Saved preset", exact: true })
    .selectOption(preset.id);
  await save();
  p = await open("Presets");
  await p.getByRole("button", { name: "Delete preset", exact: true }).click();
  await p
    .getByRole("button", { name: "Confirm delete preset", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Confirm delete preset", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Saved preset", exact: true }),
  ).toBeEnabled();
  await expect(tool("Save view")).toHaveCount(0);
  await done(p);
  assert.deepEqual(
    (await getList(actor, work.id)).personalView.view.presets,
    [],
  );
  await go(basic.id);
  for (const width of [320, 390, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.locator(".work-column-headings").count(), 0);
    p = await open("Filter");
    await expect(
      p.getByRole("combobox", { name: "Status filter", exact: true }),
    ).toHaveCount(0);
    await done(p);
    if (width < 768) await tool("Close view options").click();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `.vercel/mobile-task-first/workspace-basic-${width}.png`,
      fullPage: true,
    });
  }
  const editorContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const editorLogin = await editorContext.request.post(
    "http://localhost:3000/api/auth/sign-in/email",
    {
      headers: { Origin: "http://localhost:3000" },
      data: { email: other.email, password: other.password },
    },
  );
  assert.equal(editorLogin.status(), 200);
  const editorPage = await editorContext.newPage();
  await editorPage.goto(`http://localhost:3000/lists?listId=${work.id}`);
  await editorPage
    .getByRole("button", { name: "List settings", exact: true })
    .click();
  const editorSettings = editorPage.getByRole("dialog", {
    name: "List settings",
    exact: true,
  });
  await expect(
    editorSettings.getByRole("button", { name: "People", exact: true }),
  ).toBeVisible();
  await expect(
    editorSettings.getByRole("textbox", { name: "List name", exact: true }),
  ).toHaveCount(0);
  await expect(
    editorSettings.getByRole("button", { name: "Delete list", exact: true }),
  ).toHaveCount(0);
  await expect(
    editorSettings.getByRole("button", { name: "Archive list", exact: true }),
  ).toHaveCount(0);
  await editorContext.close();
  assert.deepEqual(errors, []);
  console.log(
    "List workspace: responsive Work/basic toolbar and columns, preview/save/reload, named preset create/rename/select/delete, personal isolation, metadata saves/conflict drafts, display preferences, note draft retention, view conflicts and exact retry passed.",
  );
} catch (error) {
  await testPage?.screenshot({
    path: ".vercel/workspace-failure.png",
    fullPage: true,
  });
  console.error(
    await testPage?.locator("[popover]:popover-open").allTextContents(),
  );
  throw error;
} finally {
  await browser.close();
  for (const id of ids) {
    const l = await getList(actor, id);
    await deleteList(actor, {
      listId: id,
      version: l.version,
      operationId: op(),
    });
  }
  await database().pool.end();
}
