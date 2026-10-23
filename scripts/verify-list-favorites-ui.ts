// Actual optimized website, synthetic identities and isolated development only.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { scopes } from "@wuff/contracts";
import { database, members } from "@wuff/db";
import {
  createList,
  getList,
  getListOrder,
  reorderLists,
  deleteList,
  updateList,
} from "@wuff/domain";
if (!process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l"))
  throw Error("Isolated development only");
const origin = "http://localhost:3000";
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect } = require("@playwright/test");
const [user, editor] = JSON.parse(
  await readFile(".vercel/dev-users.json", "utf8"),
);
const actor = { id: user.id, scopes },
  other = { id: editor.id, scopes },
  op = () => crypto.randomUUID();
const originals = [await getListOrder(actor), await getListOrder(other)];
const created: string[] = [];
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const errors: string[] = [];
try {
  const parent = await createList(actor, {
    title: "Plant to-dos",
    operationId: op(),
  });
  created.push(parent.id);
  const child = await createList(actor, {
    title: "Repot plants",
    operationId: op(),
  });
  created.push(child.id);
  await database()
    .db.insert(members)
    .values({ listId: child.id, userId: other.id });
  await reorderLists(actor, {
    ...(await getListOrder(actor)),
    nesting: [{ listId: child.id, parentListId: parent.id }],
    collapsedListIds: [parent.id],
    operationId: op(),
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
  });
  const login = await context.request.post(origin + "/api/auth/sign-in/email", {
    headers: { Origin: origin },
    data: { email: user.email, password: user.password },
  });
  assert.equal(login.status(), 200);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e: Error) => errors.push(e.message));
  const dialog = page.getByRole("dialog", {
    name: "List settings",
    exact: true,
  });
  async function settings() {
    await page
      .getByRole("button", { name: "List settings", exact: true })
      .click();
    await expect(dialog).toBeVisible();
  }
  async function close() {
    await dialog
      .getByRole("button", { name: "Close list settings", exact: true })
      .click();
  }
  await page.goto(origin + `/lists?listId=${child.id}`);
  await settings();
  // Personal save keeps unsaved owner metadata in place.
  await dialog
    .getByLabel(/^Description/)
    .fill("Unsaved description remains here");
  await dialog
    .getByRole("button", { name: "Add to favorites", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Remove from favorites", exact: true }),
  ).toBeEnabled();
  await expect(dialog.getByLabel(/^Description/)).toHaveValue(
    "Unsaved description remains here",
  );
  await close();
  const favorites = page.getByRole("navigation", {
    name: "Favorite lists",
    exact: true,
  });
  await expect(
    favorites.getByRole("button", {
      name: "Repot plants Shared list",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(favorites).toBeVisible();
  assert.deepEqual((await getListOrder(actor)).nesting, [
    { listId: child.id, parentListId: parent.id },
  ]);
  assert.deepEqual(
    (await getListOrder(other)).favoriteListIds,
    originals[1].favoriteListIds,
  );
  // A favorite child opens even while its parent is collapsed.
  await page
    .getByRole("navigation", { name: "Lists", exact: true })
    .getByRole("button", { name: "Plant to-dos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Plant to-dos", exact: true }),
  ).toBeVisible();
  await favorites
    .getByRole("button", { name: "Repot plants Shared list", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Repot plants", exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width < 768 && !(await favorites.isVisible()))
      await page
        .getByRole("button", { name: "Choose a list", exact: true })
        .click();
    await expect(favorites).toBeVisible();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await mkdir("docs/screenshots", { recursive: true });
    await page.screenshot({
      path: `docs/screenshots/list-favorites-${width}.png`,
      fullPage: true,
    });
    if (width < 768)
      await page
        .getByRole("button", { name: "Choose a list", exact: true })
        .click();
    await settings();
    assert.ok(
      await dialog.evaluate(
        (el: HTMLElement) => el.scrollWidth <= el.clientWidth,
      ),
    );
    await page.screenshot({
      path: `docs/screenshots/list-favorites-settings-${width}.png`,
      fullPage: true,
    });
    await close();
  }
  // A committed request whose response is lost retries the exact body.
  let first = true;
  const bodies: string[] = [];
  await page.route("**/api/v1/list-order", async (route: any) => {
    if (route.request().method() !== "PUT") return route.continue();
    bodies.push(route.request().postData());
    if (first) {
      first = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await settings();
  await dialog
    .getByRole("button", { name: "Remove from favorites", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Retry sidebar change", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Retry sidebar change", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Add to favorites", exact: true }),
  ).toBeEnabled();
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  await page.unroute("**/api/v1/list-order");
  await dialog
    .getByRole("button", { name: "Add to favorites", exact: true })
    .click();
  await close();
  let current = await getList(actor, child.id);
  current = await updateList(actor, {
    listId: child.id,
    version: current.version,
    archived: true,
    operationId: op(),
  });
  await page.reload();
  await expect(favorites).toHaveCount(0);
  await updateList(actor, {
    listId: child.id,
    version: current.version,
    archived: false,
    operationId: op(),
  });
  await page.reload();
  await expect(favorites).toBeVisible();
  // An editor can favorite without gaining owner management permissions.
  const editorContext = await browser.newContext();
  const editorLogin = await editorContext.request.post(
    origin + "/api/auth/sign-in/email",
    {
      headers: { Origin: origin },
      data: { email: editor.email, password: editor.password },
    },
  );
  assert.equal(editorLogin.status(), 200);
  const editorPage = await editorContext.newPage();
  await editorPage.goto(origin + `/lists?listId=${child.id}`);
  await editorPage
    .getByRole("button", { name: "List settings", exact: true })
    .click();
  const editorDialog = editorPage.getByRole("dialog", {
    name: "List settings",
    exact: true,
  });
  await expect(
    editorDialog.getByRole("button", { name: "Archive list", exact: true }),
  ).toHaveCount(0);
  await editorDialog
    .getByRole("button", { name: "Add to favorites", exact: true })
    .click();
  await expect(
    editorDialog.getByRole("button", {
      name: "Remove from favorites",
      exact: true,
    }),
  ).toBeEnabled();
  assert.deepEqual((await getListOrder(other)).favoriteListIds, [child.id]);
  assert.deepEqual(errors, []);
  console.log(
    "Favorites: reload, child shortcuts, shared cues, isolation, owner draft preservation, exact retry, archive/restore, editor controls and 320/390/1280 layouts passed.",
  );
} finally {
  await browser.close();
  for (const id of created.reverse()) {
    const list = await getList(actor, id);
    await deleteList(actor, {
      listId: id,
      version: list.version,
      operationId: op(),
    });
  }
  for (const [i, who] of [actor, other].entries()) {
    const now = await getListOrder(who);
    await reorderLists(who, {
      ...originals[i],
      version: now.version,
      operationId: op(),
    });
  }
  await database().pool.end();
}
