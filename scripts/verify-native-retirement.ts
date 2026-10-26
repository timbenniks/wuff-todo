// Real isolated account/device storage; no provider sends or real-user data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { and, eq, inArray } from "drizzle-orm";
import { database, reminderDevices, receipts } from "@wuff/db";
import { scopes } from "@wuff/contracts";
import { registerReminderDevice } from "@wuff/domain";
if (
  !process.env.DATABASE_URL?.includes("ep-snowy-hill-b9wcml7l") ||
  process.env.QSTASH_TOKEN
)
  throw Error("Isolated development with publishing disabled only");
const [user] = JSON.parse(await readFile(".vercel/dev-users.json", "utf8"));
const require = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { chromium, expect } = require("@playwright/test");
const db = database().db,
  operationId = crypto.randomUUID(),
  marker = crypto.randomUUID();
const ids: string[] = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const [legacy] = await db
    .insert(reminderDevices)
    .values({
      userId: user.id,
      transport: "ios",
      address: marker,
      label: `Retired ${marker}`,
    })
    .returning();
  ids.push(legacy.id);
  const endpoint = `https://fcm.googleapis.com/fcm/send/${marker}`;
  const settings = await registerReminderDevice(
    { id: user.id, scopes },
    {
      operationId,
      transport: "web",
      address: endpoint,
      subscription: {
        endpoint,
        keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) },
      },
      label: `Browser ${marker}`,
    },
  );
  const web = settings.devices.find((d) => d.label === `Browser ${marker}`)!;
  ids.push(web.id);
  const context = await browser.newContext();
  const login = await context.request.post(
    "http://localhost:3000/api/auth/sign-in/email",
    {
      headers: { Origin: "http://localhost:3000" },
      data: { email: user.email, password: user.password },
    },
  );
  assert.equal(login.status(), 200);
  const page = await context.newPage(),
    errors: string[] = [];
  page.on("pageerror", (e: Error) => errors.push(e.message));
  await page.goto("http://localhost:3000/settings/notifications");
  for (const device of [legacy, web]) {
    const name = `Remove ${device.label}${device.transport !== "web" ? " (retired app)" : ""}`;
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeVisible({ timeout: 10000 });
    await button.click();
    await expect
      .poll(
        async () =>
          (
            await db
              .select()
              .from(reminderDevices)
              .where(eq(reminderDevices.id, device.id))
          ).length,
      )
      .toBe(0);
  }
  assert.deepEqual(errors, []);
  console.log(
    "Native retirement browser regression passed: accessible Remove controls identify browser/retired devices and delete only the chosen synthetic device through the real API.",
  );
  await context.close();
} finally {
  await browser.close();
  if (ids.length)
    await db.delete(reminderDevices).where(inArray(reminderDevices.id, ids));
  await db
    .delete(receipts)
    .where(
      and(eq(receipts.actorId, user.id), eq(receipts.operationId, operationId)),
    );
  await database().pool.end();
}
