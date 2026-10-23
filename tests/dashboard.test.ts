import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dashboardThrough,
  dashboardSettingsSchema,
  dashboardQuerySchema,
  defaultDashboardSettings,
} from "@wuff/contracts";
test("Home's seven-day window uses calendar days across leap days, DST, years and date limits", () => {
  for (const [today, end] of [
    ["2024-02-25", "2024-03-03"],
    ["2026-03-27", "2026-04-03"],
    ["2026-10-23", "2026-10-30"],
    ["2026-12-28", "2027-01-04"],
    ["0001-01-01", "0001-01-08"],
    ["9999-12-28", "9999-12-31"],
  ])
    assert.equal(dashboardThrough(today), end);
  for (const today of [
    "0000-01-01",
    "2026-02-29",
    "today",
    "2026-10-23T00:00:00Z",
  ])
    assert.throws(() => dashboardThrough(today));
});
test("personal Home settings admit only complete unique section orders and known visibility choices", () => {
  assert.deepEqual(
    dashboardSettingsSchema.parse(defaultDashboardSettings),
    defaultDashboardSettings,
  );
  assert.ok(
    dashboardSettingsSchema.safeParse({
      ...defaultDashboardSettings,
      sections: ["favorites", "today", "upcoming"],
      hidden: ["today", "upcoming", "favorites"],
      startPage: "last_list",
    }).success,
  );
  for (const change of [
    { sections: ["today", "today", "favorites"] },
    { sections: ["today"] },
    { hidden: ["today", "today"] },
    { hidden: ["medication"] },
    { startPage: "/tasks/private" },
    { extra: true },
  ])
    assert.equal(
      dashboardSettingsSchema.safeParse({
        ...defaultDashboardSettings,
        ...change,
      }).success,
      false,
    );
  assert.equal(dashboardQuerySchema.parse({ today: "2026-10-23" }).limit, 5);
  for (const limit of [0, 101, 2.5, "5"])
    assert.equal(
      dashboardQuerySchema.safeParse({ today: "2026-10-23", limit }).success,
      false,
    );
});
