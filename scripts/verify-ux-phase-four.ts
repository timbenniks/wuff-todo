// Optimized local website; disposable synthetic development data only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { scopes } from "@wuff/contracts";
import { database } from "@wuff/db";
import {
  createList,
  createTask,
  deleteList,
  getList,
  getListSharing,
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
  op = () => crypto.randomUUID();
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const errors: string[] = [];
let page: any,
  id = "";
try {
  let list = await createList(actor, {
    title: "Phase 4 shared groceries",
    operationId: op(),
  });
  id = list.id;
  list = await createTask(actor, {
    listId: id,
    version: list.version,
    title: "Keep groceries and subtasks",
    operationId: op(),
  });
  async function session(person: any) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const response = await context.request.post(
      "http://localhost:3000/api/auth/sign-in/email",
      {
        headers: { Origin: "http://localhost:3000" },
        data: { email: person.email, password: person.password },
      },
    );
    assert.equal(response.status(), 200);
    const p = await context.newPage();
    p.on("pageerror", (e: Error) => errors.push(e.message));
    return p;
  }
  page = await session(user);
  await page.goto(`http://localhost:3000/lists?listId=${id}`);
  const settings = page.getByRole("dialog", {
    name: "List settings",
    exact: true,
  });
  const tab = (name: string) =>
    settings
      .getByRole("navigation", { name: "List settings pages" })
      .getByRole("button", { name, exact: true });
  await page
    .getByRole("button", { name: "List settings", exact: true })
    .click();
  await expect(settings).toContainText("Private · Owner");
  const title = settings.getByRole("textbox", {
    name: "List name",
    exact: true,
  });
  await title.fill("Keep this unsaved owner draft");
  await tab("People").click();
  await expect(
    settings.getByRole("region", { name: "People with access" }),
  ).toContainText("Owner");
  assert.equal(await page.locator("dialog[open]").count(), 1);
  let lost = true;
  const bodies: string[] = [];
  await page.route(`**/api/v1/lists/${id}/invitations`, async (route: any) => {
    if (route.request().method() !== "POST") return route.continue();
    bodies.push(route.request().postData());
    if (lost) {
      lost = false;
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      return route.abort("failed");
    }
    return route.continue();
  });
  const email = settings.getByRole("textbox", { name: "Invite an editor" });
  await email.fill(other.email);
  await settings.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(
    settings.getByRole("button", { name: "Retry same request", exact: true }),
  ).toBeVisible();
  await expect(email).toHaveValue(other.email);
  await settings
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(
    settings.getByRole("region", { name: "Pending invitations", exact: true }),
  ).toContainText(other.email);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.equal((await getListSharing(actor, id)).invitations.length, 1);
  await page.unroute(`**/api/v1/lists/${id}/invitations`);
  await tab("Only for me").click();
  await expect(
    settings.getByRole("button", { name: "Add to favorites", exact: true }),
  ).toBeVisible();
  await tab("List details").click();
  await expect(title).toHaveValue("Keep this unsaved owner draft");
  await settings.getByRole("button", { name: "Close list settings" }).click();
  await page.getByRole("button", { name: "People", exact: true }).click();
  await expect(tab("People")).toHaveAttribute("aria-current", "page");
  assert.equal(await page.locator("dialog[open]").count(), 1);
  const editor = await session(other);
  await editor.goto("http://localhost:3000/lists?home=1");
  await editor
    .getByRole("button", {
      name: `Accept invitation to ${list.title}`,
      exact: true,
    })
    .click();
  await expect(editor.locator(".list-heading h1")).toHaveText(list.title);
  await editor.getByRole("button", { name: "People", exact: true }).click();
  const editorSettings = editor.getByRole("dialog", {
    name: "List settings",
    exact: true,
  });
  await expect(editorSettings).toContainText("Shared · Editor");
  await expect(
    editorSettings.getByRole("region", { name: "People with access" }),
  ).toContainText("Editor");
  await editorSettings
    .getByRole("navigation")
    .getByRole("button", { name: "Manage list", exact: true })
    .click();
  await expect(
    editorSettings.getByRole("button", { name: "Delete list", exact: true }),
  ).toHaveCount(0);
  await expect(
    editorSettings.getByRole("button", { name: "Archive list", exact: true }),
  ).toHaveCount(0);
  await editorSettings
    .getByRole("navigation")
    .getByRole("button", { name: "People", exact: true })
    .click();
  editor.once("dialog", (d: any) => d.dismiss());
  await editorSettings
    .getByRole("button", { name: "Leave list", exact: true })
    .click();
  await expect(editorSettings).toBeVisible();
  assert.ok(await getList({ id: other.id, scopes }, id));
  await editorSettings
    .getByRole("button", { name: "Close list settings" })
    .click();
  await tab("List details").click();
  await expect(title).toHaveValue("Keep this unsaved owner draft");
  await settings
    .getByRole("button", { name: "Load latest settings", exact: true })
    .click();
  await expect(title).toHaveValue(list.title);
  await tab("Manage list").click();
  page.once("dialog", (d: any) => d.dismiss());
  await settings
    .getByRole("button", { name: "Delete list", exact: true })
    .click();
  assert.ok(await getList(actor, id));
  await settings
    .getByRole("button", { name: "Archive list", exact: true })
    .click();
  await expect(settings).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Restore list", exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      page.getByRole("button", { name: "Restore list", exact: true }),
    ).toBeEnabled();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `docs/screenshots/ux-phase-four-archive-${width}.png`,
    });
  }
  await page.getByRole("button", { name: "Restore list", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restore list", exact: true }),
  ).toHaveCount(0);
  assert.equal((await getList(actor, id)).tasks.length, 1);
  await page
    .getByRole("button", { name: "List settings", exact: true })
    .click();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await tab("People").click();
    await expect(
      settings.getByRole("region", { name: "People with access" }),
    ).toContainText(other.name);
    assert.ok(
      await settings.evaluate(
        (el: HTMLElement) => el.scrollWidth <= el.clientWidth,
      ),
    );
    await page.screenshot({
      path: `docs/screenshots/ux-phase-four-people-${width}.png`,
    });
  }
  page.once("dialog", (d: any) => d.accept());
  await settings
    .getByRole("button", { name: `Remove ${other.name}`, exact: true })
    .click();
  await expect(
    settings.getByRole("region", { name: "People with access" }),
  ).not.toContainText(other.email);
  await assert.rejects(getList({ id: other.id, scopes }, id), {
    code: "not_found",
  });
  await page.goto(`http://localhost:3000/tasks/${op()}`);
  await expect(
    page.getByRole("heading", {
      name: "This page isn’t available.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to lists", exact: true }),
  ).toHaveAttribute("href", "/lists");
  await page.goto("http://localhost:3000/oauth/authorize?client_id=invalid");
  await expect(page.getByText(/Return to the app that started/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to lists", exact: true }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "UX Phase 4 passed: single management dialog/direct People, owner/editor boundaries, retained drafts, exact invitation retry/accept/remove/cancelled leave and delete, responsive archive/direct restore preserving tasks, safe unavailable/OAuth exits.",
  );
} catch (e) {
  await page?.screenshot({
    path: ".vercel/ux-phase-four-failure.png",
    fullPage: true,
  });
  throw e;
} finally {
  await browser.close();
  if (id) {
    const l = await getList(actor, id);
    await deleteList(actor, {
      listId: id,
      version: l.version,
      operationId: op(),
    });
  }
  await database().pool.end();
}
