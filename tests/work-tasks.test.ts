import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createListSchema,
  createTaskSchema,
  updateTaskSchema,
  taskLookupSchema,
  taskReferencesSchema,
} from "@wuff/contracts";
import { signInReturnPath } from "../apps/web/src/lib/auth/return-path";
const mutation = {
  listId: crypto.randomUUID(),
  version: 0,
  operationId: crypto.randomUUID(),
  taskId: crypto.randomUUID(),
};
test("work contracts reject contradictory completion and unsafe external references", () => {
  assert.equal(
    createListSchema.parse({
      title: "Work",
      mode: "work",
      operationId: crypto.randomUUID(),
    }).mode,
    "work",
  );
  assert.equal(
    createTaskSchema.parse({ ...mutation, title: "Build", status: "in_review" })
      .status,
    "in_review",
  );
  for (const status of [
    "todo",
    "in_progress",
    "in_review",
    "blocked",
    "done",
  ]) {
    assert.equal(
      updateTaskSchema.safeParse({
        ...mutation,
        status,
        completed: status === "done",
      }).success,
      true,
    );
    assert.equal(
      updateTaskSchema.safeParse({
        ...mutation,
        status,
        completed: status !== "done",
      }).success,
      false,
    );
  }
  assert.equal(
    updateTaskSchema.safeParse({
      ...mutation,
      assigneeId: null,
      references: [],
    }).success,
    true,
  );
  assert.equal(
    taskReferencesSchema.safeParse([
      { url: "https://github.com/example/repo/issues/42", title: "Issue" },
    ]).success,
    true,
  );
  for (const url of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://user:secret@example.invalid/",
  ])
    assert.equal(taskReferencesSchema.safeParse([{ url }]).success, false);
  assert.equal(
    taskReferencesSchema.safeParse(
      Array.from({ length: 21 }, () => ({ url: "https://example.invalid" })),
    ).success,
    false,
  );
});
test("task identifiers and sign-in destinations cannot redirect outside Wuff", () => {
  for (const lookup of [mutation.taskId, "WUFF-42", "wuff-42"])
    assert.equal(taskLookupSchema.safeParse(lookup).success, true);
  for (const lookup of [
    "WUFF-0",
    "WUFF-9999999999",
    "private-slug",
    "../secret",
  ])
    assert.equal(taskLookupSchema.safeParse(lookup).success, false);
  assert.equal(
    signInReturnPath(`/tasks/${mutation.taskId}`),
    `/tasks/${mutation.taskId}`,
  );
  assert.equal(signInReturnPath("/tasks/WUFF-42"), "/tasks/WUFF-42");
  for (const value of [
    "//evil.example",
    "https://evil.example",
    "/\\evil.example",
    "/tasks/WUFF-42?next=https://evil.example",
    "/tasks/WUFF-42/../../sign-out",
  ])
    assert.equal(signInReturnPath(value), "/");
});
