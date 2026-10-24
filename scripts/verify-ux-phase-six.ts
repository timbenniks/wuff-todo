// Optimized local UI: auth mail/reset mocked; dates use disposable development data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { scopes, defaultListView } from "@wuff/contracts";
import { database } from "@wuff/db";
import {
  createList,
  createTask,
  getList,
  deleteList,
  updateTask,
  updateListView,
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
let page: any,
  id = "";
const errors: string[] = [];
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  page = await context.newPage();
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await page.clock.install();
  let codeRequests = 0,
    resets = 0,
    rateLimit = false;
  await page.route(
    "**/api/auth/email-otp/request-password-reset",
    async (route: any) => {
      codeRequests++;
      return route.fulfill({
        status: rateLimit ? 429 : 200,
        json: { success: !rateLimit },
      });
    },
  );
  await page.route(
    "**/api/auth/email-otp/reset-password",
    async (route: any) => {
      resets++;
      return route.fulfill({
        status: resets === 1 ? 400 : 200,
        json: { success: resets > 1 },
      });
    },
  );
  await page.goto("http://localhost:3000/set-password");
  await expect(
    page.getByRole("heading", {
      name: "Set or reset your password",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Your invited email", { exact: true })
    .fill("ux-recovery@example.invalid");
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  const code = page.getByLabel("Email code", { exact: true }),
    password = page.getByLabel("New password", { exact: true }),
    confirm = page.getByLabel("Confirm password", { exact: true });
  await expect(code).toBeFocused();
  await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  await code.fill("123 456");
  await expect(code).toHaveValue("123456");
  await password.fill("Synthetic-password-123");
  await expect(password).toHaveValue("Synthetic-password-123");
  await confirm.fill("Different-password-123");
  await page
    .getByRole("button", { name: "Save password", exact: true })
    .click();
  await expect(page.locator("form p[role=alert]")).toContainText("don’t match");
  assert.equal(resets, 0);
  await confirm.fill("Synthetic-password-123");
  await page
    .getByRole("button", { name: "Save password", exact: true })
    .click();
  await expect(page.locator("form p[role=alert]")).toContainText("expired");
  await expect(code).toHaveValue("123456");
  await expect(password).toHaveValue("Synthetic-password-123");
  await page.clock.fastForward(31000);
  await page.getByRole("button", { name: "Resend code", exact: true }).click();
  assert.equal(codeRequests, 2);
  await expect(code).toHaveValue("");
  await expect(password).toHaveValue("Synthetic-password-123");
  await page.getByRole("button", { name: "Change email", exact: true }).click();
  await expect(
    page.getByLabel("Your invited email", { exact: true }),
  ).toHaveValue("ux-recovery@example.invalid");
  rateLimit = true;
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await expect(page.locator("form p[role=alert]")).toContainText(
    "Too many code requests",
  );
  await page.clock.fastForward(61000);
  rateLimit = false;
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await code.fill("654321");
  await password.fill("Synthetic-password-456");
  await expect(password).toHaveValue("Synthetic-password-456");
  await confirm.fill("Synthetic-password-456");
  await page
    .getByRole("button", { name: "Save password", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Continue to sign in", exact: true }),
  ).toBeVisible();
  assert.equal(resets, 2);
  await page.route("**/api/auth/sign-in/email", (route: any) =>
    route.fulfill({
      status: 429,
      json: { code: "TOO_MANY_REQUESTS", message: "Too many attempts" },
    }),
  );
  await page.goto("http://localhost:3000/sign-in");
  await page
    .getByLabel("Email", { exact: true })
    .fill("ux-recovery@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-password-456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("form p[role=alert]")).toContainText(
    "Wait a minute",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "Synthetic-password-456",
  );
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute(
    "autocomplete",
    "username",
  );
  await page.screenshot({ path: "docs/screenshots/ux-phase-six-auth-390.png" });
  await page.clock.resume();
  // Compact guide, resources, palette scope, component search and exact build inputs.
  await page.goto("http://localhost:3000/docs");
  await expect(page.locator(".docs-palette")).toHaveCount(0);
  const resources = page.getByRole("complementary", {
    name: "Prototype resources",
    exact: true,
  });
  await expect(resources).toBeVisible();
  assert.ok((await resources.boundingBox())!.y < 400);
  await page.screenshot({
    path: "docs/screenshots/ux-phase-six-guide-start-390.png",
  });
  let copied = "";
  await page.evaluate(
    'Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (text) => { window.__copied = text; return Promise.resolve(); } } })',
  );
  await page
    .getByRole("button", { name: "Copy starter prompt", exact: true })
    .click();
  copied = await page.evaluate(() => (window as any).__copied);
  assert.match(copied, /actual components/);
  await expect(page.getByRole("status")).toContainText("Starter prompt copied");
  for (const path of [
    "/prototype-kit/wuff-prototype.zip",
    "/prototype-kit/wuff-prototype-skill.zip",
    "/prototype-kit/feature-brief.md",
    "/prototype-kit/source-manifest.json",
    "/docs/agent-context.md",
  ]) {
    const r = await context.request.get(`http://localhost:3000${path}`);
    assert.equal(r.status(), 200, path);
  }
  await page
    .getByRole("combobox", { name: "Guide page", exact: true })
    .selectOption("/docs/design");
  await expect(page.locator(".docs-palette")).toBeVisible();
  await page.getByRole("button", { name: "Sage", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sage", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("combobox", { name: "Guide page", exact: true })
    .selectOption("/docs/components");
  await expect(page.locator(".docs-palette")).toHaveCount(0);
  const search = page.getByRole("searchbox", {
    name: "Search components or source paths",
    exact: true,
  });
  await search.fill("TaskRow");
  await expect(
    page.getByRole("navigation", { name: "Component jump links", exact: true }),
  ).toContainText("TaskRow");
  await page
    .getByRole("navigation", { name: "Component jump links", exact: true })
    .getByRole("link", { name: /TaskRow/ })
    .click();
  await expect(page.locator("#module-taskrow")).toHaveAttribute("open", "");
  await search.fill("no-such-component");
  await expect(page.getByText(/No matching components/)).toBeVisible();
  await search.fill("Button");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `docs/screenshots/ux-phase-six-guide-${width}.png`,
    });
  }
  // Real versioned date actions, using the same component in table and detail contexts.
  await page.unroute("**/api/auth/sign-in/email");
  await page.goto("http://localhost:3000/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your day", exact: true }),
  ).toBeVisible();
  let list = await createList(actor, {
    title: "Phase 6 date consistency",
    mode: "work",
    operationId: op(),
  });
  id = list.id;
  list = await createTask(actor, {
    listId: id,
    version: list.version,
    title: "Choose a delivery date",
    operationId: op(),
  });
  const task = list.tasks[0];
  await updateListView(actor, {
    listId: id,
    viewVersion: 0,
    view: { ...defaultListView(), rowStyle: "columns" },
    operationId: op(),
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`http://localhost:3000/lists?listId=${id}`);
  const row = page.locator(`[data-task-id="${task.id}"]`);
  await row
    .getByRole("button", {
      name: `Edit due date for ${task.title}`,
      exact: true,
    })
    .click();
  let form = page.getByRole("form", {
    name: `Due date for ${task.title}`,
    exact: true,
  });
  await expect(form).toBeVisible();
  await form.getByRole("button", { name: "Tomorrow", exact: true }).click();
  const chosen = await form
    .getByLabel(`Choose due date for ${task.title}`, { exact: true })
    .inputValue();
  assert.ok(chosen);
  assert.equal((await getList(actor, id)).tasks[0].dueDate, null);
  await form.getByRole("button", { name: "Save date", exact: true }).click();
  await expect(form).not.toBeVisible();
  assert.equal((await getList(actor, id)).tasks[0].dueDate, chosen);
  await row
    .getByRole("link", { name: `Open task: ${task.title}`, exact: true })
    .click();
  const drawer = page.getByRole("dialog", {
    name: "Task details",
    exact: true,
  });
  await drawer
    .getByRole("button", { name: "Change due date", exact: true })
    .click();
  form = drawer.getByRole("form", {
    name: `Due date for ${task.title}`,
    exact: true,
  });
  await form.getByRole("button", { name: "Clear date", exact: true }).click();
  assert.equal((await getList(actor, id)).tasks[0].dueDate, chosen);
  await form.getByRole("button", { name: "Cancel date", exact: true }).click();
  assert.equal((await getList(actor, id)).tasks[0].dueDate, chosen);
  await drawer
    .getByRole("button", { name: "Change due date", exact: true })
    .click();
  await form.getByRole("button", { name: "Clear date", exact: true }).click();
  await form.getByRole("button", { name: "Save date", exact: true }).click();
  await expect(form).not.toBeVisible();
  assert.equal((await getList(actor, id)).tasks[0].dueDate, null);
  await drawer
    .getByRole("button", { name: "Set due date", exact: true })
    .click();
  await form.getByRole("button", { name: "Tomorrow", exact: true }).click();
  list = await getList(actor, id);
  await updateTask(actor, {
    listId: id,
    version: list.version,
    taskId: task.id,
    priority: "high",
    operationId: op(),
  });
  await page.evaluate(() => dispatchEvent(new Event("focus")));
  await expect(
    form.getByRole("button", { name: "Load latest date", exact: true }),
  ).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Save date", exact: true }),
  ).toBeDisabled();
  await expect(form.locator('input[type="date"]')).toHaveValue(chosen);
  await form
    .getByRole("button", { name: "Load latest date", exact: true })
    .click();
  await expect(form.locator('input[type="date"]')).toHaveValue("");
  await form.getByRole("button", { name: "Today", exact: true }).click();
  let lost = true;
  const dateBodies: string[] = [];
  await page.route("**/api/v1/tasks", async (route: any) => {
    if (route.request().method() !== "PATCH") return route.continue();
    dateBodies.push(route.request().postData());
    if (lost) {
      lost = false;
      const r = await route.fetch();
      assert.equal(r.status(), 200);
      return route.abort("failed");
    }
    return route.continue();
  });
  await form.getByRole("button", { name: "Save date", exact: true }).click();
  await drawer
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(drawer.getByText(/Due today/).first()).toBeVisible();
  assert.equal(dateBodies.length, 2);
  assert.equal(dateBodies[0], dateBodies[1]);
  await page.unroute("**/api/v1/tasks");
  await expect(
    drawer.getByRole("button", { name: "Retry same request", exact: true }),
  ).toHaveCount(0);
  await expect(
    drawer.getByRole("button", { name: "Complete task", exact: true }),
  ).toBeEnabled();
  await expect(form.getByRole("alert")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/screenshots/ux-phase-six-date-390.png" });
  assert.deepEqual(errors, []);
  console.log(
    "UX Phase 6 passed: mocked code request/resend/rate limits/expiry/password mismatch and success, retained auth drafts/autocomplete/code entry; compact guide/resources/copy/downloads/palette scope/search/phone overflow; shared table/detail date draft/shortcut/cancel/clear/save, version conflict recovery and exact committed retry.",
  );
} catch (e) {
  await page?.screenshot({
    path: ".vercel/ux-phase-six-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
  if (id) {
    const list = await getList(actor, id);
    await deleteList(actor, {
      listId: id,
      version: list.version,
      operationId: op(),
    });
  }
  await database().pool.end();
}
