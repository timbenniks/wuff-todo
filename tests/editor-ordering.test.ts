import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeVisibleOrder } from "../packages/ui/src/features/lib/reorder";
import {
  PreservedNote,
  preservedNoteDocument,
} from "../packages/ui/src/features/lib/preserved-note";
import { MarkdownManager } from "@tiptap/markdown";
test("moving within a section/sidebar preserves all hidden positions", () => {
  assert.deepEqual(
    mergeVisibleOrder(
      ["a", "other", "b", "archived", "c"],
      ["a", "b", "c"],
      ["b", "c", "a"],
    ),
    ["b", "other", "c", "archived", "a"],
  );
});
test("stale or incomplete reorder requests never replace newer membership or order", () => {
  for (const [all, before, after] of [
    [
      ["b", "a"],
      ["a", "b"],
      ["b", "a"],
    ],
    [["a"], ["a", "b"], ["b", "a"]],
    [
      ["a", "b"],
      ["a", "b"],
      ["a", "a"],
    ],
    [
      ["a", "b"],
      ["a", "b"],
      ["a", "outside"],
    ],
  ])
    assert.equal(mergeVisibleOrder(all, before, after), null);
});
test("unsupported notes remain lossless visual blocks without exposing a source editor", () => {
  const manager = new MarkdownManager({ extensions: [PreservedNote] });
  for (const content of [
    "<script>alert('corgi')</script>\n\n![Photo](https://tracker.invalid/pixel)",
    "[^note]: Extended note\n",
    ":::warning\nKeep this intact\n:::",
  ]) {
    const doc = preservedNoteDocument(content);
    assert.equal(manager.serialize(doc.content[0]), content);
  }
});
