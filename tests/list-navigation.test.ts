import assert from "node:assert/strict";
import { test } from "node:test";
import { listSelectionHref } from "../packages/ui/src/features/lib/list-navigation";
test("unconfirmed list previews have no history destination; confirmed retries produce real links", () => {
  assert.equal(
    listSelectionHref("https://wuff.example/lists?home=1", "pending-operation"),
    null,
  );
  assert.equal(
    listSelectionHref("https://wuff.example/lists?home=1", "confirmed-id"),
    "/lists?listId=confirmed-id",
  );
});
test("overview and list transitions preserve unrelated parameters and clear the other selection", () => {
  assert.equal(
    listSelectionHref("https://wuff.example/lists?listId=old&view=compact", ""),
    "/lists?view=compact&home=1",
  );
  assert.equal(
    listSelectionHref("https://wuff.example/lists?home=1&view=compact", "new"),
    "/lists?view=compact&listId=new",
  );
  assert.equal(
    listSelectionHref("https://wuff.example/lists?listId=new", "new"),
    "/lists?listId=new",
  );
});
test("selection identifiers cannot inject other URL parameters or external destinations", () => {
  assert.equal(
    listSelectionHref("https://wuff.example/lists", "x&home=1"),
    "/lists?listId=x%26home%3D1",
  );
});
