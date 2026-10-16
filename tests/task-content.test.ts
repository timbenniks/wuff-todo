import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTaskSchema,
  updateTaskSchema,
  taskContentLimit,
} from "@wuff/contracts";
import {
  renderTaskMarkdown,
  safeNoteLink,
  needsPreservedNote,
} from "../apps/web/src/lib/task-markdown";
const base = {
  listId: crypto.randomUUID(),
  version: 0,
  operationId: crypto.randomUUID(),
};
test("Markdown notes preserve whitespace, allow explicit clearing and enforce a shared limit", () => {
  const content = "  **bold**\n\n- first\n- second  \n";
  assert.equal(
    createTaskSchema.parse({ ...base, title: "Task", content }).content,
    content,
  );
  assert.equal(
    updateTaskSchema.parse({
      ...base,
      taskId: crypto.randomUUID(),
      content: "",
    }).content,
    "",
  );
  assert.equal(
    createTaskSchema.safeParse({
      ...base,
      title: "Task",
      content: "x".repeat(taskContentLimit + 1),
    }).success,
    false,
  );
  assert.equal(
    createTaskSchema.safeParse({
      ...base,
      title: "Task",
      content: "x".repeat(taskContentLimit),
    }).success,
    true,
  );
});
test("shared note renderer supports formatting, tables, code and noninteractive checklists", () => {
  const html = renderTaskMarkdown(
    '## A little more de-tail\n\n**Bold** and *italic* and ~~strike~~\n\n- [x] packed\n- [ ] fetch\n\n> A quote\n\n```ts\nconst x = "<img>";\n```\n\n| Pack | Count |\n| --- | --- |\n| Corgi | 2 |\n\n[Wuff](https://example.com)',
  );
  for (const expected of [
    "<h2>",
    "<strong>",
    "<em>",
    "<s>",
    "<blockquote>",
    "<pre>",
    "<table>",
    'aria-label="Checked"',
    'aria-label="Unchecked"',
    'rel="noopener noreferrer"',
  ])
    assert.ok(html.includes(expected), expected);
  assert.ok(!html.includes("<input"), "Checklist markers do not mutate tasks");
});
test("notes never execute HTML, load images, or emit dangerous/relative links", () => {
  for (const content of [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    '<iframe src="https://tracker.invalid"></iframe>',
    "[bad](javascript:alert%281%29)",
    "[bad](jav&#x61;script:alert%281%29)",
    "[bad](data:text/html,payload)",
    "[bad](file:///etc/passwd)",
    "[bad](//tracker.invalid)",
    "[bad](/api/auth/sign-out)",
    "![private](https://tracker.invalid/pixel)",
    "![bad](data:image/png;base64,AAAA)",
  ]) {
    const html = renderTaskMarkdown(content);
    assert.doesNotMatch(
      html,
      /<script|<img|<iframe|onerror=\"|href="(?:javascript:|data:|file:|\/)/i,
      content,
    );
  }
  assert.equal(safeNoteLink("https://example.com"), true);
  assert.equal(safeNoteLink("mailto:a@example.com"), true);
  assert.equal(safeNoteLink("javascript:alert(1)"), false);
  assert.equal(safeNoteLink("https://example.com\u0000test"), false);
  assert.ok(
    renderTaskMarkdown("![Photo](https://example.com/photo.jpg)").includes(
      "uploads coming later",
    ),
  );
});

test("HTML and image syntax are identified before entering the visual import path", () => {
  for (const content of [
    "<img src=https://example.com/pixel>",
    "![Photo](https://example.com/photo)",
    "[^note]: Extended note",
    ":::warning",
  ])
    assert.equal(needsPreservedNote(content), true);
  assert.equal(needsPreservedNote("```html\n<img src=example>\n```"), false);
  assert.equal(
    needsPreservedNote("## Plan\n\n**Bold** and [link](https://example.com)"),
    false,
  );
});
