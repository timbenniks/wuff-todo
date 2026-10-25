import { test } from "node:test";
import assert from "node:assert/strict";
import { schedulerDeduplicationId } from "../packages/domain/src/platform/scheduler";
const job = "11111111-1111-4111-8111-111111111111",
  minute = Date.parse("2026-10-25T20:50:00Z");
test("scheduler IDs are bounded provider-compatible hexadecimal for both products and identical retries", () => {
  for (const product of ["todo", "totake"] as const) {
    const id = schedulerDeduplicationId(product, job, 1, minute);
    assert.match(id, /^[a-f0-9]{64}$/);
    assert.equal(schedulerDeduplicationId(product, job, 1, minute), id);
    assert.equal(schedulerDeduplicationId(product, job, 1, minute + 59999), id);
    assert(!id.includes(job));
  }
});
test("product, job, generation and wake-minute boundaries have independent identities", () => {
  const first = schedulerDeduplicationId("todo", job, 1, minute);
  const variants = [
    schedulerDeduplicationId("totake", job, 1, minute),
    schedulerDeduplicationId(
      "todo",
      "22222222-2222-4222-8222-222222222222",
      1,
      minute,
    ),
    schedulerDeduplicationId("todo", job, 2, minute),
    schedulerDeduplicationId("todo", job, 1, minute + 60000),
    schedulerDeduplicationId("todo", job, 1, minute - 1),
  ];
  assert.equal(new Set([first, ...variants]).size, 6);
  assert.equal(
    schedulerDeduplicationId("todo", job, 1, minute + 60000),
    schedulerDeduplicationId("todo", job, 1, minute + 119999),
  );
});
test("separator-like job values cannot collapse tuple boundaries or leak unsafe characters", () => {
  const ids = ["x:1:2", "x-1-2", "x", 'x","2', "1".repeat(4096)].map((id) =>
    schedulerDeduplicationId("todo", id, 1, minute),
  );
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-f0-9]{64}$/);
});
