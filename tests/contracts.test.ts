import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createListSchema,
  reorderTasksSchema,
  updateTaskSchema,
} from "@wuff/contracts";
const mutation = {
  listId: crypto.randomUUID(),
  version: 0,
  operationId: crypto.randomUUID(),
};
test("titles are trimmed and empty titles rejected", () => {
  assert.equal(
    createListSchema.parse({
      title: "  Groceries  ",
      operationId: crypto.randomUUID(),
    }).title,
    "Groceries",
  );
  assert.equal(
    createListSchema.safeParse({
      title: "  ",
      operationId: crypto.randomUUID(),
    }).success,
    false,
  );
});
test("updates require an explicit change and a valid list version", () => {
  assert.equal(
    updateTaskSchema.safeParse({ ...mutation, taskId: crypto.randomUUID() })
      .success,
    false,
  );
  assert.equal(
    updateTaskSchema.safeParse({
      ...mutation,
      taskId: crypto.randomUUID(),
      completed: false,
    }).success,
    true,
  );
  assert.equal(
    updateTaskSchema.safeParse({
      ...mutation,
      version: -1,
      taskId: crypto.randomUUID(),
      completed: true,
    }).success,
    false,
  );
});
test("ordering cannot carry arbitrary identifiers", () => {
  assert.equal(
    reorderTasksSchema.safeParse({ ...mutation, taskIds: ["other-user-task"] })
      .success,
    false,
  );
});
