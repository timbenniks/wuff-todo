import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  dueDateSchema,
  createTaskSchema,
  updateTaskSchema,
} from "@wuff/contracts";
import {
  dueDatePresentation,
  formatDueDate,
  nextCalendarDay,
} from "../apps/web/src/lib/due-date";
const mutation = {
  listId: crypto.randomUUID(),
  version: 0,
  operationId: crypto.randomUUID(),
};
test("due dates accept real calendar dates, preserve omission and explicitly clear with null", () => {
  for (const date of [
    "0001-01-01",
    "2000-02-29",
    "2024-02-29",
    "2026-10-16",
    "9999-12-31",
  ])
    assert.equal(dueDateSchema.safeParse(date).success, true, date);
  for (const date of [
    "0000-01-01",
    "10000-01-01",
    "1900-02-29",
    "2100-02-29",
    "2026-02-30",
    "2026-13-01",
    "2026-10-00",
    "2026-1-01",
    "2026-10-16T00:00:00Z",
    "2026-10-16+02:00",
    "today",
    "",
  ])
    assert.equal(dueDateSchema.safeParse(date).success, false, date);
  assert.equal(
    createTaskSchema.parse({ ...mutation, title: "Task" }).dueDate,
    undefined,
  );
  assert.equal(
    createTaskSchema.parse({ ...mutation, title: "Task", dueDate: null })
      .dueDate,
    null,
  );
  assert.equal(
    updateTaskSchema.parse({
      ...mutation,
      taskId: crypto.randomUUID(),
      dueDate: null,
    }).dueDate,
    null,
  );
  assert.equal(
    updateTaskSchema.safeParse({ ...mutation, taskId: crypto.randomUUID() })
      .success,
    false,
  );
});
test("due labels roll from tomorrow to today to overdue and completed dates stay neutral", () => {
  const date = "2026-10-16";
  assert.equal(
    dueDatePresentation(date, false, "2026-10-15").label,
    "Due tomorrow",
  );
  assert.equal(dueDatePresentation(date, false, "2026-10-16").tone, "today");
  assert.equal(dueDatePresentation(date, false, "2026-10-17").tone, "overdue");
  assert.equal(dueDatePresentation(date, true, "2026-10-17").tone, "muted");
  assert.equal(dueDatePresentation(date, false, null).label, "16 Oct 2026");
  assert.equal(nextCalendarDay("2024-02-28"), "2024-02-29");
  assert.equal(nextCalendarDay("2026-12-31"), "2027-01-01");
  assert.equal(formatDueDate("0001-01-01"), "1 Jan 1");
});
test("calendar dates never shift across zones and Tomorrow follows calendar days over DST", () => {
  for (const [zone, expected] of [
    ["America/Los_Angeles", "2025-12-31"],
    ["Europe/Paris", "2026-01-01"],
    ["Pacific/Kiritimati", "2026-01-01"],
  ]) {
    const script = `import {calendarDay,formatDueDate} from './apps/web/src/lib/due-date.ts';console.log(JSON.stringify({today:calendarDay(0,new Date('2026-01-01T01:00:00Z')),formatted:formatDueDate('2026-01-01'),spring:calendarDay(1,new Date(2026,2,28,23,30)),fall:calendarDay(1,new Date(2026,9,31,23,30))}));`;
    const child = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      { env: { ...process.env, TZ: zone }, encoding: "utf8" },
    );
    assert.equal(child.status, 0, "Timezone fixture executed");
    const value = JSON.parse(child.stdout);
    assert.equal(value.today, expected, zone);
    assert.equal(value.formatted, "1 Jan 2026");
    assert.equal(value.spring, "2026-03-29");
    assert.equal(value.fall, "2026-11-01");
  }
});
