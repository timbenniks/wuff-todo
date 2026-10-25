// Optimized local app, real isolated persistence, fictional items only. No provider sends.
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { database } from "@wuff/db";
import { getTotake } from "@wuff/domain";
import { totakeReminderPath } from "@wuff/contracts/modules/totake/notification";
import {
  seedTotakeNotice,
  cleanupTotakeNotice,
} from "../tests/helpers/totake-notice-fixture";
if (
  !process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l") ||
  process.env.QSTASH_TOKEN
)
  throw Error("Isolated development only");
const origin = "http://localhost:3000";
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect: baseExpect } = require("@playwright/test"),
  expect = baseExpect.configure({ timeout: 10000 });
const [user, other] = JSON.parse(
  await readFile(".vercel/dev-users.json", "utf8"),
);
const f = await seedTotakeNotice(user.id, 2),
  path = totakeReminderPath(f.group.id, user.id, true);
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  context = await browser.newContext(),
  page = await context.newPage();
const errors: string[] = [],
  writes: any[] = [],
  replies: any[] = [];
page.on("pageerror", (err: Error) => errors.push(err.message));
let loseRecord = false;
await page.route("**/api/v1/totake", async (route: any) => {
  if (route.request().method() !== "PUT") return route.continue();
  const input = route.request().postDataJSON();
  writes.push(input);
  const response = await route.fetch();
  assert.equal(response.status(), 200);
  replies.push(await response.json());
  if (loseRecord && input.change.action === "record") {
    loseRecord = false;
    return route.abort("failed");
  }
  return route.fulfill({ response });
});
const read = () => getTotake(f.actor);
try {
  const anon = await context.request.get(origin + path, { maxRedirects: 0 });
  assert.equal(anon.status(), 307);
  const signin = new URL(anon.headers()["location"], origin);
  assert.equal(signin.pathname, "/sign-in");
  assert.equal(signin.searchParams.get("next"), path);
  const login = await context.request.post(origin + "/api/auth/sign-in/email", {
    headers: { Origin: origin },
    data: { email: user.email, password: user.password },
  });
  assert.equal(login.status(), 200);
  await page.goto(origin + totakeReminderPath(f.group.id, other.id));
  await page
    .getByText(
      "This reminder belongs to a different account. Sign in to that account to review it.",
    )
    .waitFor();
  assert.equal(
    await page
      .getByRole("dialog", { name: "View reminder", exact: true })
      .count(),
    0,
  );
  assert.equal(writes.length, 0);
  await page.goto(origin + path);
  let dialog = page.getByRole("dialog", { name: "View reminder", exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.locator(".selection-row input").count(), 2);
  await expect(dialog.locator("#totake-snooze")).toBeFocused();
  assert.deepEqual(
    await dialog
      .locator("#totake-snooze option")
      .evaluateAll((options: any[]) => options.map((o) => o.value)),
    ["15", "30", "45", "60"],
  );
  await mkdir("docs/screenshots", { recursive: true });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `docs/screenshots/totake-notification-actions-${width}.png`,
      fullPage: true,
    });
  }
  const first = f.group.items[0],
    second = f.group.items[1];
  const originalSecond = f.group.reminders[second.id].nextInstant;
  for (const minutes of [15, 30, 45, 60]) {
    await dialog
      .locator(".selection-row")
      .filter({ hasText: second.name })
      .locator("input")
      .uncheck();
    await dialog.locator("#totake-snooze").selectOption(String(minutes));
    await dialog
      .getByRole("button", { name: "Snooze selected (1)", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    const snapshot = await read(),
      g = snapshot.state.groups.find((g) => g.id === f.group.id)!;
    assert.equal(g.records.length, 0);
    assert.equal(g.due, f.group.due);
    assert.equal(g.reminders[second.id].nextInstant, originalSecond);
    assert(
      snapshot.state.treatments!.every((t) => t.inventory.current === "10"),
    );
    assert.equal(
      g.reminders[first.id].snoozedInstant,
      replies.at(-1).state.clock.instant + minutes * 60000,
    );
    await page.goto(origin + path);
    dialog = page.getByRole("dialog", { name: "View reminder", exact: true });
    await dialog.waitFor();
  }
  // Explicit partial Taken, with lost committed response and exact recovery.
  await dialog
    .locator(".selection-row")
    .filter({ hasText: second.name })
    .locator("input")
    .uncheck();
  loseRecord = true;
  await dialog
    .getByRole("button", {
      name: "Mark selected as taken/done (1)",
      exact: true,
    })
    .click();
  const retry = dialog
    .getByRole("button", {
      name: "Retry the same save",
      exact: true,
    })
    .first();
  await retry.waitFor();
  const request = writes.at(-1);
  await retry.click();
  await expect(dialog).not.toBeVisible();
  assert.deepEqual(writes.at(-1), request);
  let snapshot = await read(),
    g = snapshot.state.groups.find((g) => g.id === f.group.id)!;
  assert.equal(g.records.length, 1);
  assert.equal(g.records[0].itemId, first.id);
  assert.equal(
    snapshot.state.treatments!.find((t) => t.id === first.treatmentId)!
      .inventory.current,
    "9",
  );
  assert.equal(
    snapshot.state.treatments!.find((t) => t.id === second.treatmentId)!
      .inventory.current,
    "10",
  );
  await page.goto(origin + path);
  dialog = page.getByRole("dialog", { name: "View reminder", exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.locator(".selection-row input").count(), 1);
  await dialog
    .getByRole("button", { name: "Skip selected", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  snapshot = await read();
  g = snapshot.state.groups.find((g) => g.id === f.group.id)!;
  assert.equal(g.records.length, 2);
  assert(
    g.records.some((r) => r.itemId === second.id && r.outcome === "skipped"),
  );
  assert.equal(
    snapshot.state.treatments!.find((t) => t.id === second.treatmentId)!
      .inventory.current,
    "10",
  );
  await page.locator("details.recorded > summary").click();
  await page
    .getByRole("button", { name: new RegExp(`^Undo ${first.name} scheduled`) })
    .click();
  await expect
    .poll(async () => {
      const s = await read();
      return s.state.treatments!.find((t) => t.id === first.treatmentId)!
        .inventory.current;
    })
    .toBe("10");
  assert.deepEqual(errors, []);
  console.log(
    "Totake notification browser proof passed: sign-in return/account guard, grouped selection, 15/30/45/60 snooze, untouched unselected item, partial Taken exact retry, Skip and Undo stock, responsive 320/390/1280px. No OS/provider sends.",
  );
} finally {
  await context.close();
  await browser.close();
  await cleanupTotakeNotice(
    user.id,
    writes.map((x) => x.operationId),
  );
  await database().pool.end();
}
